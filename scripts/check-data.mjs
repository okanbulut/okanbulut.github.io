// Sanity checks for the data files. Fails (exit 1) if a file no longer loads,
// an entry is malformed, or a DOI is not written as https://doi.org/10.xxxx/...
// Usage: node scripts/check-data.mjs
import fs from "node:fs";
import { loadData, dataPath } from "./lib/data.mjs";

const errors = [];
const err = (file, msg) => errors.push(`${file}: ${msg}`);

function checkEntry(file, where, e) {
  const html = typeof e === "string" ? e : e && e.html;
  if (typeof html !== "string" || !html.trim()) return err(file, `${where}: entry has no text`);
  if (/<(em|strong|a)\b[^>]*>(?![\s\S]*<\/\1>)/i.test(html)) err(file, `${where}: unclosed <em>, <strong> or <a> tag in "${html.slice(0, 80)}..."`);
}

function checkList(file, where, list) {
  if (!Array.isArray(list)) return err(file, `${where} should be a list`);
  list.forEach((e, i) => checkEntry(file, `${where}[${i + 1}]`, e));
}

function checkYearBlocks(file, where, blocks) {
  if (!Array.isArray(blocks)) return err(file, `${where} should be a list of year blocks`);
  let prev = Infinity;
  blocks.forEach((b, i) => {
    if (!b || !/^\d{4}( and earlier)?$/.test(String(b.year))) return err(file, `${where} block ${i + 1} needs year: "YYYY"`);
    const y = parseInt(b.year, 10);
    if (y >= prev) err(file, `${where}: year ${b.year} is out of order (newest year goes at the top)`);
    prev = y;
    checkList(file, `${where} ${b.year}`, b.items);
  });
}

function load(file, names) {
  try {
    return loadData(file, names);
  } catch (e) {
    err(file, `does not load: ${e.message}`);
    return null;
  }
}

const pubs = load("publications.js", ["PUBLICATIONS"]);
if (pubs) {
  const P = pubs.PUBLICATIONS;
  for (const k of ["books", "chapters", "proceedings", "underReview"]) checkList("publications.js", k, P[k]);
  checkYearBlocks("publications.js", "articles", P.articles);
}

const pres = load("presentations.js", ["PRESENTATIONS"]);
if (pres) {
  checkList("presentations.js", "invited", pres.PRESENTATIONS.invited);
  checkYearBlocks("presentations.js", "conference", pres.PRESENTATIONS.conference);
}

const news = load("news.js", ["NEWS", "NEWS_HOME_FROM_YEAR"]);
if (news) {
  if (!Array.isArray(news.NEWS)) err("news.js", "NEWS should be a list");
  else
    news.NEWS.forEach((n, i) => {
      if (!n || !/^[A-Z][a-z]+ \d{4}$/.test(n.date || "")) err("news.js", `item ${i + 1}: date should look like "June 2026"`);
      checkEntry("news.js", `item ${i + 1}`, n);
    });
}

// DOI style: always https://doi.org/10.xxxx/...
for (const file of ["publications.js", "presentations.js", "news.js"]) {
  fs.readFileSync(dataPath(file), "utf8")
    .split("\n")
    .forEach((line, i) => {
      if (/\bdoi:\s*10\.|dx\.doi\.org|http:\/\/doi\.org/i.test(line))
        err(file, `line ${i + 1}: write DOIs as https://doi.org/10.xxxx/... (found "${line.match(/\bdoi:\s*10\.\S{0,20}|dx\.doi\.org\S{0,20}|http:\/\/doi\.org\S{0,20}/i)[0]}")`);
    });
}

if (errors.length) {
  console.error(`Data check failed (${errors.length}):\n- ` + errors.join("\n- "));
  process.exit(1);
}
console.log("Data files OK.");
