// Checks that every DOI in the data files is registered, using the doi.org
// handle API (it answers for the DOI itself, so publisher sites that block
// automated visitors don't cause false alarms).
// Usage: node scripts/check-dois.mjs [--report report.md]
import fs from "node:fs";
import { dataPath, extractDois, getJson } from "./lib/data.mjs";

const reportIdx = process.argv.indexOf("--report");
const reportFile = reportIdx > -1 ? process.argv[reportIdx + 1] : null;

const found = new Map(); // doi -> file
for (const file of ["publications.js", "presentations.js", "news.js"]) {
  for (const doi of extractDois(fs.readFileSync(dataPath(file), "utf8"))) if (!found.has(doi)) found.set(doi, file);
}

async function exists(doi) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await getJson(`https://doi.org/api/handles/${encodeURIComponent(doi)}?type=URL`);
      return Boolean(r && r.responseCode === 1);
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise((ok) => setTimeout(ok, 2000 * attempt));
    }
  }
}

const bad = [];
const unchecked = [];
const dois = [...found.keys()];
for (let i = 0; i < dois.length; i += 8) {
  await Promise.all(
    dois.slice(i, i + 8).map(async (doi) => {
      try {
        if (!(await exists(doi))) bad.push(doi);
      } catch (e) {
        unchecked.push(`${doi} (${e.message})`);
      }
    })
  );
}

const lines = [`Checked ${dois.length} DOIs.`];
if (bad.length) {
  lines.push("", "**These DOIs are not registered at doi.org** (likely a typo):", "");
  for (const d of bad.sort()) lines.push(`- \`https://doi.org/${d}\` in \`data/${found.get(d)}\``);
}
if (unchecked.length) lines.push("", "Could not check (doi.org did not answer):", "", ...unchecked.map((u) => `- ${u}`));
const report = lines.join("\n");
console.log(report);
if (reportFile) fs.writeFileSync(reportFile, report + "\n");
process.exit(bad.length ? 1 : 0);
