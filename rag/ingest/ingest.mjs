/* ============================================================
   RAG INGEST — turns the PDFs in rag/papers/ into searchable chunks.
   ------------------------------------------------------------
   For each PDF it:
     1. extracts the text (drops repeated headers/footers and the
        reference list),
     2. matches the paper to its citation in data/publications.js
        (gives the chatbot a title, year and DOI link to cite),
     3. splits the text into overlapping ~400-token chunks,
     4. builds a keyword-search (BM25) index over all chunks and writes
        it to rag/vercel/data/index.json, which the Vercel function
        searches. Everything runs locally: no accounts, no quotas.

   Usage (from rag/ingest/):
     node ingest.mjs     rebuild the index; also writes out/report.txt
                         (matching + text quality) and out/chunks.jsonl
   Then redeploy the function: cd ../vercel && npx vercel deploy --prod

   The index holds the papers' text, so it is git-ignored and only
   ever leaves your computer inside the private Vercel deployment.

   rag/papers/manifest.json records which citation each PDF matched.
   If a match is wrong, edit that entry and set "manual": true —
   the script then keeps your values on later runs.
   ============================================================ */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { extractText, getDocumentProxy, getMeta } from "unpdf";
import { buildIndex } from "../vercel/lib/search.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const PAPERS_DIR = path.join(ROOT, "rag", "papers");
const MANIFEST_PATH = path.join(PAPERS_DIR, "manifest.json");
const OUT_DIR = path.join(HERE, "out");
const INDEX_PATH = path.join(ROOT, "rag", "vercel", "data", "index.json");
const PUBLICATIONS_PATH = path.join(ROOT, "data", "publications.js");

const CHUNK_CHARS = 1800;    // ~400 tokens: enough context per excerpt
const OVERLAP_CHARS = 300;
const MATCH_THRESHOLD = 0.8; // share of title words found on pages 1-2

/* ---------- citations from data/publications.js ---------- */

function decodeEntities(s) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
}

function plainText(html) {
  return decodeEntities(html.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

function loadCitations() {
  const src = fs.readFileSync(PUBLICATIONS_PATH, "utf8");
  const pubs = vm.runInNewContext(src + "\n;PUBLICATIONS", {});
  const out = [];
  const add = (entry, section, rank) => {
    const html = typeof entry === "string" ? entry : entry.html;
    const citation = plainText(html);
    // APA: "Authors (Year). Title. Source..." — title runs to the first . ? or !
    const m = citation.match(/\(([^)]*)\)\.\s+(.+?[.?!])(\s|$)/);
    if (!m) return;
    // "Is it worth the effort? A comparison of …" — a short question is only
    // the first half of the title, so run on to the subtitle's period.
    if (/\?$/.test(m[2]) && words(m[2]).length < 4) {
      const longer = citation.slice(citation.indexOf(m[2])).match(/^(.+?\.)(\s|$)/);
      if (longer) m[2] = longer[1];
    }
    const doi = citation.match(/doi:\s*(10\.\S+?)[.,;]?(\s|$)/i);
    const link = citation.match(/https?:\/\/\S+?(?=[.,;]?(\s|$))/);
    out.push({
      citation,
      year: m[1],
      title: m[2].replace(/[.]$/, ""),
      url: doi ? "https://doi.org/" + doi[1] : (link ? link[0] : (entry.url || "")),
      section,
      rank, // lower wins when a paper appears in two sections
    });
  };
  (pubs.articles || []).forEach((y) => y.items.forEach((e) => add(e, "articles", 0)));
  (pubs.chapters || []).forEach((e) => add(e, "chapters", 1));
  (pubs.books || []).forEach((e) => add(e, "books", 1));
  (pubs.proceedings || []).forEach((e) => add(e, "proceedings", 1));
  (pubs.underReview || []).forEach((e) => add(e, "underReview", 2));
  return out;
}

const STOP = new Set("the and for with from into that this their using use via its are was were how what when does between among across based".split(" "));
function words(s) {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
}

// Finds the citation for a PDF from its filename, metadata title and the top
// of page 1. Strongest evidence first:
//   1. the full title appears word-for-word (longest such title wins),
//   2. the filename is the start of a title (titles with a subtitle),
//   3. most title words appear — `ambiguous` if a different title scores
//      almost as well (e.g. a CV or a whole proceedings volume).
function matchCitation(probeText, fileName, citations) {
  const probeWords = words(probeText + " " + fileName);
  const probe = new Set(probeWords);
  const probeSeq = " " + probeWords.join(" ") + " ";
  const fileSeq = words(fileName).join(" ");
  const better = (a, b) => !b || a.score > b.score || (a.score === b.score && (a.len > b.len || (a.len === b.len && a.c.rank < b.c.rank)));

  let exact = null;
  let prefix = null;
  const scored = [];
  for (const c of citations) {
    const tw = words(c.title);
    if (tw.length < 3) continue;
    const seq = tw.join(" ");
    if (probeSeq.includes(" " + seq + " ")) {
      const cand = { c, score: 1, len: tw.length };
      if (better(cand, exact)) exact = cand;
    }
    if (fileSeq.split(" ").length >= 4 && (seq + " ").startsWith(fileSeq + " ")) {
      const cand = { c, score: 1, len: tw.length };
      if (better(cand, prefix)) prefix = cand;
    }
    scored.push({ c, score: tw.filter((w) => probe.has(w)).length / tw.length, len: tw.length, seq });
  }
  if (exact) return { ...exact, how: "title" };
  if (prefix) return { ...prefix, how: "filename" };

  scored.sort((a, b) => (better(a, b) ? -1 : better(b, a) ? 1 : 0));
  const best = scored[0];
  if (!best) return null;
  const rival = scored.find((s) => s.seq !== best.seq);
  best.ambiguous = !!rival && rival.score >= MATCH_THRESHOLD && best.score - rival.score < 0.1;
  best.how = "words";
  return best;
}

/* ---------- PDF text ---------- */

function splitLines(pageText) {
  return pageText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

async function readPdf(file) {
  const buf = new Uint8Array(fs.readFileSync(file));
  const pdf = await getDocumentProxy(buf, { verbosity: 0 }); // silence font warnings
  let metaTitle = "";
  try { metaTitle = (await getMeta(pdf)).info?.Title || ""; } catch { /* no metadata */ }
  const { text: rawPages } = await extractText(pdf, { mergePages: false });

  // PDFs with a broken font encoding extract as control characters instead
  // of letters. A few stray ones (math symbols) are just removed; a text layer
  // that is mostly junk is flagged so the paper can be OCR'd instead.
  const JUNK = /[\u0000-\u0008\u000b\u000c\u000e-\u001f�]/g;
  const all = rawPages.join("");
  const junk = (all.match(JUNK) || []).length;
  const garbled = junk / Math.max(1, all.replace(/\s/g, "").length) > 0.05;
  const pages = rawPages.map((p) => p.replace(JUNK, " "));

  // Running headers/footers: short lines in the top or bottom 3 lines of a
  // page that recur (ignoring numbers) on many pages.
  const edges = (lines) => new Set([...lines.slice(0, 3), ...lines.slice(-3)].filter((l) => l.length < 150));
  const counts = new Map();
  pages.forEach((p) => new Set([...edges(splitLines(p))].map(norm)).forEach((l) => counts.set(l, (counts.get(l) || 0) + 1)));
  const isRunning = (l) => pages.length >= 4 && (counts.get(norm(l)) || 0) >= Math.max(3, pages.length * 0.4);

  const cleanPages = pages.map((p) => {
    const lines = splitLines(p);
    const edge = edges(lines);
    return lines.filter((l) => !(edge.has(l) && isRunning(l)) && !/^\d{1,4}$/.test(l)).join("\n")
      .replace(/(\w)-\n(\w)/g, "$1$2") // re-join hyphenated words
      .replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ").trim();
  });
  // The title sits near the top of page 1 (after any journal header block).
  return { pages: cleanPages, titleArea: (pages[0] || "").slice(0, 2500), metaTitle, garbled };
}

function norm(l) { return l.toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " "); }

// Drop the reference list: everything from the last "References" heading
// in the second half of the paper.
function stripReferences(pages) {
  const total = pages.reduce((n, p) => n + p.length, 0);
  let seen = 0;
  let cut = null;
  pages.forEach((p, i) => {
    const re = /\b(References|REFERENCES|Bibliography|Works Cited)\b(?!\s+(to|in|of|for)\b)/g;
    let m;
    while ((m = re.exec(p))) {
      if (seen + m.index > total * 0.5) cut = { page: i, index: m.index };
    }
    seen += p.length;
  });
  if (!cut) return pages;
  const kept = pages.slice(0, cut.page + 1);
  kept[cut.page] = kept[cut.page].slice(0, cut.index);
  return kept;
}

/* ---------- chunking ---------- */

// Cut text longer than a chunk at the last space before the limit.
function hardSplit(s) {
  const parts = [];
  while (s.length > CHUNK_CHARS) {
    let cut = s.lastIndexOf(" ", CHUNK_CHARS);
    if (cut < CHUNK_CHARS / 2) cut = CHUNK_CHARS;
    parts.push(s.slice(0, cut));
    s = s.slice(cut).trimStart();
  }
  if (s) parts.push(s);
  return parts;
}

function chunkPages(pages) {
  const sentences = [];
  pages.forEach((p, i) => {
    p.split(/(?<=[.!?])\s+(?=[A-Z(\["“])/).forEach((s) => s && sentences.push({ s, page: i + 1 }));
  });
  const chunks = [];
  let cur = [];
  let len = 0;
  const flush = () => {
    if (!cur.length) return;
    chunks.push({ text: cur.map((x) => x.s).join(" "), page: cur[0].page });
    // carry the last few sentences over as overlap
    const keep = [];
    let k = 0;
    for (let i = cur.length - 1; i >= 0 && k < OVERLAP_CHARS; i--) {
      if (cur[i].s.length > OVERLAP_CHARS * 2) break; // don't repeat a whole long passage
      keep.unshift(cur[i]);
      k += cur[i].s.length;
    }
    cur = keep.length < cur.length ? keep : [];
    len = cur.reduce((n, x) => n + x.s.length + 1, 0);
  };
  for (const item of sentences) {
    // hard-split runaway "sentences" (tables, equations)
    const parts = hardSplit(item.s);
    for (const s of parts) {
      if (len + s.length > CHUNK_CHARS && len > 0) flush();
      cur.push({ s: s.trim(), page: item.page });
      len += s.length + 1;
    }
  }
  if (cur.length && (chunks.length === 0 || len > OVERLAP_CHARS * 1.5)) flush();
  return chunks.filter((c) => c.text.length > 200);
}

/* ---------- main ---------- */

function slugFor(file) {
  const base = path.basename(file, path.extname(file)).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const hash = crypto.createHash("sha1").update(path.basename(file)).digest("hex").slice(0, 6);
  return `${base.slice(0, 40)}-${hash}`;
}

async function main() {
  const files = fs.readdirSync(PAPERS_DIR).filter((f) => f.toLowerCase().endsWith(".pdf")).sort();
  if (!files.length) {
    console.log(`No PDFs found in ${PAPERS_DIR}. Drop your papers there and run again.`);
    return;
  }
  const citations = loadCitations();
  const old = fs.existsSync(MANIFEST_PATH) ? JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) : {};
  const manifest = {};
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const report = [];
  const papers = [];  // { title, year, url, citation }
  const chunks = [];  // { p: paper index, page, text }

  for (const file of files) {
    const full = path.join(PAPERS_DIR, file);
    if (!fs.existsSync(full)) continue; // removed while the script was running
    process.stdout.write(`\rReading ${papers.length + 1}/${files.length}…`);
    const prev = old[file] || {};

    let pdf;
    try {
      pdf = await readPdf(full);
    } catch (err) {
      report.push(`FAILED   ${file}: could not read PDF (${err.message})`);
      continue;
    }

    let entry;
    if (prev.manual) {
      entry = { title: prev.title, year: prev.year, url: prev.url, citation: prev.citation };
    } else {
      const best = matchCitation(pdf.metaTitle + " " + pdf.titleArea, path.basename(file, path.extname(file)), citations);
      const ok = best && best.score >= MATCH_THRESHOLD && !best.ambiguous;
      entry = ok
        ? { title: best.c.title, year: best.c.year, url: best.c.url, citation: best.c.citation, matchScore: +best.score.toFixed(2) }
        : { title: pdf.metaTitle || path.basename(file, ".pdf"), year: "", url: "", citation: "", matchScore: best ? +best.score.toFixed(2) : 0 };
      report.push(ok
        ? `matched  ${file}  →  ${best.c.title} (${best.c.year}) [${best.how} ${entry.matchScore}]`
        : `NO MATCH ${file}  (${best?.ambiguous ? "several titles match" : `best guess: "${best?.c.title ?? "-"}", score ${entry.matchScore}`}) — edit manifest.json and set "manual": true`);
    }

    const pages = stripReferences(pdf.pages);
    const paperChunks = pdf.garbled ? [] : chunkPages(pages);
    const textChars = pages.reduce((n, p) => n + p.length, 0);
    if (pdf.garbled) report.push(`SKIPPED  ${file}: the text layer is garbled (broken font encoding) — run OCR on the PDF and rerun`);
    else if (textChars < 2000) report.push(`WARNING  ${file}: very little text (${textChars} chars) — is it a scanned PDF without OCR?`);

    if (paperChunks.length) {
      const p = papers.push({ title: entry.title, year: entry.year, url: entry.url, citation: entry.citation }) - 1;
      for (const c of paperChunks) chunks.push({ p, page: c.page, text: c.text });
    }
    manifest[file] = { ...entry, manual: !!prev.manual, slug: prev.slug || slugFor(file), chunks: paperChunks.length };
  }
  process.stdout.write("\n");

  for (const file of Object.keys(old)) {
    if (!manifest[file]) report.push(`removed  ${file} (no longer in rag/papers/)`);
  }

  const index = buildIndex(chunks.map((c) => ({ title: papers[c.p].title, text: c.text })));
  fs.mkdirSync(path.dirname(INDEX_PATH), { recursive: true });
  fs.writeFileSync(INDEX_PATH, JSON.stringify({ built: new Date().toISOString(), papers, chunks, index }));

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
  fs.writeFileSync(path.join(OUT_DIR, "chunks.jsonl"), chunks.map((c) => JSON.stringify({ ...c, title: papers[c.p].title })).join("\n") + "\n");
  const mb = (fs.statSync(INDEX_PATH).size / 1e6).toFixed(1);
  const summary = `${files.length} PDFs → ${papers.length} papers, ${chunks.length} chunks. Index: ${path.relative(ROOT, INDEX_PATH)} (${mb} MB)`;
  fs.writeFileSync(path.join(OUT_DIR, "report.txt"), report.join("\n") + "\n\n" + summary + "\n");
  console.log(report.filter((l) => !l.startsWith("matched")).join("\n"));
  console.log(`\n${report.filter((l) => l.startsWith("matched")).length} matched to citations (full list in out/report.txt)`);
  console.log(summary);
  console.log("Next: cd ../vercel && npx vercel deploy --prod");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
