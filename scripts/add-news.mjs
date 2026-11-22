// Turns an "Add news" GitHub issue (form in .github/ISSUE_TEMPLATE/add-news.yml)
// into a new item at the top of data/news.js.
// Usage: ISSUE_BODY="..." node scripts/add-news.mjs
// Simple formatting in the news text: **bold**, *italic*, [link text](https://...),
// and lines starting with "- " become a bulleted list. HTML also works.
import fs from "node:fs";
import { dataPath } from "./lib/data.mjs";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function parseForm(body) {
  const fields = {};
  const parts = String(body || "").replace(/\r\n/g, "\n").split(/^### +/m).slice(1);
  for (const part of parts) {
    const nl = part.indexOf("\n");
    const label = part.slice(0, nl).trim().toLowerCase();
    const value = part.slice(nl + 1).trim();
    fields[label] = value === "_No response_" ? "" : value;
  }
  const get = (word) => {
    const k = Object.keys(fields).find((x) => x.includes(word));
    return k ? fields[k] : "";
  };
  return { date: get("date"), where: get("where"), text: get("text") };
}

export function normalizeDate(input, now = new Date()) {
  const s = String(input || "").trim();
  if (!s) return `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  const m = s.match(/^([A-Za-z]+)\.?,?\s+(\d{4})$/);
  if (!m) throw new Error(`Date should look like "December 2026" (got "${s}")`);
  const month = MONTHS.find((x) => x.toLowerCase().startsWith(m[1].toLowerCase().slice(0, 3)));
  if (!month) throw new Error(`Unknown month "${m[1]}"`);
  return `${month} ${m[2]}`;
}

function inline(s) {
  return s
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (m, t, u) => `<a href='${u.replace(/'/g, "%27")}'>${t}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
    .replace(/(^|[\s(])_([^_\s][^_]*)_/g, "$1<em>$2</em>")
    .replace(/&(?![a-z]+;|#\d+;)/gi, "&amp;");
}

export function toHtml(text) {
  const lines = String(text).replace(/\r\n/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);
  let html = "";
  let inList = false;
  for (const line of lines) {
    const item = line.match(/^[-*•]\s+(.*)$/);
    if (item) {
      if (!inList) html += "<ul>";
      inList = true;
      html += `<li>${inline(item[1])}</li>`;
    } else {
      if (inList) html += "</ul>";
      inList = false;
      html += (html && !html.endsWith("</ul>") ? " " : "") + inline(line);
    }
  }
  if (inList) html += "</ul>";
  return html;
}

export function addNews(src, { date, lab, html }) {
  const marker = "const NEWS = [\n";
  const at = src.indexOf(marker);
  if (at < 0) throw new Error("Could not find `const NEWS = [` in data/news.js");
  const block = `  {\n  date: ${JSON.stringify(date)},\n${lab ? "  lab: true,\n" : ""}  html: ${JSON.stringify(html)},\n  },\n`;
  return src.slice(0, at + marker.length) + block + src.slice(at + marker.length);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const form = parseForm(process.env.ISSUE_BODY);
  if (!form.text) {
    console.error("The news text is empty.");
    process.exit(1);
  }
  const item = { date: normalizeDate(form.date), lab: /lab/i.test(form.where), html: toHtml(form.text) };
  const file = dataPath("news.js");
  fs.writeFileSync(file, addNews(fs.readFileSync(file, "utf8"), item));
  const summary = [
    `**Date:** ${item.date}`,
    `**Shows on:** ${item.lab ? "Home page news and the Lab news section of My Lab" : "Home page news"}`,
    "",
    "**Text as it will appear:**",
    "",
    `> ${item.html}`,
  ].join("\n");
  console.log(summary);
  if (process.env.SUMMARY_FILE) fs.writeFileSync(process.env.SUMMARY_FILE, summary + "\n");
}
