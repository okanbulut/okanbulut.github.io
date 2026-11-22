// Helpers shared by the automation scripts in scripts/.
// The data files (data/*.js) are plain browser scripts that declare a const,
// so we run them in a sandbox and read the value back.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export function dataPath(name) {
  return path.join(ROOT, "data", name);
}

// Load a data file and return the value of the named const(s).
export function loadData(file, names) {
  const src = fs.readFileSync(dataPath(file), "utf8");
  const sandbox = {};
  const expose = names.map((n) => `__out.${n} = ${n};`).join("\n");
  vm.runInNewContext(`${src}\n;${expose}`, { __out: sandbox }, { filename: file });
  return sandbox;
}

// Every DOI written as https://doi.org/10.xxxx/... (or the legacy doi:10.xxxx form).
export function extractDois(text) {
  const out = [];
  const re = /(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)(10\.\d{4,9}\/[^\s"'<>\\]+)/gi;
  let m;
  while ((m = re.exec(text))) out.push(cleanDoi(m[1]));
  return out;
}

export function cleanDoi(doi) {
  return decodeURIComponent(String(doi).trim())
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .replace(/[.,;)\]]+$/, "")
    .toLowerCase();
}

// Lower-case letters and digits only, for fuzzy title matching.
export function squash(s) {
  return String(s)
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export async function getJson(url, headers = {}) {
  const res = await fetch(url, {
    headers: { "User-Agent": "website-content-sync (GitHub Actions)", Accept: "application/json", ...headers },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}
