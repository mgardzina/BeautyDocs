// Shared helpers for recording product media (see docs/platform-media.md).
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const BASE = "http://localhost:3000";
export const SLUG = "atelier-aurora";
const FFMPEG = path.join(os.homedir(), "Library/Caches/ms-playwright/ffmpeg-1011/ffmpeg-mac");

const seed = fs.readFileSync(new URL("../../apps/api/scripts/seed_demo_salon.py", import.meta.url), "utf8");
export const DEMO_EMAIL = seed.match(/DEMO_OWNER_EMAIL = "([^"]+)"/)[1];
export const DEMO_PASSWORD = process.env.BEAUTYDOCS_DEMO_PASSWORD ?? seed.match(/"BEAUTYDOCS_DEMO_PASSWORD", "([^"]+)"/)[1];

/** Page chrome for captures: hide dev overlays, show touches or a cursor. */
export async function prepareContext(context, { touch = false, cursor = false, hideChat = true } = {}) {
  await context.addCookies([{ name: "beautydocs_lang", value: "pl", url: BASE }]);
  await context.addInitScript(({ touch, cursor, hideChat }) => {
    const install = () => {
      const style = document.createElement("style");
      style.textContent = `
        nextjs-portal, [data-nextjs-toast], [data-next-badge-root] { display: none !important; }
        ${hideChat ? '[aria-label="Otwórz szybki czat"], [aria-label="Szybki czat BeautyDocs"] { display: none !important; }' : ""}
        html { scroll-behavior: auto !important; }
        ::-webkit-scrollbar { display: none; }
        .bd-touch { position: fixed; z-index: 2147483647; width: 44px; height: 44px; margin: -22px 0 0 -22px;
          border-radius: 999px; background: rgba(23,61,53,.18); border: 2px solid rgba(255,255,255,.9);
          box-shadow: 0 4px 18px rgba(23,61,53,.28); pointer-events: none; opacity: 0; transform: scale(.6);
          transition: opacity .18s ease, transform .22s cubic-bezier(.2,.9,.3,1); }
        .bd-touch.is-down { opacity: 1; transform: scale(1); }
        .bd-cursor { position: fixed; z-index: 2147483647; left: 0; top: 0; width: 22px; height: 22px; pointer-events: none;
          transition: transform .08s linear; }`;
      document.documentElement.appendChild(style);
      if (touch) {
        const dot = document.createElement("div");
        dot.className = "bd-touch";
        document.documentElement.appendChild(dot);
        const place = (e) => { dot.style.left = `${e.clientX}px`; dot.style.top = `${e.clientY}px`; };
        addEventListener("pointerdown", (e) => { place(e); dot.classList.add("is-down"); }, true);
        addEventListener("pointermove", place, true);
        addEventListener("pointerup", () => setTimeout(() => dot.classList.remove("is-down"), 140), true);
      }
      if (cursor) {
        const el = document.createElement("div");
        el.className = "bd-cursor";
        el.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 2l15 9-6.5 1.6L9.8 19 4 2z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
        document.documentElement.appendChild(el);
        const saved = sessionStorage.getItem("bd-cursor");
        if (saved) el.style.transform = saved;
        addEventListener("mousemove", (e) => {
          el.style.transform = `translate(${e.clientX - 3}px, ${e.clientY - 2}px)`;
          sessionStorage.setItem("bd-cursor", el.style.transform);
        }, true);
      }
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
    else install();
  }, { touch, cursor, hideChat });
}

/** Chrome screencast → constant-frame-rate VP8 WebM at device resolution. */
export async function startRecording(page) {
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on("Page.screencastFrame", async (event) => {
    frames.push({ t: event.metadata.timestamp, data: Buffer.from(event.data, "base64") });
    await cdp.send("Page.screencastFrameAck", { sessionId: event.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, everyNthFrame: 1 });
  const startedAt = Date.now() / 1000;
  return async function stop(outFile, { fps = 30, bitrate = "6M" } = {}) {
    await cdp.send("Page.stopScreencast");
    const endedAt = Date.now() / 1000;
    if (!frames.length) throw new Error("No frames captured");
    const first = frames[0].t;
    const duration = Math.max(endedAt - startedAt, frames.at(-1).t - first + 0.5);
    const ff = spawn(FFMPEG, [
      "-y", "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", String(fps), "-i", "pipe:0", "-pix_fmt", "yuv420p",
      "-c:v", "libvpx", "-b:v", bitrate, "-crf", "8", "-qmin", "0", "-qmax", "40",
      "-deadline", "good", "-cpu-used", "1", "-auto-alt-ref", "0", "-an", outFile,
    ], { stdio: ["pipe", "ignore", "inherit"] });
    let index = 0;
    for (let t = 0; t <= duration; t += 1 / fps) {
      while (index + 1 < frames.length && frames[index + 1].t - first <= t) index += 1;
      if (!ff.stdin.write(frames[index].data)) await new Promise((r) => ff.stdin.once("drain", r));
    }
    ff.stdin.end();
    await new Promise((resolve, reject) => ff.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}`)))));
    return { frames: frames.length, duration };
  };
}

export async function glideTo(page, locator, { steps = 28, offsetX = 0.5, offsetY = 0.5 } = {}) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width * offsetX, box.y + box.height * offsetY, { steps });
}

export async function smoothScroll(page, distance, { step = 90, pause = 16 } = {}) {
  const sign = Math.sign(distance);
  for (let moved = 0; moved < Math.abs(distance); moved += step) {
    await page.mouse.wheel(0, sign * Math.min(step, Math.abs(distance) - moved));
    await page.waitForTimeout(pause);
  }
}

export async function signOnCanvas(page, canvas, seed = 1) {
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  const x0 = box.x + box.width * 0.12;
  const y0 = box.y + box.height * 0.64;
  const width = box.width * 0.95;
  const compact = box.width < 420;
  const height = box.height * (compact ? 0.55 : 0.9);
  const loops = compact ? 4 : 6 + (seed % 2);
  const total = loops * Math.PI * 2;
  const advance = (width * (compact ? 0.66 : 0.62)) / total;
  const point = (t) => {
    const loop = Math.floor(t / (Math.PI * 2));
    const amp = height * (0.13 + 0.07 * Math.sin(t * 0.37 + seed) + (loop === 0 ? 0.16 : loop === 2 || loop === 5 ? 0.07 : 0));
    return { x: x0 + advance * t + amp * 0.9 * Math.sin(t), y: y0 - amp * (1 - Math.cos(t)) * 0.9 + amp * 0.15 };
  };
  let p = point(0);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  for (let t = 0; t <= total; t += 0.12) {
    p = point(t);
    await page.mouse.move(p.x, p.y, { steps: 1 });
    await page.waitForTimeout(6);
  }
  await page.mouse.move(p.x + width * 0.1, p.y + height * 0.02, { steps: 6 });
  await page.mouse.up();
}
