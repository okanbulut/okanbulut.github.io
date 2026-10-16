/* ============================================================
   KEYWORD SEARCH (BM25) over the paper chunks.
   Used by rag/ingest (to build data/index.json) and by api/chat.js
   (to search it). Both sides must tokenize the same way, which is
   why the tokenizer lives here only.
   ============================================================ */

import { stemmer } from "stemmer";

const STOP = new Set((
  "a about above after again against all also am an and any are as at be because been before being below between both but by " +
  "can could did do does doing down during each either et al etc few for from further had has have having he her here hers " +
  "him his how however i if in into is it its itself just may me might more most much must my no nor not now of off on once " +
  "only or other our ours out over own per same she should so some such than that the their theirs them then there these they " +
  "this those through thus to too under until up upon us use used using very via was we were what when where whether which " +
  "while who whom why will with within without would yet you your study studies paper article research results result " +
  "findings finding found show shows shown showed also however table figure fig"
).split(" "));

// Porter stemming so "assessments", "assessing" and "assessment" meet in one term.
export function tokenize(text) {
  return text.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOP.has(w) && !/^\d{1,2}$/.test(w))
    .map((w) => (/^\d/.test(w) ? w : stemmer(w)));
}

// Short fingerprint of a citation, used to match the Publications page's
// entries to indexed papers. assets/js/chat.js has an identical copy:
// change both together.
export function citationKey(citation) {
  const s = citation.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
  let h = 0x811c9dc5; // FNV-1a, 32-bit
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/* ---------- index ---------- */

// docs: [{ text, title }] → { n, avgdl, len: [...], terms: { term: [doc, tf, doc, tf, ...] } }
export function buildIndex(docs) {
  const terms = new Map();
  const len = [];
  docs.forEach((d, i) => {
    const toks = tokenize(`${d.title} ${d.text}`);
    len.push(toks.length);
    const tf = new Map();
    for (const t of toks) tf.set(t, (tf.get(t) || 0) + 1);
    for (const [t, c] of tf) {
      if (!terms.has(t)) terms.set(t, []);
      terms.get(t).push(i, c);
    }
  });
  const avgdl = len.reduce((a, b) => a + b, 0) / Math.max(1, len.length);
  return { n: docs.length, avgdl, len, terms: Object.fromEntries(terms) };
}

/* ---------- search ---------- */

const K1 = 1.2;
const B = 0.75;

// Returns [{ doc, score }] best first, at most `perPaper` chunks from any
// one paper so a single long paper can't crowd out the rest. `filter(doc)`
// can restrict the search (e.g. to one paper).
export function search(index, query, { k = 8, perPaper = 3, paperOf = () => 0, filter = null } = {}) {
  const qTerms = [...new Set(tokenize(query))];
  const scores = new Map();
  for (const t of qTerms) {
    const post = index.terms[t];
    if (!post) continue;
    const df = post.length / 2;
    const idf = Math.log(1 + (index.n - df + 0.5) / (df + 0.5));
    for (let i = 0; i < post.length; i += 2) {
      const d = post[i];
      if (filter && !filter(d)) continue;
      const tf = post[i + 1];
      const norm = tf + K1 * (1 - B + B * (index.len[d] / index.avgdl));
      scores.set(d, (scores.get(d) || 0) + idf * (tf * (K1 + 1)) / norm);
    }
  }
  const ranked = [...scores].sort((a, b) => b[1] - a[1]);
  const out = [];
  const perPaperCount = new Map();
  for (const [doc, score] of ranked) {
    const p = paperOf(doc);
    const c = perPaperCount.get(p) || 0;
    if (c >= perPaper) continue;
    perPaperCount.set(p, c + 1);
    out.push({ doc, score });
    if (out.length >= k) break;
  }
  return out;
}
