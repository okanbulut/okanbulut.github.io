// Updates the version tags on the Software page (software/index.html).
// Each tag is a <p class="pkg-version" data-cran="pkg"> or
// <p class="pkg-version" data-github="owner/repo"> element; its text is set
// to "vX.Y.Z · CRAN" or "vX.Y.Z · GitHub" from the package's DESCRIPTION file.
// To show a version on a new package card, add such an element under its <h3>.
// Usage: node scripts/update-package-versions.mjs [--dry-run] [--summary out.md]
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib/data.mjs";

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const SUMMARY = args.indexOf("--summary") > -1 ? args[args.indexOf("--summary") + 1] : null;
const FILE = path.join(ROOT, "software", "index.html");

async function description(url) {
  const res = await fetch(url, { headers: { "User-Agent": "website-content-sync (GitHub Actions)" } });
  if (!res.ok) return null;
  const fields = {};
  for (const line of (await res.text()).split("\n")) {
    const m = line.match(/^([\w/.-]+):\s*(.*)$/);
    if (m) fields[m[1]] = m[2].trim();
  }
  return fields.Version ? fields : null;
}

async function cran(pkg) {
  // CRAN itself first, then its GitHub mirror (github.com/cran).
  const d =
    (await description(`https://cran.r-project.org/web/packages/${pkg}/DESCRIPTION`).catch(() => null)) ||
    (await description(`https://raw.githubusercontent.com/cran/${pkg}/HEAD/DESCRIPTION`));
  return d && { version: d.Version, label: "CRAN", date: (d["Date/Publication"] || "").slice(0, 10) };
}

async function github(repo) {
  const d = await description(`https://raw.githubusercontent.com/${repo}/HEAD/DESCRIPTION`);
  return d && { version: d.Version, label: "GitHub" };
}

const src = fs.readFileSync(FILE, "utf8");
const re = /(<p class="pkg-version" data-(cran|github)="([^"]+)">)([^<]*)(<\/p>)/g;
const jobs = [...src.matchAll(re)];
const results = await Promise.all(
  jobs.map(async (m) => {
    try {
      return await (m[2] === "cran" ? cran(m[3]) : github(m[3]));
    } catch (e) {
      return { error: e.message };
    }
  })
);

let i = 0;
const changes = [];
const problems = [];
const out = src.replace(re, (all, open, kind, name, text, close) => {
  const r = results[i++];
  if (!r || r.error) {
    problems.push(`${name}: could not read DESCRIPTION${r && r.error ? ` (${r.error})` : ""}`);
    return all;
  }
  const next = `v${r.version} · ${r.label}`;
  if (next !== text) changes.push(`- **${name}**: ${text || "(none)"} → ${next}${r.date ? ` (published ${r.date})` : ""}`);
  return open + next + close;
});

const report = [
  `Checked ${jobs.length} packages on the Software page.`,
  "",
  ...(changes.length ? ["### New versions", "", ...changes, ""] : ["No version changes."]),
  ...(problems.length ? ["", "### Could not check", "", ...problems.map((p) => `- ${p}`)] : []),
].join("\n");
console.log(report);
if (SUMMARY) fs.writeFileSync(SUMMARY, report + "\n");
if (!DRY && out !== src) fs.writeFileSync(FILE, out);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `changes=${changes.length}\n`);
