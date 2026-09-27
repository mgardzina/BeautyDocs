// Records the real BeautyDocs product (fictional demo salon) for /platforma.
import { chromium, devices } from "playwright-core";
import fs from "node:fs";
import {
  BASE, SLUG, DEMO_EMAIL, DEMO_PASSWORD,
  glideTo, prepareContext, signOnCanvas, smoothScroll, startRecording,
} from "./lib.mjs";

const OUT = new URL("./out/", import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const only = process.argv[2];
const browser = await chromium.launch({ channel: "chrome", headless: true });

// The demo document shown everywhere: Zofia Wiśniewska's signed lip-contouring form.
let ZOFIA = "";
let ZOFIA_FORM = "";
async function findDemoDocument(page) {
  await page.goto(`${BASE}/panel/${SLUG}/clients`, { waitUntil: "load" });
  const href = await page.locator("a", { hasText: "Zofia Wiśniewska" }).first().getAttribute("href");
  ZOFIA = href.split("/clients/")[1];
  await page.goto(`${BASE}${href}`, { waitUntil: "load" });
  const formHref = await page.locator('a[href*="/forms/"]').first().getAttribute("href");
  ZOFIA_FORM = formHref.split("/forms/")[1];
}

async function tap(page, locator, { hold = 90 } = {}) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(hold);
  await page.mouse.up();
}

async function bringIntoView(page, locator, margin = 180) {
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  if (box.y + box.height > viewport.height - margin) await smoothScroll(page, box.y + box.height - viewport.height + margin + 60, { step: 60, pause: 12 });
  else if (box.y < 90) await smoothScroll(page, box.y - 140, { step: 60, pause: 12 });
}

// ---------- Phone: a client fills in and signs a treatment form ----------
async function phoneFlow() {
  const context = await browser.newContext({ ...devices["iPhone 13"], deviceScaleFactor: 2, locale: "pl-PL" });
  await prepareContext(context, { touch: true });
  const page = await context.newPage();
  await page.goto(`${BASE}/f/${SLUG}/modelowanie-ust`, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}phone-form-start.png` });

  const stop = await startRecording(page);
  const t0 = Date.now();
  const chapters = {};
  const mark = (name) => { chapters[name] = Math.max(0, (Date.now() - t0) / 1000 - 0.3); };
  mark("details");
  await page.waitForTimeout(1400);
  await smoothScroll(page, 330);
  await page.waitForTimeout(400);
  await tap(page, page.locator("#field-imieNazwisko"));
  await page.keyboard.type("Laura Mazur", { delay: 75 });
  await tap(page, page.locator("#field-telefon"));
  await page.keyboard.type("510883604", { delay: 70 });
  await page.waitForTimeout(300);
  await bringIntoView(page, page.locator("#field-celEfektu"));
  await tap(page, page.locator("#field-celEfektu"));
  await page.keyboard.type("Naturalne podkreślenie ust", { delay: 55 });
  await page.keyboard.press("Escape");
  const practitioner = page.locator('button[id^="field-osobaPrzeprowadzajacaZabieg-"]').first();
  await bringIntoView(page, practitioner);
  await tap(page, practitioner);
  await page.waitForTimeout(500);

  const noButtons = await page.getByRole("radio", { name: "Nie", exact: true }).all();
  mark("medical");
  for (const [index, button] of noButtons.entries()) {
    await bringIntoView(page, button, 240);
    if (index === 3) await page.screenshot({ path: `${OUT}phone-medical.png` });
    await tap(page, button, { hold: 60 });
    await page.waitForTimeout(index < 5 ? 420 : 140);
  }
  const place = page.locator("#place-and-date");
  await bringIntoView(page, place);
  await tap(page, place);
  await page.keyboard.type("Kraków, 26.09.2026", { delay: 45 });
  await page.waitForTimeout(300);
  mark("sms");
  await tap(page, page.getByRole("button", { name: "Przejdź do weryfikacji SMS" }));
  await page.waitForTimeout(1300);
  await tap(page, page.getByRole("button", { name: "Wyślij kod SMS" }));
  await page.waitForTimeout(1600);
  const text = await page.locator("body").innerText();
  const code = text.match(/kod(?: testowy)?:\s*(\d{6})/i)?.[1];
  if (!code) throw new Error("No development SMS code on screen");
  await page.screenshot({ path: `${OUT}phone-sms.png` });
  await tap(page, page.getByLabel("Cyfra 1 kodu SMS"));
  await page.keyboard.type(code, { delay: 140 });
  await page.waitForTimeout(500);
  await tap(page, page.getByRole("button", { name: "Potwierdź i przejdź do podpisów" }));
  await page.waitForTimeout(1800);

  mark("consents");
  const agrees = page.getByRole("button", { name: "Wyrażam zgodę", exact: true });
  const total = await agrees.count();
  for (let i = 0; i < total; i += 1) {
    await bringIntoView(page, agrees.nth(i), 380);
    await page.waitForTimeout(250);
    await tap(page, agrees.nth(i));
    await page.waitForTimeout(450);
    const canvas = page.locator("canvas").nth(i);
    await bringIntoView(page, canvas, 120);
    await signOnCanvas(page, canvas, i + 1);
    if (i === 0) await page.screenshot({ path: `${OUT}phone-consent.png` });
    await page.waitForTimeout(350);
  }
  const submit = page.getByRole("button", { name: "Podpisz i wyślij formularz" });
  await bringIntoView(page, submit);
  await tap(page, submit);
  await page.waitForTimeout(1200);
  mark("done");
  await page.waitForTimeout(1400);
  await page.evaluate(() => window.scrollTo({ top: 0 }));
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${OUT}phone-success.png` });
  const result = await stop(`${OUT}phone-flow.webm`, { bitrate: "3M" });
  console.log("phone", result, chapters);
  fs.writeFileSync(`${OUT}phone-chapters.json`, JSON.stringify(chapters));
  await context.close();
}

// ---------- Desktop: the salon panel ----------
async function signIn(context) {
  const page = await context.newPage();
  await page.goto(`${BASE}/konto?mode=login`, { waitUntil: "load" });
  await page.getByLabel(/e-mail/i).first().fill(DEMO_EMAIL);
  await page.locator('input[type="password"]').first().fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: /^Zaloguj się/ }).last().click();
  await page.waitForURL(/\/panel/, { timeout: 20000 });
  if (!ZOFIA) await findDemoDocument(page);
  return page;
}

async function desktopShots() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: "pl-PL" });
  await prepareContext(context);
  const page = await signIn(context);
  const shoot = async (path, file, { scroll = 0, clip } = {}) => {
    await page.goto(`${BASE}/panel/${SLUG}${path}`, { waitUntil: "load" });
    await page.waitForTimeout(2200);
    if (scroll) { await page.evaluate((y) => window.scrollTo(0, y), scroll); await page.waitForTimeout(500); }
    await page.screenshot({ path: `${OUT}${file}`, clip });
  };
  await shoot("", "desktop-overview.png");
  await shoot("/clients", "desktop-clients.png");
  await shoot(`/clients/${ZOFIA}`, "desktop-client.png");
  await shoot(`/clients/${ZOFIA}/forms/${ZOFIA_FORM}`, "desktop-document.png");
  await shoot(`/clients/${ZOFIA}/forms/${ZOFIA_FORM}`, "desktop-document-signatures.png", { scroll: 99999 });
  await shoot("/visits", "desktop-calendar.png");
  await shoot("/forms", "desktop-forms.png");
  await context.close();
}

async function desktopTour() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, locale: "pl-PL" });
  await prepareContext(context, { cursor: true });
  const page = await signIn(context);
  await page.goto(`${BASE}/panel/${SLUG}`, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  await page.mouse.move(900, 500);
  const stop = await startRecording(page);
  await page.waitForTimeout(1800);
  await glideTo(page, page.getByRole("link", { name: /Kalendarz/ }).first());
  await page.mouse.down(); await page.mouse.up();
  await page.waitForURL(/\/visits/); await page.waitForTimeout(2200);
  await glideTo(page, page.getByRole("link", { name: /Klientki/ }).first());
  await page.mouse.down(); await page.mouse.up();
  await page.waitForURL(/\/clients$/); await page.waitForTimeout(1600);
  const zofia = page.locator(`a[href$="/clients/${ZOFIA}"]`).first();
  await glideTo(page, zofia, { offsetX: 0.2 });
  await page.mouse.down(); await page.mouse.up();
  await page.waitForURL(new RegExp(ZOFIA)); await page.waitForTimeout(1800);
  const formLink = page.locator(`a[href*="/forms/${ZOFIA_FORM}"]`).first();
  const box = await formLink.boundingBox();
  await smoothScroll(page, box.y - 420, { step: 40, pause: 14 });
  await page.waitForTimeout(700);
  await glideTo(page, formLink, { offsetX: 0.3 });
  await page.mouse.down(); await page.mouse.up();
  await page.waitForURL(new RegExp(ZOFIA_FORM)); await page.waitForTimeout(1800);
  await smoothScroll(page, 2200, { step: 55, pause: 16 });
  await page.waitForTimeout(1200);
  await smoothScroll(page, 99999, { step: 90, pause: 14 });
  await page.waitForTimeout(1800);
  const result = await stop(`${OUT}panel-tour.webm`, { bitrate: "3.5M" });
  console.log("tour", result);
  await context.close();
}

if (!only || only === "shots") await desktopShots();
if (!only || only === "tour") await desktopTour();
if (!only || only === "phone") await phoneFlow();
await browser.close();
