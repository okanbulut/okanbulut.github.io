// Publication sync: finds works on the ORCID record that are not on the site
// yet, formats them in APA 7 from Crossref (or DataCite) metadata, and adds
// them to data/publications.js. It also upgrades "(In press)" and
// "(Under review)" entries once the paper is out with a DOI.
//
// The GitHub Action runs this weekly and opens a pull request; nothing goes
// live until the pull request is merged.
//
// Usage:
//   node scripts/sync-publications.mjs [--dry-run] [--summary out.md] [--since YEAR]
//
// To stop a work from being suggested again, add its DOI to
// data/sync-ignore.json.
import fs from "node:fs";
import { dataPath, extractDois, cleanDoi, squash, getJson, loadData } from "./lib/data.mjs";

const ORCID = "0000-0001-5853-1267";
const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const opt = (name) => (args.indexOf(name) > -1 ? args[args.indexOf(name) + 1] : null);
const SUMMARY = opt("--summary");
// Only add works from this year on automatically; older gaps are listed in
// the pull request instead, so the first run doesn't flood the page.
const SINCE = Number(opt("--since")) || new Date().getFullYear() - 2;

const PUB_FILE = dataPath("publications.js");
const IGNORE_FILE = dataPath("sync-ignore.json");

// ORCID work types we handle, mapped to a site section.
const ORCID_TYPES = {
  "journal-article": "articles",
  preprint: "articles",
  "book-chapter": "chapters",
  "conference-paper": "proceedings",
  book: "books",
  "edited-book": "books",
};

// ---------- text helpers ----------

const decode = (s) =>
  String(s || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const esc = (s) => decode(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function initials(given) {
  return String(given || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) =>
      part
        .split("-")
        .map((p) => (p.replace(/\./g, "")[0] || "").toUpperCase() + ".")
        .join("-")
    )
    .join(" ");
}

function personAPA(p) {
  if (p.literal || !p.family) return esc(p.literal || p.name || "");
  const i = initials(p.given);
  return esc(i ? `${p.family}, ${i}` : p.family);
}

function personEditor(p) {
  if (p.literal || !p.family) return esc(p.literal || p.name || "");
  const i = initials(p.given);
  return esc(i ? `${i} ${p.family}` : p.family);
}

function joinNames(names) {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]}, &amp; ${names[1]}`;
  if (names.length > 20) return `${names.slice(0, 19).join(", ")}, . . . ${names[names.length - 1]}`;
  return `${names.slice(0, -1).join(", ")}, &amp; ${names[names.length - 1]}`;
}

function joinEditors(names) {
  if (names.length <= 1) return names.join("");
  if (names.length === 2) return `${names[0]} &amp; ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, &amp; ${names[names.length - 1]}`;
}

// Publisher titles are often in Title Case; the site uses sentence case
// (with a capital after a colon). Words that look like acronyms or brand
// names (TIMSS, ChatGPT, R) are left alone. Proper nouns need a human check.
const KEEP_CAPS = new Set(
  "Canada Canadian Alberta Edmonton Ontario Quebec English French Spanish Chinese Turkish Turkey German Germany American America European Europe Asian Africa African Indigenous Bayesian Rasch Markov Fisher Likert Python Gaussian Monte Carlo Wald Shapley Bonferroni Pearson Spearman".split(" ")
);

function sentenceCase(title) {
  const t = decode(title);
  const words = t.split(" ");
  const caps = words.filter((w) => /^[A-Z][a-z]/.test(w)).length;
  if (caps / Math.max(words.length, 1) < 0.5) return t; // already sentence case
  let startOfClause = true;
  return words
    .map((w) => {
      // Lower-case plain Capitalized words (not acronyms like TIMSS or ChatGPT).
      // At the start of a clause only the first part keeps its capital
      // ("Fine-Tuning" -> "Fine-tuning").
      const out = w
        .split("-")
        .map((part, i) => {
          if (startOfClause && i === 0) return part;
          const bare = part.replace(/[^A-Za-z'’]/g, "");
          return /^[A-Z][a-z'’]*$/.test(bare) && !KEEP_CAPS.has(bare) ? part.toLowerCase() : part;
        })
        .join("-");
      startOfClause = /[:?!]$/.test(w);
      return out;
    })
    .join(" ")
    .replace(/(^|:\s+)([a-z])/g, (m, a, b) => a + b.toUpperCase());
}

const endPunct = (s) => (/[.?!]$/.test(s) ? s : s + ".");
const pages = (p) => String(p || "").replace(/--?|–/g, "–");

// ---------- metadata ----------

async function crossref(doi) {
  const r = await getJson(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
  if (!r || !r.message) return null;
  const m = r.message;
  const date = (m.published || m.issued || m["published-print"] || m["published-online"] || {})["date-parts"];
  return {
    doi,
    type: m.type,
    authors: m.author || [],
    editors: m.editor || [],
    title: (m.title || [])[0] || "",
    container: (m["container-title"] || [])[0] || m["group-title"] || "",
    volume: m.volume,
    issue: m.issue,
    page: m.page,
    articleNumber: m["article-number"],
    publisher: m.publisher,
    year: date && date[0] && date[0][0],
  };
}

async function citeproc(doi) {
  // DataCite DOIs (Zenodo, OSF, etc.) via doi.org content negotiation.
  const r = await getJson(`https://doi.org/${encodeURIComponent(doi)}`, {
    Accept: "application/vnd.citationstyles.csl+json",
  });
  if (!r) return null;
  const date = (r.issued || r.published || {})["date-parts"];
  return {
    doi,
    type: r.type,
    authors: r.author || [],
    editors: r.editor || [],
    title: r.title || "",
    container: r["container-title"] || "",
    volume: r.volume,
    issue: r.issue,
    page: r.page,
    articleNumber: r.number,
    publisher: r.publisher,
    year: date && date[0] && date[0][0],
  };
}

async function metadata(doi) {
  try {
    return (await crossref(doi)) || (await citeproc(doi));
  } catch (e) {
    try {
      return await citeproc(doi);
    } catch {
      throw e;
    }
  }
}

function sectionFor(meta, orcidType) {
  const t = meta.type || "";
  if (/chapter|book-section|reference-entry/.test(t)) return "chapters";
  if (/proceedings|paper-conference/.test(t)) return "proceedings";
  if (/^(book|edited-book|monograph)$/.test(t)) return "books";
  if (/journal|posted-content|^article$/.test(t)) return "articles";
  return ORCID_TYPES[orcidType] || "articles";
}

function formatAPA(meta, section) {
  const authors = joinNames(meta.authors.map(personAPA));
  const year = meta.year || "In press";
  const title = esc(sentenceCase(meta.title));
  const doi = `https://doi.org/${meta.doi}`;
  const container = esc(meta.container || meta.publisher || "");
  const publisher = esc(meta.publisher || "");
  const pp = meta.page ? ` (pp. ${pages(meta.page)})` : "";

  if (section === "books") return `${authors} (${year}). <em>${endPunct(title).replace(/\.$/, "")}</em>. ${publisher ? publisher + ". " : ""}${doi}`;

  if (section === "chapters" || (section === "proceedings" && meta.editors.length)) {
    const eds = meta.editors.map(personEditor);
    const edPart = eds.length ? `In ${joinEditors(eds)} (${eds.length > 1 ? "Eds." : "Ed."}), ` : "In ";
    return `${authors} (${year}). ${endPunct(title)} ${edPart}<em>${container}</em>${pp}. ${publisher ? publisher + ". " : ""}${doi}`;
  }

  if (section === "proceedings") return `${authors} (${year}). ${endPunct(title)} In <em>${container}</em>${pp}. ${publisher ? publisher + ". " : ""}${doi}`;

  // Journal article or preprint.
  let src = `<em>${container}`;
  if (meta.volume) src += `, ${esc(meta.volume)}</em>${meta.issue ? `(${esc(meta.issue)})` : ""}`;
  else src += "</em>";
  if (meta.page) src += `, ${pages(meta.page)}`;
  else if (meta.articleNumber) src += `, Article ${esc(meta.articleNumber)}`;
  return `${authors} (${year}). ${endPunct(title)} ${src}. ${doi}`;
}

// ---------- reading the site's data ----------

const src = fs.readFileSync(PUB_FILE, "utf8");
const { PUBLICATIONS } = loadData("publications.js", ["PUBLICATIONS"]);
const ignore = new Set(
  (fs.existsSync(IGNORE_FILE) ? JSON.parse(fs.readFileSync(IGNORE_FILE, "utf8")).ignore || [] : []).map(cleanDoi)
);
const siteDois = new Set(extractDois(src));

const entryText = (e) => (typeof e === "string" ? e : e.html);
const entries = []; // { section, text, key, pending }
for (const section of ["books", "chapters", "proceedings", "underReview"])
  for (const e of PUBLICATIONS[section]) entries.push({ section, text: entryText(e) });
for (const block of PUBLICATIONS.articles)
  for (const e of block.items) entries.push({ section: "articles", text: entryText(e) });
for (const e of entries) {
  e.key = squash(e.text);
  e.pending = e.section === "underReview" || /\((In press|Under review|In preparation)\)/i.test(e.text);
}

const titleKey = (t) => squash(decode(t)).slice(0, 60);
const findByTitle = (title) => {
  const k = titleKey(title);
  return k.length >= 20 ? entries.find((e) => e.key.includes(k)) : undefined;
};

// ---------- editing the file ----------

let out = src;

function sectionRange(name) {
  const start = out.indexOf(`\n  ${name}: [`);
  if (start < 0) throw new Error(`section ${name} not found in publications.js`);
  const end = out.indexOf("\n  ],", start);
  return [start, end];
}

function insertAfterLine(pos, text) {
  const lineEnd = out.indexOf("\n", pos) + 1;
  out = out.slice(0, lineEnd) + text + out.slice(lineEnd);
}

// Skip leading "(In press)" / "(In preparation)" string entries so new items
// land right below them.
function skipPending(pos) {
  let p = out.indexOf("\n", pos) + 1;
  while (/^\s*"[^\n]*\((In press|In preparation)\)/.test(out.slice(p, out.indexOf("\n", p)))) p = out.indexOf("\n", p) + 1;
  return p - 1;
}

function addEntry(section, year, html) {
  const lit = JSON.stringify(html);
  if (section === "articles") {
    const [start, end] = sectionRange("articles");
    const re = /\n    \{\n\s*year: "(\d{4})[^"]*",\n\s*items: \[/g;
    re.lastIndex = start;
    let m;
    while ((m = re.exec(out)) && m.index < end) {
      const y = Number(m[1]);
      if (y === Number(year)) {
        const itemsLine = m.index + m[0].length;
        insertAfterLine(skipPending(itemsLine), `        ${lit},\n`);
        return;
      }
      if (y < Number(year)) {
        const block = `\n    {\n      year: "${year}",\n      items: [\n        ${lit},\n      ],\n    },`;
        out = out.slice(0, m.index) + block + out.slice(m.index);
        return;
      }
    }
    // Older than every block: goes into the last block ("... and earlier").
    const lastItems = out.lastIndexOf("items: [", end);
    insertAfterLine(lastItems, `        ${lit},\n`);
    return;
  }
  const [start] = sectionRange(section);
  const at = skipPending(start + 1);
  insertAfterLine(at, section === "chapters" ? `    {\n      html: ${lit},\n    },\n` : `    ${lit},\n`);
}

function removeEntry(text) {
  const lit = JSON.stringify(text);
  const i = out.indexOf(lit);
  if (i < 0) return false;
  const lineStart = out.lastIndexOf("\n", i) + 1;
  const line = out.slice(lineStart, out.indexOf("\n", i) + 1);
  if (/^\s*html:/.test(line)) {
    // Object entry: remove from its "{" line through its "}," line.
    const objStart = out.lastIndexOf("\n", out.lastIndexOf("{", i)) + 1;
    const objEnd = out.indexOf("},\n", i) + 3;
    out = out.slice(0, objStart) + out.slice(objEnd);
  } else {
    out = out.slice(0, lineStart) + out.slice(lineStart + line.length);
  }
  return true;
}

// ---------- main ----------

const added = [];
const upgraded = [];
const older = [];
const failed = [];
const skippedTypes = {};

const orcid = await getJson(`https://pub.orcid.org/v3.0/${ORCID}/works`);
const works = (orcid && orcid.group) || [];

const seen = new Set();
for (const g of works) {
  const summary = (g["work-summary"] || [])[0] || {};
  const type = summary.type;
  const ids = (g["external-ids"] && g["external-ids"]["external-id"]) || [];
  const doiId = ids.find((x) => x["external-id-type"] === "doi");
  if (!doiId) continue;
  const doi = cleanDoi(doiId["external-id-value"]);
  if (seen.has(doi) || siteDois.has(doi) || ignore.has(doi)) continue;
  seen.add(doi);
  if (!ORCID_TYPES[type]) {
    skippedTypes[type] = (skippedTypes[type] || 0) + 1;
    continue;
  }
  const orcidTitle = summary.title && summary.title.title && summary.title.title.value;
  const match = orcidTitle && findByTitle(orcidTitle);
  if (match && !match.pending) continue; // already on the site, just without a DOI

  let meta;
  try {
    meta = await metadata(doi);
  } catch (e) {
    failed.push(`${doi} (${e.message})`);
    continue;
  }
  if (!meta || !meta.title) {
    failed.push(`${doi} (no metadata found)`);
    continue;
  }
  const section = sectionFor(meta, type);
  const html = formatAPA(meta, section);
  if (match && match.pending) {
    removeEntry(match.text);
    addEntry(section, meta.year, html);
    upgraded.push({ from: match.text, to: html, section });
    continue;
  }
  if (!meta.year || meta.year < SINCE) {
    older.push({ doi, title: decode(meta.title), year: meta.year });
    continue;
  }
  addEntry(section, meta.year, html);
  added.push({ html, section, year: meta.year });
}

// "(In press)" articles that are not on ORCID yet: look them up on Crossref.
for (const e of entries.filter((x) => x.section === "articles" && /\(In press\)/i.test(x.text))) {
  if (upgraded.some((u) => u.from === e.text)) continue;
  const title = decode(e.text).replace(/^.*?\(In press\)\.\s*/i, "").split(/\.\s/)[0];
  try {
    const q = `https://api.crossref.org/works?rows=3&query.bibliographic=${encodeURIComponent(title)}&query.author=Bulut`;
    const r = await getJson(q);
    const hit = ((r && r.message && r.message.items) || []).find((it) => titleKey((it.title || [])[0] || "") === titleKey(title));
    if (!hit || !hit.volume) continue; // keep "In press" until it has a volume
    const doi = cleanDoi(hit.DOI);
    if (siteDois.has(doi) || ignore.has(doi)) continue;
    const meta = await crossref(doi);
    const html = formatAPA(meta, "articles");
    removeEntry(e.text);
    addEntry("articles", meta.year, html);
    upgraded.push({ from: e.text, to: html, section: "articles" });
  } catch (err) {
    failed.push(`In press lookup "${title.slice(0, 50)}..." (${err.message})`);
  }
}

// ---------- report ----------

const names = { articles: "Journal articles", chapters: "Book chapters", proceedings: "Proceedings", books: "Books" };
const L = [];
L.push(`Weekly sync from [ORCID ${ORCID}](https://orcid.org/${ORCID}), with metadata from Crossref and DataCite.`, "");
if (added.length) {
  L.push(`### Added (${added.length})`, "");
  for (const a of added) L.push(`- **${names[a.section]}, ${a.year}:** ${a.html}`);
  L.push("");
}
if (upgraded.length) {
  L.push(`### Updated now that they are published (${upgraded.length})`, "");
  for (const u of upgraded) L.push(`- Was: ${u.from}`, `  Now (**${names[u.section]}**): ${u.to}`);
  L.push("");
}
if (added.length || upgraded.length) {
  L.push(
    "**Please check before merging:** titles were converted to sentence case automatically, so proper nouns (countries, test names) may need a capital letter back. Journal names and author initials come from the publisher.",
    "",
    "To stop an item from coming back, delete it here and add its DOI to `data/sync-ignore.json`.",
    ""
  );
}
if (older.length) {
  L.push(`<details><summary>On ORCID but not on the site, from before ${SINCE} (${older.length}, not added)</summary>`, "");
  for (const o of older) L.push(`- ${o.year || "n.d."}: ${o.title} https://doi.org/${o.doi}`);
  L.push("", "</details>", "");
}
if (failed.length) L.push("Could not look up:", "", ...failed.map((f) => `- ${f}`), "");
const skipped = Object.entries(skippedTypes);
if (skipped.length) L.push(`Skipped ORCID items of other types: ${skipped.map(([t, n]) => `${t} (${n})`).join(", ")}.`);

const report = L.join("\n");
console.log(report);
if (SUMMARY) fs.writeFileSync(SUMMARY, report + "\n");
if (!DRY && out !== src) {
  fs.writeFileSync(PUB_FILE, out);
  console.log("\nUpdated data/publications.js");
}
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `changes=${added.length + upgraded.length}\n`);
