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
      // linkify doi:10.xxxx/yyyy
      seg = seg.replace(/doi:\s*(10\.[^\s<]+?)([.,;]?)(?=(\s|<|$))/g, function (m, doi, punct) {
        return '<a href="https://doi.org/' + doi + '" target="_blank" rel="noopener">doi:' + doi + "</a>" + punct;
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

  function yearBlocks(container, groups) {
    groups.forEach(function (g) {
      var block = document.createElement("div");
      block.className = "year-block";
      block.id = "y-" + g.year.replace(/\W+/g, "-").toLowerCase();
      var h = document.createElement("h3");
      h.textContent = g.year;
      block.appendChild(h);
      block.appendChild(citeList(g.items));
      container.appendChild(block);
    });
  }

  /* ---------- publications page ---------- */

  var pubsRoot = document.getElementById("pubs-root");
  if (pubsRoot && typeof PUBLICATIONS !== "undefined") {
    var P = PUBLICATIONS;
    var nArticles = P.articles.reduce(function (n, g) { return n + g.items.length; }, 0);

    var secBooks = sectionEl("books", "Books", "", P.books.length);
    secBooks.appendChild(citeList(P.books));
    pubsRoot.appendChild(secBooks);

    var secCh = sectionEl("chapters", "Book Chapters", "", P.chapters.length);
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

    fillCounts({ invited: R.invited.length, conference: nConf });
    wireSearch(presRoot);
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

  var newsRoot = document.getElementById("news-root");
  if (newsRoot && typeof NEWS !== "undefined") {
    NEWS.forEach(function (item) {
      var div = document.createElement("article");
      div.className = "news-item reveal in";
      div.innerHTML = '<div class="date">' + item.date + '</div><div class="body">' + item.html + "</div>";
      newsRoot.appendChild(div);
    });
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
})();
