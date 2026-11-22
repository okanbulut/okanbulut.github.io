/* ==========================================================================
   Okan Bulut — Academic Portfolio
   Site behavior: theme toggle, mobile nav, reveal animations, and
   rendering of the data files (data/publications.js, data/presentations.js,
   data/news.js) into the pages.
   You should not need to edit this file to update content — edit the
   files in /data instead.
   ========================================================================== */

(function () {
  "use strict";

  /* ---------- theme toggle ---------- */

  var toggle = document.getElementById("theme-toggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var cur = document.documentElement.getAttribute("data-theme");
      var next = cur === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) { /* private mode */ }
    });
  }

  /* ---------- mobile nav ---------- */

  var burger = document.getElementById("nav-burger");
  var nav = document.getElementById("site-nav");
  if (burger && nav) {
    burger.addEventListener("click", function () {
      nav.classList.toggle("open");
      burger.setAttribute("aria-expanded", nav.classList.contains("open"));
    });
  }

  /* ---------- expandable diagram tiles (research page) ---------- */

  document.querySelectorAll(".rp-expand").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", open ? "false" : "true");
      var detail = btn.querySelector(".rp-detail");
      if (detail) detail.hidden = open;
    });
  });

  /* ---------- reveal on scroll ---------- */

  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealEls.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("in");
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.08 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------- citation helpers ---------- */

  // Bold "Bulut, O." and make DOIs / URLs clickable.
  // Segments that are already links (<a>...</a>) are left untouched.
  function enhanceCitation(html) {
    return html.split(/(<a\b[^>]*>[\s\S]*?<\/a>)/g).map(function (seg) {
      if (/^<a\b/.test(seg)) return seg;
      // linkify bare URLs
      seg = seg.replace(/(^|[\s(>])((?:https?:\/\/)[^\s<)]+)/g, function (m, pre, url) {
        var trimmed = url.replace(/[.,;]+$/, "");
        var trail = url.slice(trimmed.length);
        return pre + '<a href="' + trimmed + '" target="_blank" rel="noopener">' + trimmed + "</a>" + trail;
      });
      // linkify legacy doi:10.xxxx/yyyy, shown in the https://doi.org/ form
      seg = seg.replace(/doi:\s*(10\.[^\s<(]+?)([.,;]?)(?=(\s|<|\(|$))/g, function (m, doi, punct) {
        var url = "https://doi.org/" + doi;
        return '<a href="' + url + '" target="_blank" rel="noopener">' + url + "</a>" + punct;
      });
      // bold his name
      seg = seg.replace(/Bulut, O\./g, "<strong>Bulut, O.</strong>");
      return seg;
    }).join("");
  }

  // Items are strings, or objects { html: "...", note: "..." } when an
  // indented note should appear below the citation.
  function citeList(items, ListTag) {
    var list = document.createElement(ListTag || "ul");
    list.className = "cite-list";
    items.forEach(function (it) {
      var li = document.createElement("li");
      var html = typeof it === "string" ? it : it.html;
      li.innerHTML = enhanceCitation(html);
      if (typeof it === "object" && it.note) {
        var note = document.createElement("div");
        note.className = "cite-note";
        note.innerHTML = enhanceCitation(it.note);
        li.appendChild(note);
      }
      list.appendChild(li);
    });
    return list;
  }

  // Build a gallery of clickable book covers from entries that carry a
  // `cover` field. Duplicate covers (e.g. several chapters in the same book)
  // are shown once. Covers whose image file is missing remove themselves via
  // onerror, so covers can be added incrementally. Returns null if none.
  function coverGallery(items) {
    var seen = {};
    var cards = [];
    items.forEach(function (it) {
      if (typeof it !== "object" || !it.cover) return;
      if (seen[it.cover]) return;
      seen[it.cover] = true;

      // Derive alt text from the italic title in the citation, tags stripped.
      var title = "";
      var m = /<em>([\s\S]*?)<\/em>/.exec(it.html || "");
      if (m) title = m[1].replace(/<[^>]*>/g, "").trim();

      // Link target: explicit url, else the first link inside the citation.
      var href = it.url;
      if (!href) {
        var a = /<a\b[^>]*href="([^"]+)"/.exec(it.html || "");
        if (a) href = a[1];
      }

      var img = document.createElement("img");
      // Attach the error handler before setting src so a missing cover file
      // (404) always removes its card — the gallery only shows covers that
      // actually exist. Loaded eagerly (few covers) so this fires reliably.
      img.alt = title;
      img.onerror = function () {
        var card = img.parentNode;
        var gal = card && card.parentNode;
        if (gal) {
          gal.removeChild(card);
          // Drop the whole gallery once its last cover is gone, so no empty
          // margin-gap remains above the citation list.
          if (!gal.querySelector(".cover-card") && gal.parentNode) {
            gal.parentNode.removeChild(gal);
          }
        }
      };
      img.src = it.cover;

      var card;
      if (href) {
        card = document.createElement("a");
        card.className = "cover-card";
        card.href = href;
        card.target = "_blank";
        card.rel = "noopener";
        if (title) card.title = title;
      } else {
        card = document.createElement("div");
        card.className = "cover-card";
      }
      card.appendChild(img);
      cards.push(card);
    });

    if (!cards.length) return null;
    var gallery = document.createElement("div");
    gallery.className = "cover-gallery";
    cards.forEach(function (c) { gallery.appendChild(c); });
    return gallery;
  }

  function sectionEl(id, title, note, count) {
    var sec = document.createElement("section");
    sec.className = "cite-section";
    sec.id = id;
    var h = document.createElement("h2");
    h.innerHTML = title + ' <span class="count-pill">' + count + "</span>";
    sec.appendChild(h);
    if (note) {
      var p = document.createElement("p");
      p.className = "section-note";
      p.innerHTML = note;
      sec.appendChild(p);
    }
    return sec;
  }

  // Each year is a collapsible <details>; the newest OPEN_YEARS start open.
  var OPEN_YEARS = 2;
  function yearBlocks(container, groups) {
    groups.forEach(function (g, i) {
      var block = document.createElement("details");
      block.className = "year-block";
      block.id = "y-" + g.year.replace(/\W+/g, "-").toLowerCase();
      if (i < OPEN_YEARS) { block.open = true; block.setAttribute("data-default-open", ""); }
      var summary = document.createElement("summary");
      var h = document.createElement("h3");
      h.innerHTML = g.year + ' <span class="year-count">' + g.items.length + "</span>";
      summary.appendChild(h);
      block.appendChild(summary);
      block.appendChild(citeList(g.items));
      container.appendChild(block);
    });
  }

  // A link to #y-2024 (or a section that holds it) opens that year.
  function openFromHash() {
    var id = decodeURIComponent(window.location.hash.slice(1));
    var target = id && document.getElementById(id);
    if (target && target.tagName === "DETAILS") target.open = true;
  }
  window.addEventListener("hashchange", openFromHash);

  /* ---------- publications page ---------- */

  var pubsRoot = document.getElementById("pubs-root");
  if (pubsRoot && typeof PUBLICATIONS !== "undefined") {
    var P = PUBLICATIONS;
    var nArticles = P.articles.reduce(function (n, g) { return n + g.items.length; }, 0);

    var secBooks = sectionEl("books", "Books", "", P.books.length);
    var booksGallery = coverGallery(P.books);
    if (booksGallery) secBooks.appendChild(booksGallery);
    secBooks.appendChild(citeList(P.books));
    pubsRoot.appendChild(secBooks);

    var secCh = sectionEl("chapters", "Book Chapters", "", P.chapters.length);
    var chGallery = coverGallery(P.chapters);
    if (chGallery) secCh.appendChild(chGallery);
    secCh.appendChild(citeList(P.chapters));
    pubsRoot.appendChild(secCh);

    var secArt = sectionEl("articles", "Refereed Journal Articles & Preprints", "", nArticles);
    yearBlocks(secArt, P.articles);
    pubsRoot.appendChild(secArt);

    var secPro = sectionEl("proceedings", "Conference Proceedings", "", P.proceedings.length);
    secPro.appendChild(citeList(P.proceedings));
    pubsRoot.appendChild(secPro);

    var secUR = sectionEl("under-review", "Manuscripts Under Review", "", P.underReview.length);
    secUR.appendChild(citeList(P.underReview));
    pubsRoot.appendChild(secUR);

    openFromHash();
    fillCounts({ books: P.books.length, chapters: P.chapters.length, articles: nArticles,
                 proceedings: P.proceedings.length, "under-review": P.underReview.length });
    wireSearch(pubsRoot);
  }

  /* ---------- presentations page ---------- */

  var presRoot = document.getElementById("pres-root");
  if (presRoot && typeof PRESENTATIONS !== "undefined") {
    var R = PRESENTATIONS;
    var nConf = R.conference.reduce(function (n, g) { return n + g.items.length; }, 0);

    var secInv = sectionEl("invited", "Invited Talks", "", R.invited.length);
    secInv.appendChild(citeList(R.invited));
    presRoot.appendChild(secInv);

    var secConf = sectionEl("conference", "Conference Presentations", "", nConf);
    yearBlocks(secConf, R.conference);
    presRoot.appendChild(secConf);

    openFromHash();
    fillCounts({ invited: R.invited.length, conference: nConf });
    wireSearch(presRoot);
  }

  /* ---------- My Lab: recent work with lab members ---------- */

  // Lists publications and presentations that have a current student or a
  // former advisee as a co-author. Names come from the #lab cards and the
  // #alumni list on the same page, matched as first initial + last name, so
  // nothing here needs editing when a citation or a student is added.
  var LAB_WORK_YEARS = 3;   // how many recent years to list
  var labWorkRoot = document.getElementById("lab-work-root");
  if (labWorkRoot && typeof PUBLICATIONS !== "undefined") {
    var fold = function (t) {
      return t.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i")
        .replace(/[\-‐-―]/g, " ").replace(/\s+/g, " ").trim();
    };
    var members = [];
    document.querySelectorAll("#lab .person h3, #alumni li strong").forEach(function (el) {
      var tokens = fold(el.textContent).split(" ");
      if (tokens.length > 1) members.push({ initial: tokens[0].charAt(0), tail: " " + tokens.slice(1).join(" ") + " " });
    });
    var AUTHOR_RE = /([A-ZÀ-Žİ][^,]*?),\s*((?:[A-ZÀ-Žİ]\.(?:\s?-?[A-ZÀ-Žİ]\.)*\s?)+)/g;
    var LEAD_RE = /^([\s\S]*?)\s*\(((?:19|20)\d{2}|In press)[^)]*\)/;
    var isMember = function (last, initials) {
      var i = fold(initials).charAt(0), l = " " + fold(last) + " ";
      return members.some(function (m) { return m.initial === i && m.tail.indexOf(l) !== -1; });
    };
    // Returns { year, html } with lab members' names marked, or null.
    var labEntry = function (entry) {
      var html = typeof entry === "string" ? entry : entry.html;
      var m = html.match(LEAD_RE);
      if (!m) return null;
      var authors = m[1], hit = false, a;
      var marked = authors;
      AUTHOR_RE.lastIndex = 0;
      while ((a = AUTHOR_RE.exec(authors.replace(/&amp;/g, ",")))) {
        if (!isMember(a[1].trim(), a[2])) continue;
        hit = true;
        var name = a[1].trim() + ", " + a[2].trim();
        marked = marked.replace(name, '<span class="lab-author">' + name + "</span>");
      }
      if (!hit) return null;
      return { year: m[2], html: marked + html.slice(m[1].length) };
    };
    var collect = function (lists) {
      var out = [];
      lists.forEach(function (list) {
        (list || []).forEach(function (e) { var w = labEntry(e); if (w) out.push(w); });
      });
      return out;
    };
    var flat = function (groups) { return (groups || []).map(function (g) { return g.items; }); };
    var P = PUBLICATIONS;
    var pubs = collect([P.books, P.chapters, P.proceedings].concat(flat(P.articles)));
    var talks = typeof PRESENTATIONS !== "undefined"
      ? collect([PRESENTATIONS.invited].concat(flat(PRESENTATIONS.conference))) : [];

    buildPaperShowcase(collect(flat(P.articles)));

    var all = pubs.concat(talks).filter(function (w) { return /^\d/.test(w.year); });
    var newest = Math.max.apply(null, all.map(function (w) { return +w.year; }));
    var fromYear = newest - LAB_WORK_YEARS + 1;
    var summary = document.getElementById("lab-work-summary");
    if (summary) {
      summary.innerHTML = "Below is the work from " + fromYear +
        " on, with lab members’ names highlighted.";
    }

    // Group newest first; "In press" comes before the years.
    var byYear = function (works) {
      var groups = {}, order = [];
      works.forEach(function (w) {
        if (w.year !== "In press" && +w.year < fromYear) return;
        if (!groups[w.year]) { groups[w.year] = []; order.push(w.year); }
        groups[w.year].push(w.html);
      });
      order.sort(function (x, y) { return (y === "In press") - (x === "In press") || y - x; });
      return order.map(function (y) { return { year: y, items: groups[y] }; });
    };
    [["lab-pubs", "Publications", pubs], ["lab-talks", "Presentations", talks]].forEach(function (s) {
      var groups = byYear(s[2]);
      if (!groups.length) return;
      var n = groups.reduce(function (k, g) { return k + g.items.length; }, 0);
      var sec = sectionEl(s[0], s[1], "", n);
      yearBlocks(sec, groups);
      // Only the newest year starts open here, to keep the page short.
      sec.querySelectorAll(".year-block").forEach(function (b, i) {
        b.id = s[0] + "-" + b.id;
        if (i > 0) { b.open = false; b.removeAttribute("data-default-open"); }
      });
      labWorkRoot.appendChild(sec);
    });
  }

  /* ---------- My Lab: rolling showcase of articles with lab members ---------- */

  // Turns each journal article co-authored with a lab member into a small
  // "front page" card (journal, year, title, authors, a line drawing for its
  // theme) and lets the row drift sideways. Everything comes from
  // data/publications.js, so new papers appear on their own.
  function buildPaperShowcase(works) {
    var SHOWCASE_MAX = 14;    // most recent articles to show
    var root = document.getElementById("lab-papers-root");
    if (!root) return;
    var strip = function (t) { return t.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim(); };
    var THEMES = [
      { key: "llm", re: /\b(LLMs?|large language|generative AI|ChatGPT|GPT|chatbot|conversation)/i, label: "AI & language models" },
      { key: "network", re: /network/i, label: "Network psychometrics" },
      { key: "process", re: /(response time|process data|slow|log data|sequential|disengage|engagement|time-constrained)/i, label: "Process data" },
      { key: "ml", re: /(machine learning|feature selection|data mining|explainable|augmentation|natural language)/i, label: "Machine learning" },
      { key: "irt", re: /(item response|adaptive|IRT|invariance|scal|test|item)/i, label: "Measurement" },
    ];
    var ART = {
      irt: '<path d="M8 72 C 40 72, 48 18, 92 14"/><path d="M8 74 C 30 74, 62 30, 92 26" opacity=".55"/><path d="M8 76 C 55 76, 60 46, 92 40" opacity=".3"/>',
      network: '<path d="M20 60 L44 30 L70 50 L86 22 M44 30 L60 14 M70 50 L50 70 L20 60"/><circle cx="20" cy="60" r="4"/><circle cx="44" cy="30" r="5"/><circle cx="70" cy="50" r="5"/><circle cx="86" cy="22" r="3.5"/><circle cx="60" cy="14" r="3"/><circle cx="50" cy="70" r="3.5"/>',
      process: '<path d="M8 64 H92" opacity=".35"/><rect x="10" y="44" width="14" height="20" rx="2"/><rect x="30" y="30" width="10" height="34" rx="2"/><rect x="46" y="52" width="18" height="12" rx="2"/><rect x="70" y="20" width="12" height="44" rx="2"/><circle cx="78" cy="12" r="0" />',
      ml: '<path d="M50 12 L28 38 M50 12 L72 38 M28 38 L16 64 M28 38 L40 64 M72 38 L62 64 M72 38 L86 64"/><circle cx="50" cy="12" r="4"/><circle cx="28" cy="38" r="4"/><circle cx="72" cy="38" r="4"/><circle cx="16" cy="64" r="3"/><circle cx="40" cy="64" r="3"/><circle cx="62" cy="64" r="3"/><circle cx="86" cy="64" r="3"/>',
      llm: '<rect x="10" y="14" width="52" height="26" rx="8"/><path d="M22 40 L18 50 L32 40"/><rect x="38" y="46" width="52" height="22" rx="8" opacity=".6"/><path d="M20 27 H50 M48 57 H80" opacity=".6"/>',
    };
    var cards = [];
    works.forEach(function (w) {
      if (cards.length >= SHOWCASE_MAX) return;
      var m = w.html.match(/\)\.?\s*([\s\S]*?)\s*<em>([\s\S]*?)<\/em>/);
      if (!m) return;
      var journal = strip(m[2]).split(",")[0].trim();
      var title = strip(m[1]).replace(/\.$/, "");
      var authors = w.html.slice(0, w.html.indexOf("(" + (w.year === "In press" ? "In press" : w.year)));
      var doi = (w.html.match(/https:\/\/doi\.org\/[^\s<"]+/) || [""])[0].replace(/[.,]$/, "");
      if (!title || !journal) return;
      var theme = THEMES.filter(function (t) { return t.re.test(title); })[0] || THEMES[THEMES.length - 1];
      cards.push({ journal: journal, title: title, authors: authors.trim().replace(/,\s*$/, ""), year: w.year, doi: doi, theme: theme });
    });
    if (cards.length < 4) return;

    var track = document.createElement("div");
    track.className = "paper-track";
    var render = function (c, clone) {
      var a = document.createElement(c.doi ? "a" : "div");
      a.className = "paper-card theme-" + c.theme.key;
      if (c.doi) { a.href = c.doi; a.target = "_blank"; a.rel = "noopener"; }
      if (clone) { a.setAttribute("aria-hidden", "true"); a.tabIndex = -1; }
      a.innerHTML =
        '<div class="paper-band"><span class="paper-journal">' + c.journal + '</span><span class="paper-year">' + c.year + "</span></div>" +
        '<div class="paper-body">' +
          '<svg class="paper-art" viewBox="0 0 100 80" aria-hidden="true">' + ART[c.theme.key] + "</svg>" +
          '<h3 class="paper-title">' + c.title + "</h3>" +
          '<p class="paper-authors">' + c.authors + "</p>" +
          '<span class="paper-theme">' + c.theme.label + "</span>" +
        "</div>";
      return a;
    };
    cards.forEach(function (c) { track.appendChild(render(c, false)); });
    // Second copy makes the loop seamless; screen readers skip it.
    cards.forEach(function (c) { track.appendChild(render(c, true)); });
    track.style.setProperty("--paper-speed", (cards.length * 6) + "s");
    root.appendChild(track);
    root.closest("section").hidden = false;
  }

  function fillCounts(map) {
    Object.keys(map).forEach(function (k) {
      var el = document.querySelector('[data-count-for="' + k + '"]');
      if (el) el.textContent = map[k];
    });
  }

  /* ---------- live filter ---------- */

  function wireSearch(root) {
    var input = document.getElementById("cite-search");
    var meta = document.getElementById("search-meta");
    if (!input) return;
    var runFilter = function () {
      var q = input.value.trim().toLowerCase();
      var shown = 0, total = 0;
      root.querySelectorAll(".cite-list li").forEach(function (li) {
        total++;
        var hit = !q || li.textContent.toLowerCase().indexOf(q) !== -1;
        li.classList.toggle("hidden", !hit);
        if (hit) shown++;
      });
      // hide empty year blocks and sections
      root.querySelectorAll(".year-block").forEach(function (b) {
        var any = b.querySelectorAll(".cite-list li:not(.hidden)").length > 0;
        b.style.display = any ? "" : "none";
        // While filtering, open every year with a match; afterwards restore the default.
        b.open = q ? any : b.hasAttribute("data-default-open");
      });
      root.querySelectorAll(".cite-section").forEach(function (s) {
        var any = s.querySelectorAll(".cite-list li:not(.hidden)").length > 0;
        s.style.display = any ? "" : "none";
      });
      if (meta) meta.textContent = q ? "Showing " + shown + " of " + total + " entries" : "";
    };
    input.addEventListener("input", runFilter);

    // Deep link support: /publications/?q=term pre-fills and runs the filter.
    var params = new URLSearchParams(window.location.search);
    var preset = params.get("q") || params.get("search");
    if (preset) {
      input.value = preset;
      runFilter();
    }
  }

  /* ---------- news (home) ---------- */

  function newsYear(item) {
    var m = /(\d{4})/.exec(item.date || "");
    return m ? parseInt(m[1], 10) : 0;
  }
  function newsItem(item) {
    var div = document.createElement("article");
    div.className = "news-item";
    div.innerHTML = '<div class="date">' + item.date + '</div><div class="body">' + item.html + "</div>";
    return div;
  }
  // Home only: cut each item's text after `lines` lines, with a Read more / Show less
  // toggle that appears only when the text actually overflows.
  function clampNews(root, lines) {
    var items = [];
    Array.prototype.forEach.call(root.querySelectorAll(".news-item .body"), function (body, i) {
      var clip = document.createElement("div");
      clip.className = "news-clip is-clamped";
      clip.id = "news-clip-" + i;
      clip.style.setProperty("--news-lines", lines);
      while (body.firstChild) clip.appendChild(body.firstChild);
      body.appendChild(clip);
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "news-toggle";
      btn.setAttribute("aria-controls", clip.id);
      btn.setAttribute("aria-expanded", "false");
      btn.textContent = "Read more";
      btn.hidden = true;
      btn.addEventListener("click", function () {
        var open = clip.classList.toggle("is-clamped") === false;
        btn.setAttribute("aria-expanded", String(open));
        btn.textContent = open ? "Show less" : "Read more";
      });
      body.appendChild(btn);
      items.push({ clip: clip, btn: btn });
    });
    function measure() {
      items.forEach(function (it) {
        if (!it.clip.classList.contains("is-clamped")) return;
        var overflows = it.clip.scrollHeight > it.clip.clientHeight + 2;
        it.btn.hidden = !overflows;
        it.clip.classList.toggle("is-overflowing", overflows);
      });
    }
    measure();
    var t;
    window.addEventListener("resize", function () { clearTimeout(t); t = setTimeout(measure, 150); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  }

  var NEWS_CUTOFF = typeof NEWS_HOME_FROM_YEAR !== "undefined" ? NEWS_HOME_FROM_YEAR : 0;

  // My Lab: items marked lab: true, newest first.
  var LAB_NEWS_MAX = 6;
  var labNewsRoot = document.getElementById("lab-news-root");
  if (labNewsRoot && typeof NEWS !== "undefined") {
    var labNews = NEWS.filter(function (item) { return item.lab; }).slice(0, LAB_NEWS_MAX);
    labNews.forEach(function (item) { labNewsRoot.appendChild(newsItem(item)); });
    if (!labNews.length) labNewsRoot.closest("section").hidden = true;
  }

  // Home: items from NEWS_HOME_FROM_YEAR on (except home: false), plus a link to the archive.
  var newsRoot = document.getElementById("news-root");
  if (newsRoot && typeof NEWS !== "undefined") {
    NEWS.forEach(function (item) {
      if (newsYear(item) >= NEWS_CUTOFF && item.home !== false) newsRoot.appendChild(newsItem(item));
    });
    clampNews(newsRoot, 3);
    var more = document.getElementById("news-archive-link");
    if (more && NEWS.some(function (item) { return newsYear(item) < NEWS_CUTOFF; })) more.hidden = false;
  }

  // Archive page: older items, grouped by year (newest first).
  var archiveRoot = document.getElementById("news-archive-root");
  if (archiveRoot && typeof NEWS !== "undefined") {
    var byYear = {};
    var order = [];
    NEWS.forEach(function (item) {
      var y = newsYear(item);
      if (y >= NEWS_CUTOFF) return;
      if (!byYear[y]) { byYear[y] = []; order.push(y); }
      byYear[y].push(item);
    });
    order.sort(function (a, b) { return b - a; });
    order.forEach(function (y) {
      var h = document.createElement("h2");
      h.className = "news-year";
      h.id = "y-" + y;
      h.textContent = y || "Undated";
      archiveRoot.appendChild(h);
      var list = document.createElement("div");
      list.className = "news-list";
      byYear[y].forEach(function (item) { list.appendChild(newsItem(item)); });
      archiveRoot.appendChild(list);
    });
    if (!order.length) archiveRoot.innerHTML = "<p>No archived news yet.</p>";
  }

  /* ---------- home stats ---------- */

  var statPubs = document.getElementById("stat-pubs");
  if (statPubs && typeof PUBLICATIONS !== "undefined") {
    var total =
      PUBLICATIONS.books.length +
      PUBLICATIONS.chapters.length +
      PUBLICATIONS.proceedings.length +
      PUBLICATIONS.articles.reduce(function (n, g) { return n + g.items.length; }, 0);
    statPubs.textContent = total + "+";
  }
  var statPres = document.getElementById("stat-pres");
  if (statPres && typeof PRESENTATIONS !== "undefined") {
    var totalPres =
      PRESENTATIONS.invited.length +
      PRESENTATIONS.conference.reduce(function (n, g) { return n + g.items.length; }, 0);
    statPres.textContent = totalPres + "+";
  }

  /* ---------- footer year ---------- */

  var yearEl = document.getElementById("footer-year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- last updated (from the server's Last-Modified header) ---------- */

  var updEl = document.getElementById("last-updated");
  var updated = new Date(document.lastModified);
  // Browsers report "now" when the server sends no Last-Modified header; skip that case.
  if (updEl && !isNaN(updated) && Date.now() - updated.getTime() > 60000) {
    updEl.textContent = updated.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    updEl.parentNode.hidden = false;
  }
})();
