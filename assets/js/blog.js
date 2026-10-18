/* ==========================================================================
   Okan Bulut — Academic Portfolio
   Blog page: lists the posts from the blog's RSS feed (okan.cloud), so new
   posts appear here automatically after the blog is published. The feed URL
   comes from the script tag's data-feed attribute in blog/index.html.
   ========================================================================== */

(function () {
  "use strict";

  var root = document.getElementById("blog-root");
  var script = document.currentScript;
  var FEED = script && script.getAttribute("data-feed");
  if (!root || !FEED) return;

  var BLOG_URL = new URL("/", FEED).href; // the blog's home page
  var SELF = "Okan Bulut";
  var filters = document.querySelector(".blog-filters");
  var posts = [];
  var activeTag = null;

  fetch(FEED, { cache: "no-cache" })
    .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
    .then(function (xml) {
      posts = parseFeed(xml);
      if (!posts.length) throw new Error("no posts");
      renderFilters();
      render();
    })
    .catch(showFallback);

  /* ---------- feed parsing ---------- */

  function parseFeed(xml) {
    var doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.getElementsByTagName("parsererror").length) return [];
    return Array.prototype.map.call(doc.getElementsByTagName("item"), function (item) {
      var text = function (tag) {
        var el = item.getElementsByTagName(tag)[0];
        return el ? el.textContent.trim() : "";
      };
      var desc = text("description").replace(/\s+/g, " ");
      var read = desc.match(/\((\d+)\s*min read\)\s*$/i);
      if (read) desc = desc.slice(0, read.index).trim();
      // Distill cuts descriptions mid-word; end them cleanly.
      if (desc && !/[.!?]$/.test(desc)) desc = desc.replace(/[\s,;:]+\S*$/, "") + "…";
      var media = item.getElementsByTagNameNS("*", "content")[0];
      var date = new Date(text("pubDate"));
      return {
        title: text("title"),
        link: text("link"),
        description: desc,
        readMinutes: read ? +read[1] : null,
        date: isNaN(date) ? null : date,
        image: media ? media.getAttribute("url") : "",
        authors: Array.prototype.map.call(item.getElementsByTagNameNS("*", "creator"), function (c) { return c.textContent.trim(); }),
        tags: Array.prototype.map.call(item.getElementsByTagName("category"), function (c) { return c.textContent.trim(); })
      };
    }).sort(function (a, b) { return (b.date || 0) - (a.date || 0); });
  }

  /* ---------- topic filters ---------- */

  function renderFilters() {
    var count = {};
    posts.forEach(function (p) { p.tags.forEach(function (t) { count[t] = (count[t] || 0) + 1; }); });
    var tags = Object.keys(count).filter(function (t) { return count[t] >= 2; })
      .sort(function (a, b) { return count[b] - count[a] || a.localeCompare(b); });
    if (!tags.length) return;
    filters.innerHTML = "";
    filters.appendChild(chip("All posts", null, posts.length));
    tags.forEach(function (t) { filters.appendChild(chip(t, t, count[t])); });
    filters.hidden = false;
  }

  function chip(label, tag, n) {
    var b = el("button", "blog-chip", { type: "button", "data-tag": tag || "" });
    b.textContent = label + " ";
    var c = el("span", "blog-chip-count");
    c.textContent = n;
    b.appendChild(c);
    b.addEventListener("click", function () { setTag(tag); });
    return b;
  }

  function setTag(tag) {
    activeTag = activeTag === tag ? null : tag;
    render();
    filters.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  /* ---------- cards ---------- */

  function render() {
    filters.querySelectorAll(".blog-chip").forEach(function (b) {
      var on = (b.getAttribute("data-tag") || null) === activeTag;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    var shown = posts.filter(function (p) { return !activeTag || p.tags.indexOf(activeTag) !== -1; });
    root.innerHTML = "";
    if (activeTag) {
      // Say what's filtered (rare topics have no chip of their own).
      var note = el("p", "blog-filter-note");
      note.textContent = shown.length + " post" + (shown.length === 1 ? "" : "s") + " tagged “" + activeTag + "” · ";
      var all = el("button", "blog-show-all", { type: "button" });
      all.textContent = "Show all";
      all.addEventListener("click", function () { setTag(null); });
      note.appendChild(all);
      root.appendChild(note);
    }
    shown.forEach(function (p) { root.appendChild(card(p)); });
  }

  function card(p) {
    var art = el("article", "blog-card");

    var thumb = el("a", "blog-thumb", { href: p.link, target: "_blank", rel: "noopener", tabindex: "-1", "aria-hidden": "true" });
    if (p.image) {
      var img = el("img", "", { src: p.image, alt: "", loading: "lazy", decoding: "async" });
      img.addEventListener("error", function () { img.remove(); thumb.classList.add("no-image"); });
      thumb.appendChild(img);
    } else {
      thumb.classList.add("no-image");
    }
    art.appendChild(thumb);

    var body = el("div", "blog-body");
    var meta = el("p", "blog-meta");
    if (p.date) {
      var time = el("time", "", { datetime: p.date.toISOString().slice(0, 10) });
      time.textContent = p.date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
      meta.appendChild(time);
    }
    if (p.readMinutes) meta.appendChild(document.createTextNode((p.date ? " · " : "") + p.readMinutes + " min read"));
    body.appendChild(meta);

    var h = el("h3", "blog-title");
    var a = el("a", "", { href: p.link, target: "_blank", rel: "noopener" });
    a.textContent = p.title;
    h.appendChild(a);
    body.appendChild(h);

    if (p.description) {
      var d = el("p", "blog-desc");
      d.textContent = p.description;
      body.appendChild(d);
    }

    var others = p.authors.filter(function (n) { return n !== SELF; });
    if (others.length) {
      var w = el("p", "blog-with");
      w.textContent = "with " + others.join(", ");
      body.appendChild(w);
    }

    if (p.tags.length) {
      var ul = el("ul", "blog-tags");
      p.tags.forEach(function (t) {
        var li = el("li");
        var b = el("button", "blog-tag" + (t === activeTag ? " is-active" : ""), { type: "button" });
        b.textContent = t;
        b.addEventListener("click", function () { setTag(t); });
        li.appendChild(b);
        ul.appendChild(li);
      });
      body.appendChild(ul);
    }

    var more = el("a", "blog-more", { href: p.link, target: "_blank", rel: "noopener" });
    more.textContent = "Read on okan.cloud ↗";
    body.appendChild(more);

    art.appendChild(body);
    return art;
  }

  function showFallback() {
    root.innerHTML = "";
    var p = el("p", "blog-status");
    p.appendChild(document.createTextNode("The post list couldn't be loaded right now. "));
    var a = el("a", "", { href: BLOG_URL, target: "_blank", rel: "noopener" });
    a.textContent = "Visit my blog at okan.cloud ↗";
    p.appendChild(a);
    root.appendChild(p);
  }

  function el(tag, cls, attrs) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    return node;
  }
})();
