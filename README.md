# okanbulut.github.io

Academic portfolio website for **Okan Bulut**, deployed with GitHub Pages at
[okanbulut.github.io](https://okanbulut.github.io). Pure HTML/CSS/JS — no build
step, no dependencies. Push to `master` and the site updates.

## How to update content (the common tasks)

### ➕ Add a publication
Edit **`data/publications.js`**. Find the right section (`books`, `chapters`,
`articles`, `proceedings`, `underReview`) and add one quoted string in APA 7th
style. For journal articles, put it inside the matching year block (newest year
at the top — copy an existing year block to start a new year).

- Use `<em>...</em>` for italics (journal name + volume).
- Write DOIs as `https://doi.org/10.xxxx/...`; DOIs and URLs become clickable links automatically.
- "Bulut, O." is bolded automatically.

### ➕ Add a presentation
Edit **`data/presentations.js`** — same idea: `invited` list or the matching
year block in `conference`.

### ➕ Add a news item
Edit **`data/news.js`** and paste a new block at the **top** of the list:

```js
{
  date: "August 2026",
  html: "Some exciting news with <strong>bold</strong> and <a href='...'>links</a>.",
},
```

The home page shows items dated `NEWS_HOME_FROM_YEAR` (set at the top of
`data/news.js`) or later; older items move to the **News archive** page
(`news/`) automatically.

### 🖼️ Add your photo
Save your headshot as **`assets/img/profile.jpg`** (square, ~600×600 px works
best). The home page picks it up automatically — until then a placeholder shows.

### 📄 Add your CV PDF
Save it as **`assets/cv/Okan_Bulut_CV.pdf`**. The "Download Full CV" button on
the CV page points there.

### 🔗 Add a new page
Copy an existing page's `<head>` block (canonical link and `og:` tags point to
`https://www.okanbulut.com/<page>/`), then add the page to **`sitemap.xml`**.
The link-preview image is **`assets/img/share-card.png`** (1200×630).

## Where everything lives

| Content | File |
|---|---|
| Home (hero, about, news section) | `index.html` |
| Research areas, projects, lab members, alumni | `research/index.html` |
| Publications page shell | `publications/index.html` (content comes from `data/publications.js`) |
| Presentations page shell | `presentations/index.html` (content comes from `data/presentations.js`) |
| Software projects | `software/index.html` |
| Blog (lists posts from okan.cloud) | `posts/index.html` + `assets/js/blog.js` (at `/posts/`, because the `okanbulut/blog` repo already owns `okanbulut.com/blog/`) — reads the blog's RSS feed (`https://okan.cloud/index.xml`) in the browser, so new posts appear automatically after the blog is published |
| Teaching (courses, workshops, training) | `teaching/index.html` |
| CV (education, awards, editorial roles) | `cv/index.html` |
| Contact info and links | `contact/index.html` |
| All styling (light + dark themes) | `assets/css/style.css` |
| Site behavior (theme toggle, rendering, search) | `assets/js/main.js` |
| Research chatbot (widget, Vercel function, PDF ingest) | `assets/js/chat.js`, `rag/` — setup in `rag/README.md` |
| Co-author network (Research page) | `assets/js/network.js` — built automatically from `data/publications.js` and `data/presentations.js`; students/advisees colored from the Lab and Alumni sections. If one person shows up twice under different spellings, add them to `NAME_ALIASES` at the top of the file. |

## Automation (GitHub Actions)

These run on GitHub and never publish anything on their own: each one opens a
pull request (or an issue) for you to review. Merging is what updates the site.

**One-time setting:** Settings → Actions → General → Workflow permissions →
tick **"Allow GitHub Actions to create and approve pull requests"**.

| What | When | What it does |
|---|---|---|
| **Sync publications** (`.github/workflows/sync-publications.yml`) | Mondays, or *Actions → Sync publications → Run workflow* | Reads the [ORCID record](https://orcid.org/0000-0001-5853-1267), finds works not on the site, formats them in APA from Crossref/DataCite, and adds them to `data/publications.js`. Also swaps "(In press)" and "(Under review)" entries for the published version. Opens one pull request listing every change. Works older than two years are listed in the pull request but not added. To stop a work coming back, add its DOI to `data/sync-ignore.json`. Titles are converted to sentence case, so check proper nouns before merging. |
| **Site checks** (`.github/workflows/site-checks.yml`) | Every pull request, and Mondays | Checks that the data files load, DOIs are written as `https://doi.org/...`, every DOI is registered, and links work. On pull requests, data and DOI problems block merging; on the weekly run, problems go into one "Site check" issue that closes itself when all is well. |
| **Add news** (`.github/workflows/add-news.yml`) | When you open an issue with the *Add news* form | *Issues → New issue → Add news*: pick a month, choose **Home page only** or **Home page and My Lab page (lab news)**, and write the text (**bold**, *italic*, `[link](https://...)` and `- ` bullet lines work). A pull request adding it to `data/news.js` opens within a minute; merging it publishes the news and closes the issue. Editing the issue updates the pull request. Only you and collaborators can trigger it. |

The scripts live in `scripts/` (plain Node.js, no dependencies). To try one
locally: `node scripts/check-data.mjs` or `node scripts/sync-publications.mjs --dry-run`.

## Notes

- **Navigation** is repeated in each page's `<header>` — if you add a new page,
  add the link in every HTML file (9 files).
- **Colors**: the palette follows the University of Alberta's official green
  (#007C41) and gold (#FFDB05), defined as CSS variables at the top of
  `assets/css/style.css` (`--accent`, `--accent-2`, `--gradient`) for both the
  light and dark themes.
- **Dark mode** follows the visitor's system preference; the toggle in the nav
  stores the choice in `localStorage`.
- `.nojekyll` tells GitHub Pages to serve files as-is (no Jekyll processing).

## Preview locally

Any static server works, e.g.:

```
python -m http.server 8000
```

then open http://localhost:8000.
