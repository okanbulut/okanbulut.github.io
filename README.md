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
- DOIs (`doi:10.xxxx/...`) and URLs become clickable links automatically.
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

### 🖼️ Add your photo
Save your headshot as **`assets/img/profile.jpg`** (square, ~600×600 px works
best). The home page picks it up automatically — until then a placeholder shows.

### 📄 Add your CV PDF
Save it as **`assets/cv/Okan_Bulut_CV.pdf`**. The "Download Full CV" button on
the CV page points there.

## Where everything lives

| Content | File |
|---|---|
| Home (hero, about, news section) | `index.html` |
| Research areas, projects, lab members, alumni | `research/index.html` |
| Publications page shell | `publications/index.html` (content comes from `data/publications.js`) |
| Presentations page shell | `presentations/index.html` (content comes from `data/presentations.js`) |
| Software projects | `software/index.html` |
| Teaching (courses, workshops, training) | `teaching/index.html` |
| CV (education, awards, editorial roles) | `cv/index.html` |
| Contact info and links | `contact/index.html` |
| All styling (light + dark themes) | `assets/css/style.css` |
| Site behavior (theme toggle, rendering, search) | `assets/js/main.js` |

## Notes

- **Navigation** is repeated in each page's `<header>` — if you add a new page,
  add the link in every HTML file (8 files).
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
