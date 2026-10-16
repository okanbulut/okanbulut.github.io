# Research chatbot ("Ask about my research")

A chat widget on the Publications page that answers visitors' questions from
the **full text of your papers** and cites them, with each source linking to its
DOI.

```
Browser widget (assets/js/chat.js) ──▶ Vercel function (rag/vercel/api/chat.js)
                                          Claude decides what to search for,
                                          calls search_papers (keyword search
                                          over data/index.json), may search again,
                                          then streams an answer citing [n]
Your PDFs (rag/papers, private) ──▶ ingest script (rag/ingest) ──▶ rag/vercel/data/index.json
```

GitHub Pages only serves static files, so the Claude API key and the search live
in a small Vercel function. Your PDFs never leave your computer. The search
index (the papers' text) is git-ignored, so it never reaches the public GitHub
repo; it's uploaded only inside the Vercel deployment. The bot links to DOIs,
never to PDFs.

Features:
- **Ask AI buttons:** on the Publications page, every paper the chatbot has
  gets an "Ask AI" button. It opens a chat focused on that paper (searches stay
  inside it) and asks for its main findings. Papers without a PDF in
  `rag/papers/`, or whose PDF didn't match a citation, get no button.
- **Suggested follow-ups:** after each answer, three clickable next questions.
- **Any language:** visitors can ask in any language; answers come back in the
  same language, while searches run in English.

Search is keyword-based (BM25), so it needs no embedding service or quotas.
Claude turns each question into the technical terms a paper would use, so
casual wording still finds the right papers.

---

## One-time setup

You need **Node.js** (installed at `%LOCALAPPDATA%\node`; in a new PowerShell
window run `$env:Path = "$env:LOCALAPPDATA\node;$env:Path"` first), a free
**Vercel** account (sign up at vercel.com with GitHub; no card needed), and an
**Anthropic API key** (console.anthropic.com).

### 1. Install dependencies

```bash
cd rag/vercel && npm install && cd ../ingest && npm install
```

### 2. Build the search index

Put the PDFs in `rag/papers/`, then:

```bash
cd rag/ingest
node ingest.mjs
```

Check the output. For any `NO MATCH`, open `rag/papers/manifest.json`, fill in
`title`, `year`, `url` and `citation` for that file, set `"manual": true`, and
rerun. Unmatched papers are still searchable but are cited by filename without a
link. `SKIPPED` papers have a garbled or missing text layer: run OCR on them
(e.g. Adobe Acrobat → Scan & OCR) and rerun.

### 3. Deploy the function

```bash
cd rag/vercel
npx vercel login
npx vercel deploy --prod
```

The first deploy asks a few setup questions; the defaults are fine. Then add your
Claude key and redeploy so the function picks it up:

```bash
npx vercel env add ANTHROPIC_API_KEY production
npx vercel deploy --prod
```

Open `https://<your-project>.vercel.app/api/chat` in a browser. It should show
`{"ok":true,"papers":…,"chunks":…}`.

### 4. Turn on the widget

In `publications/index.html`, set the chat script's `data-endpoint` to your
function URL:

```html
<script src="../assets/js/chat.js" data-endpoint="https://<your-project>.vercel.app/api/chat"></script>
```

To show it on other pages too, add the same line (with the right `../` path)
after `main.js` on those pages. Commit and push, and the site updates.

---

## Day-to-day

- **New paper:** add its citation to `data/publications.js` as usual, drop the
  PDF in `rag/papers/`, run `node ingest.mjs` in `rag/ingest`, then
  `npx vercel deploy --prod` in `rag/vercel`. Removing a PDF from the folder
  removes it from the chatbot the same way.
- **Test locally:** add `http://localhost:8000` to the allowed origins (Vercel
  dashboard → Settings → Environment Variables → `ALLOWED_ORIGINS`,
  comma-separated, including your real domains) and redeploy.

## Cost and limits

- **Vercel:** the free Hobby plan covers a personal academic site.
- **Claude:** the function uses `claude-haiku-5-5`, Anthropic's fast, low-cost
  model. A typical question takes one search and one answer, about 6–8K input
  tokens, which comes to **well under a cent per question** (roughly $1 per
  1,000 questions). For more careful answers, set a `MODEL` environment variable
  in Vercel to `claude-opus-5-5` (roughly $0.04 per question) and redeploy.
- **Abuse protection:** requests only from your site's domains, a
  600-character question limit, at most 3 searches per answer, and a
  best-effort limit of 8 questions per minute per visitor. The real ceiling is a
  **monthly spend limit** in the Anthropic Console (Settings → Limits); set one.
- **Privacy:** questions aren't stored. Vercel keeps its standard request logs.

## Files

| Path | What it is |
|---|---|
| `rag/papers/` | Your PDFs plus `manifest.json` (git-ignored, private) |
| `rag/ingest/ingest.mjs` | PDF → text → chunks → keyword index |
| `rag/vercel/api/chat.js` | The chat endpoint: Claude, the search tool, streaming |
| `rag/vercel/lib/search.js` | Tokenizer and BM25 search (shared with the ingest) |
| `rag/vercel/data/index.json` | The built index (git-ignored; bundled into the function, never served as a file) |
| `rag/vercel/public/` | The only folder Vercel serves as static files (`outputDirectory` in `vercel.json`). Keep data out of it. |
| `assets/js/chat.js` | The chat widget (styles at the end of `assets/css/style.css`) |
