// npm run localize-fonts -- <game-slug | folder>
// Games must not load anything from other sites (the portal blocks it, to protect students).
// This replaces a game's Google Fonts <link> tags with copies of the same font files saved in
// games/<slug>/fonts/, so the game looks as designed with no request leaving our server.
// Run it on a laptop, never on the server. It only talks to Google's two font hosts.
// Safe to re-run: a game with no Google Fonts links is left alone.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// A folder that holds an index.html (a game's own repo or build folder), or a slug under games/.
const arg = process.argv[2];
const root = path.resolve(import.meta.dirname, "..");
const isDir = !!arg && fs.existsSync(arg) && fs.statSync(arg).isDirectory();
if (!arg || (!isDir && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(arg))) {
  console.error("usage: npm run localize-fonts -- <game-slug | folder with index.html>");
  process.exit(1);
}
const gameDir = isDir ? path.resolve(arg) : path.join(root, "games", arg);
const label = isDir ? arg : `games/${arg}`;
const slug = label;
const htmlFile = path.join(gameDir, "index.html");
if (!fs.existsSync(htmlFile)) {
  console.error(`${label}/index.html not found`);
  process.exit(1);
}

const CSS_HOST = "fonts.googleapis.com";
const FONT_HOST = "fonts.gstatic.com";
const MAX_FILE = 2 * 1024 * 1024; // sanity limits
const MAX_TOTAL = 8 * 1024 * 1024;
// Google serves woff2 files only to modern browsers, so ask like one.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

let html = fs.readFileSync(htmlFile, "utf8");
const LINKS = /<link\b[^>]*\bhref=["'](https:\/\/fonts\.googleapis\.com\/css2?\?[^"']*)["'][^>]*>[ \t]*\r?\n?/gi;
const PRECONNECT = /<link\b[^>]*\bhref=["']https:\/\/fonts\.(?:googleapis|gstatic)\.com\/?["'][^>]*>[ \t]*\r?\n?/gi;
const urls = [...new Set([...html.matchAll(LINKS)].map((m) => m[1].replaceAll("&amp;", "&")))];
if (!urls.length) {
  console.log(`${label}: no Google Fonts links, nothing to do`);
  process.exit(0);
}

const get = async (url, expectHost, asText) => {
  const u = new URL(url);
  if (u.protocol !== "https:" || u.hostname !== expectHost) throw new Error(`refusing ${url}`);
  const res = await fetch(u, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  if (asText) return res.text();
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_FILE) throw new Error(`${url} is unexpectedly large`);
  if (buf.subarray(0, 4).toString("latin1") !== "wOF2") throw new Error(`${url} is not a woff2 font`);
  return buf;
};

const fontsDir = path.join(gameDir, "fonts");
fs.mkdirSync(fontsDir, { recursive: true });
const saved = new Map(); // font url -> file name
const families = new Set();
let total = 0;
let css = "/* Self-hosted copies of the fonts this game asked Google Fonts for. See README.txt. */\n";

for (const url of urls) {
  const sheet = await get(url, CSS_HOST, true);
  const textSubset = /[?&]text=/.test(url); // a tiny custom subset: keep every block
  for (const m of sheet.matchAll(/(?:\/\*\s*([\w[\]-]+)\s*\*\/\s*)?@font-face\s*\{([^}]*)\}/g)) {
    const body = m[2];
    const decl = Object.fromEntries([...body.matchAll(/([\w-]+)\s*:\s*([^;]+);/g)].map((d) => [d[1], d[2].trim()]));
    // English text: the latin pieces are enough (they cover U+0000-00FF). Google labels only some pieces,
    // so test the character range, not the comment. Other scripts fall back to the system font.
    if (!textSubset && decl["unicode-range"] && !/U\+0000-00FF/i.test(decl["unicode-range"])) continue;
    const src = /url\(["']?(https:\/\/fonts\.gstatic\.com\/[^)"']+)["']?\)/.exec(decl.src || "");
    if (!src || !decl["font-family"]) throw new Error(`unexpected @font-face in ${url}`);
    const family = decl["font-family"].replace(/["']/g, "");
    families.add(family);
    if (!saved.has(src[1])) {
      const buf = await get(src[1], FONT_HOST, false);
      total += buf.length;
      if (total > MAX_TOTAL) throw new Error("fonts add up to more than 8 MB; stopping");
      const name = [family, decl["font-style"] || "normal", (decl["font-weight"] || "400").replace(/\s+/g, "-"), crypto.createHash("sha1").update(src[1]).digest("hex").slice(0, 8)]
        .join("-").toLowerCase().replace(/[^a-z0-9.-]+/g, "-") + ".woff2";
      fs.writeFileSync(path.join(fontsDir, name), buf);
      saved.set(src[1], name);
    }
    const lines = Object.entries(decl).map(([k, v]) => `  ${k}: ${k === "src" ? `url("${saved.get(src[1])}") format("woff2")` : v};`);
    css += `@font-face {\n${lines.join("\n")}\n}\n`;
  }
}
if (!saved.size) throw new Error("no font files found; leaving the game unchanged");
fs.writeFileSync(path.join(fontsDir, "fonts.css"), css);
fs.writeFileSync(
  path.join(fontsDir, "README.txt"),
  `Fonts used by this game, self-hosted so no visitor's browser contacts Google.\nFamilies: ${[...families].sort().join(", ")}\nSource: Google Fonts (${new Date().toISOString().slice(0, 10)}). These are open-source fonts under the SIL Open Font License 1.1,\nwhich allows redistribution: https://openfontlicense.org\nTo regenerate: node tools/localize-fonts.mjs <folder with index.html> (or npm run localize-fonts -- <folder> in cte-hub)\n`,
);

// Swap the Google links for one local stylesheet, and drop the preconnects.
let first = true;
html = html.replace(LINKS, () => {
  if (!first) return "";
  first = false;
  return '<link rel="stylesheet" href="fonts/fonts.css">\n';
});
html = html.replace(PRECONNECT, "");
fs.writeFileSync(htmlFile, html);

const left = html.match(/fonts\.(googleapis|gstatic)\.com/g);
console.log(`${label}: saved ${saved.size} font files (${(total / 1024).toFixed(0)} KB) for ${families.size} families in ${label}/fonts/`);
if (left) console.log(`WARNING: ${left.length} mention(s) of Google Fonts remain in index.html (set from script?). Look at them by hand.`);
