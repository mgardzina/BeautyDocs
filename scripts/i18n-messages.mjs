// Collect translatable UI strings and check the locale catalogs.
//
//   node scripts/i18n-messages.mjs           # list sources missing from any catalog
//   node scripts/i18n-messages.mjs --json    # print every source string as JSON
//
// Sources are (a) literal first arguments of t("…") and (b) human-facing string
// literals declared at module level in files that translate, because those
// reach t() through variables (navigation items, status labels, placeholders).
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(ROOT, "package.json"));
const ts = require("typescript");

const SCAN_DIRS = ["components/beautydocs", "app", "lib"];
const SKIP = [/\/node_modules\//, /\.test\.tsx?$/, /^app\/(regulamin|polityka-prywatnosci|admin|powderbrows|components)\//, /^lib\/i18n\//];
const LOCALES = ["en", "de", "es", "fr"];
const PL = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ„”]/;

function isHuman(text) {
  const s = text.trim();
  if (!s || !/[A-Za-zĄ-ż]/.test(s)) return false;
  if (/^https?:|^\/|^#|^[\w.-]+@[\w.-]+$/.test(s) || /[{}<>]|=>|\$\{/.test(s) || /^use (client|server)$/.test(s)) return false;
  if (PL.test(s) || /^np\. /i.test(s)) return true;
  return /^[A-ZĄĆĘŁŃÓŚŹŻ]/.test(s) && /[a-ząćęłńóśźż]/.test(s) && !(/^[A-Z][a-z]+[A-Z]/.test(s) && !/\s/.test(s)) && !s.includes("_");
}

function files() {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = path.posix.join(dir, entry.name);
      if (entry.isDirectory()) walk(rel);
      else if (/\.tsx?$/.test(entry.name) && !SKIP.some((re) => re.test(rel))) out.push(rel);
    }
  };
  SCAN_DIRS.forEach(walk);
  return out;
}

export function collectSources() {
  const sources = new Set();
  for (const rel of files()) {
    const text = fs.readFileSync(path.join(ROOT, rel), "utf8");
    if (!/\bt\(|\btr\(|useT\(|getServerTranslator\(/.test(text)) continue;
    const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, rel.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visit = (node, depth) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && /^(t|tr|tx_)$/.test(node.expression.text)) {
        const arg = node.arguments[0];
        if (arg && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg))) sources.add(arg.text);
      }
      const inFunction = ts.isFunctionLike(node) ? depth + 1 : depth;
      if (inFunction === 0 && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))) {
        const p = node.parent;
        const skip = ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isLiteralTypeNode(p) || (ts.isPropertyAssignment(p) && p.name === node);
        if (!skip && isHuman(node.text)) sources.add(node.text);
      }
      ts.forEachChild(node, (child) => visit(child, inFunction));
    };
    visit(sf, 0);
  }
  return [...sources].sort((a, b) => a.localeCompare(b, "pl"));
}

export function loadCatalog(locale) {
  const file = path.join(ROOT, "lib/i18n/messages", `${locale}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const sources = collectSources();
  if (process.argv.includes("--json")) {
    process.stdout.write(JSON.stringify(sources, null, 1) + "\n");
  } else {
    let missingTotal = 0;
    for (const locale of LOCALES) {
      const catalog = loadCatalog(locale);
      const missing = sources.filter((source) => !Object.hasOwn(catalog, source));
      missingTotal += missing.length;
      console.log(`${locale}: ${sources.length - missing.length}/${sources.length} translated`);
      for (const source of missing.slice(0, 20)) console.log(`  missing: ${JSON.stringify(source)}`);
    }
    process.exitCode = missingTotal ? 1 : 0;
  }
}
