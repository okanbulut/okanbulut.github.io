/* ==========================================================================
   Okan Bulut — Academic Portfolio
   Co-author network (Research page, #coauthor-network).
   Built in the browser from data/publications.js and data/presentations.js,
   so it updates itself whenever a citation is added. Current students and
   former advisees are read from the #lab and #alumni sections of the page.
   Requires d3 v7.

   If one person appears under two spellings that don't merge on their own
   (e.g. a name change), add the variant to NAME_ALIASES below as
   "lastname|initial": "lastname|initial" (lowercase, accents removed).
   ========================================================================== */

(function () {
  "use strict";

  var root = document.getElementById("coauthor-network");
  if (!root || typeof d3 === "undefined" || typeof PUBLICATIONS === "undefined") return;

  var SELF = "bulut|o";
  var SELF_NAME = "Okan Bulut";
  var NAME_ALIASES = {
    // "variant|x": "canonical|x",
  };
  var THIS_YEAR = new Date().getFullYear();
  var GROUP_LABEL = { current: "Current student", alumni: "Former advisee", collaborator: "Collaborator" };

  /* ---------- parsing ---------- */

  var parser = new DOMParser();
  function plain(html) {
    return parser.parseFromString(html, "text/html").body.textContent.replace(/\s+/g, " ").trim();
  }
  function fold(s) {
    return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");
  }
  // "Yildirim-Erbasli" and "Yildirim Erbasli" are the same person: treat
  // hyphens, dashes and spaces in last names alike.
  function keyOf(last, initials) {
    var k = fold(last).replace(/[\s\-‐-―]+/g, " ").trim() + "|" + fold(initials).replace(/[^a-z]/g, "").charAt(0);
    return NAME_ALIASES[k] || k;
  }

  var AUTHOR_RE = /([A-ZÀ-Žİ][^,]*?),\s*((?:[A-ZÀ-Žİ]\.(?:\s?-?[A-ZÀ-Žİ]\.)*\s?)+)/g;
  var LEAD_RE = /^(.*?)\s*\(((?:19|20)\d{2}|In press|Under review|In preparation)[^)]*\)\.?\s*(.*)$/;

  function parseEntry(entry, type) {
    var text = plain(typeof entry === "string" ? entry : entry.html);
    var m = text.match(LEAD_RE);
    if (!m) return null;
    var authorsPart = m[1].replace(/\(Eds?\.\)\.?/g, "").replace(/&/g, ",");
    var authors = [];
    var seen = {};
    var a;
    AUTHOR_RE.lastIndex = 0;
    while ((a = AUTHOR_RE.exec(authorsPart))) {
      var key = keyOf(a[1], a[2]);
      if (seen[key]) continue;
      seen[key] = true;
      authors.push({ key: key, display: a[1].trim() + ", " + a[2].trim() });
    }
    // Title: up to the first sentence end; a short question runs on to its subtitle.
    var rest = m[3];
    var t = rest.match(/^(.+?[.?!])(\s|$)/);
    var title = t ? t[1] : rest;
    if (/\?$/.test(title) && title.split(" ").length < 6) {
      var longer = rest.match(/^(.+?\?.+?\.)(\s|$)/);
      if (longer) title = longer[1];
    }
    return {
      year: /^\d{4}$/.test(m[2]) ? +m[2] : THIS_YEAR,
      status: /^\d/.test(m[2]) ? "" : m[2],
      type: type,
      title: title.replace(/\.$/, ""),
      authors: authors
    };
  }

  var works = [];
  function addAll(list, type) {
    (list || []).forEach(function (e) {
      var w = parseEntry(e, type);
      if (w && w.authors.length) works.push(w);
    });
  }
  var P = PUBLICATIONS;
  addAll(P.books, "publication");
  addAll(P.chapters, "publication");
  (P.articles || []).forEach(function (y) { addAll(y.items, "publication"); });
  addAll(P.proceedings, "publication");
  addAll(P.underReview, "publication");
  if (typeof PRESENTATIONS !== "undefined") {
    addAll(PRESENTATIONS.invited, "presentation");
    (PRESENTATIONS.conference || []).forEach(function (y) { addAll(y.items, "presentation"); });
  }

  // People: one entry per key, shown under the most complete spelling.
  var people = {};
  works.forEach(function (w, wi) {
    w.authors.forEach(function (au) {
      if (au.key === SELF) return;
      var p = people[au.key] || (people[au.key] = { key: au.key, display: au.display, works: [] });
      if (au.display.length > p.display.length) p.display = au.display;
      p.works.push(wi);
    });
  });

  // "Gorgun, G." → "G. Gorgun"
  Object.keys(people).forEach(function (k) {
    var p = people[k];
    var parts = p.display.split(",");
    p.name = (parts.slice(1).join(",").trim() + " " + parts[0].trim()).trim();
    p.group = "collaborator";
  });

  // Students and alumni, matched by first initial + last name.
  function matchNames(selector, group) {
    document.querySelectorAll(selector).forEach(function (el) {
      var tokens = fold(el.textContent).replace(/-/g, " ").split(/\s+/).filter(Boolean);
      if (tokens.length < 2) return;
      var initial = tokens[0].charAt(0);
      var tail = " " + tokens.slice(1).join(" ") + " ";
      Object.keys(people).forEach(function (k) {
        var parts = k.split("|");
        if (parts[1] !== initial) return;
        if (tail.indexOf(" " + parts[0].replace(/-/g, " ") + " ") === -1) return;
        var p = people[k];
        if (group === "current" || p.group === "collaborator") p.group = group;
        p.fullName = el.textContent.trim();
      });
    });
  }
  matchNames("#lab .person h3", "current");
  matchNames("#alumni li strong", "alumni");

  // Spellings that still differ but match the same student/advisee are one person.
  var byFullName = {};
  Object.keys(people).forEach(function (k) {
    var p = people[k];
    if (!p.fullName) return;
    var keep = byFullName[p.fullName];
    if (!keep) { byFullName[p.fullName] = k; return; }
    var a = people[keep];
    if (p.works.length > a.works.length) { byFullName[p.fullName] = k; var t = a; a = p; p = t; keep = k; }
    p.works.forEach(function (wi) {
      if (a.works.indexOf(wi) === -1) a.works.push(wi);
      works[wi].authors.forEach(function (au) { if (au.key === p.key) au.key = a.key; });
    });
    delete people[p.key];
  });
  Object.keys(people).forEach(function (k) {
    var p = people[k];
    // Short label from the citation spelling: "S. Yildirim-Erbasli", "D. C. Cormier".
    var parts = p.display.split(",");
    p.label = p.fullName ? p.fullName.charAt(0) + ". " + parts[0].trim() : p.name;
    if (p.fullName) p.name = p.fullName;
  });

  var years = works.map(function (w) { return w.year; });
  var MIN_YEAR = Math.min.apply(null, years);
  var MAX_YEAR = Math.max.apply(null, years);

  /* ---------- markup ---------- */

  root.innerHTML =
    '<div class="nw-controls">' +
      '<label class="nw-field nw-search">Find a collaborator' +
        '<input type="search" list="nw-names" placeholder="Type a name…" autocomplete="off"></label>' +
      '<div class="nw-field nw-years"><span>Years <output data-out="years"></output></span>' +
        '<div class="nw-range2"><input type="range" data-ctl="from" aria-label="From year"><input type="range" data-ctl="to" aria-label="To year"></div></div>' +
      '<label class="nw-field">Min. joint works <output data-out="min"></output>' +
        '<input type="range" data-ctl="min" min="1" max="10" step="1" value="3"></label>' +
      '<fieldset class="nw-field nw-types"><legend>Include</legend>' +
        '<label><input type="checkbox" data-ctl="publication" checked> Publications</label>' +
        '<label><input type="checkbox" data-ctl="presentation" checked> Presentations</label></fieldset>' +
    "</div>" +
    '<div class="nw-stage">' +
      '<svg class="nw-svg" role="img" aria-label="Co-author network of Okan Bulut"></svg>' +
      '<div class="nw-zoom"><button type="button" data-zoom="in" aria-label="Zoom in">+</button>' +
        '<button type="button" data-zoom="out" aria-label="Zoom out">−</button>' +
        '<button type="button" data-zoom="reset" aria-label="Reset view">⟲</button></div>' +
      '<div class="nw-tooltip" hidden></div>' +
      '<aside class="nw-panel" hidden aria-live="polite"></aside>' +
    "</div>" +
    '<div class="nw-foot">' +
      '<ul class="nw-legend">' +
        '<li><span class="nw-swatch nw-center"></span>Okan Bulut</li>' +
        '<li><span class="nw-swatch nw-current"></span>Current students</li>' +
        '<li><span class="nw-swatch nw-alumni"></span>Former advisees</li>' +
        '<li><span class="nw-swatch nw-collaborator"></span>Collaborators</li></ul>' +
      '<p class="nw-stats" aria-live="polite"></p>' +
      '<p class="nw-hint">Drag nodes · click a person for joint work · Ctrl/⌘ + scroll to zoom</p>' +
    "</div>" +
    '<datalist id="nw-names"></datalist>';

  var $ = function (sel) { return root.querySelector(sel); };
  var ctl = function (name) { return root.querySelector('[data-ctl="' + name + '"]'); };
  var out = function (name) { return root.querySelector('[data-out="' + name + '"]'); };
  var stage = $(".nw-stage");
  var tooltip = $(".nw-tooltip");
  var panel = $(".nw-panel");

  [ctl("from"), ctl("to")].forEach(function (r) { r.min = MIN_YEAR; r.max = MAX_YEAR; r.step = 1; });
  ctl("from").value = MIN_YEAR;
  ctl("to").value = MAX_YEAR;

  var datalist = $("#nw-names");
  Object.keys(people).map(function (k) { return people[k].name; }).sort().forEach(function (n) {
    var o = document.createElement("option");
    o.value = n;
    datalist.appendChild(o);
  });

  /* ---------- graph ---------- */

  var svg = d3.select(root).select(".nw-svg");
  var gRoot = svg.append("g");
  var gLinks = gRoot.append("g").attr("class", "nw-links");
  var gNodes = gRoot.append("g").attr("class", "nw-nodes");
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var width = 0, height = 0;
  var positions = new Map();
  var current = { nodes: [], links: [], filtered: [] };
  var selected = null;
  var userZoomed = false; // once the visitor zooms or pans, stop auto-fitting

  var zoom = d3.zoom()
    .scaleExtent([0.3, 4])
    .filter(function (event) {
      if (event.type === "wheel") return event.ctrlKey || event.metaKey;
      if (event.type.indexOf("touch") === 0) return false; // one finger scrolls the page
      return !event.button;
    })
    .on("zoom", function (event) {
      gRoot.attr("transform", event.transform);
      if (event.sourceEvent) userZoomed = true;
    });
  svg.call(zoom).on("dblclick.zoom", null);
  svg.style("touch-action", "pan-y");

  root.querySelector(".nw-zoom").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    var k = b.getAttribute("data-zoom");
    if (k === "in" || k === "out") {
      userZoomed = true;
      svg.transition().duration(250).call(zoom.scaleBy, k === "in" ? 1.4 : 1 / 1.4);
    }
    if (k === "reset") { userZoomed = false; fitView(350); }
  });

  var simulation = d3.forceSimulation()
    .force("link", d3.forceLink().id(function (d) { return d.id; })
      .distance(function (l) { return l.center ? 85 + 210 / Math.sqrt(l.w + 1) : 50; })
      .strength(function (l) { return l.center ? 0.22 : Math.min(0.4, 0.06 * l.w); }))
    .force("charge", d3.forceManyBody().strength(function (d) { return d.center ? -500 : -35 - 5 * d.r; }))
    .force("collide", d3.forceCollide(function (d) { return d.r + (d.label ? 10 : 3); }))
    .force("x", d3.forceX().strength(0.035))
    .force("y", d3.forceY().strength(0.045))
    .on("tick", ticked)
    .on("end", function () { if (!userZoomed) fitView(500); });

  function radius(count) { return 3.5 + 2.6 * Math.sqrt(count); }

  function compute() {
    var from = Math.min(+ctl("from").value, +ctl("to").value);
    var to = Math.max(+ctl("from").value, +ctl("to").value);
    var types = { publication: ctl("publication").checked, presentation: ctl("presentation").checked };
    var min = +ctl("min").value;
    out("years").textContent = from + "–" + to;
    out("min").textContent = min;

    var filtered = [];
    works.forEach(function (w, wi) {
      if (w.year >= from && w.year <= to && types[w.type]) filtered.push(wi);
    });
    var count = {};
    filtered.forEach(function (wi) {
      works[wi].authors.forEach(function (au) { if (au.key !== SELF) count[au.key] = (count[au.key] || 0) + 1; });
    });
    var visible = Object.keys(count).filter(function (k) { return count[k] >= min; });
    var isVisible = {};
    visible.forEach(function (k) { isVisible[k] = true; });

    var nodes = [{ id: SELF, name: SELF_NAME, center: true, group: "center", count: filtered.length, r: 16 }];
    visible.forEach(function (k) {
      var p = people[k];
      nodes.push({ id: k, name: p.name, short: p.label, group: p.group, count: count[k], r: radius(count[k]) });
    });

    var pair = {};
    filtered.forEach(function (wi) {
      var ks = works[wi].authors.map(function (au) { return au.key; }).filter(function (k) { return isVisible[k]; });
      for (var i = 0; i < ks.length; i++) {
        for (var j = i + 1; j < ks.length; j++) {
          var id = ks[i] < ks[j] ? ks[i] + "~" + ks[j] : ks[j] + "~" + ks[i];
          pair[id] = (pair[id] || 0) + 1;
        }
      }
    });
    var links = visible.map(function (k) { return { source: SELF, target: k, w: count[k], center: true }; });
    Object.keys(pair).forEach(function (id) {
      var ab = id.split("~");
      links.push({ source: ab[0], target: ab[1], w: pair[id], center: false });
    });
    return { nodes: nodes, links: links, filtered: filtered, from: from, to: to };
  }

  function render() {
    var data = compute();
    current = data;
    var cx = width / 2, cy = height / 2;

    data.nodes.forEach(function (n) {
      var p = positions.get(n.id);
      if (n.center) { n.fx = cx; n.fy = cy; n.x = cx; n.y = cy; return; }
      if (p) { n.x = p.x; n.y = p.y; } else {
        var a = Math.random() * Math.PI * 2;
        n.x = cx + Math.cos(a) * (120 + Math.random() * 120);
        n.y = cy + Math.sin(a) * (120 + Math.random() * 120);
      }
    });

    // Label the center and the ~14 largest collaborators.
    var sorted = data.nodes.filter(function (n) { return !n.center; }).sort(function (a, b) { return b.count - a.count; });
    var labelCut = sorted.length > 14 ? sorted[13].count : 0;
    data.nodes.forEach(function (n) { n.label = n.center || n.count >= Math.max(labelCut, 2); });

    var link = gLinks.selectAll("line").data(data.links, function (l) {
      return (l.source.id || l.source) + "~" + (l.target.id || l.target);
    });
    link.exit().remove();
    link.enter().append("line")
      .merge(link)
      .attr("class", function (l) { return "nw-link" + (l.center ? " nw-link-center" : ""); })
      .attr("stroke-width", function (l) { return l.center ? 0.8 + Math.sqrt(l.w) * 0.45 : 0.5 + Math.sqrt(l.w) * 0.5; });

    var node = gNodes.selectAll("g.nw-node").data(data.nodes, function (d) { return d.id; });
    node.exit().remove();
    var enter = node.enter().append("g")
      .attr("class", "nw-node")
      .attr("tabindex", 0)
      .attr("role", "button")
      .call(d3.drag()
        .on("start", function (event, d) {
          if (!event.active && !reduceMotion) simulation.alphaTarget(0.2).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on("drag", function (event, d) {
          d.fx = event.x; d.fy = event.y;
          if (reduceMotion) ticked();
        })
        .on("end", function (event, d) {
          if (!event.active) simulation.alphaTarget(0);
          if (!d.center) { d.fx = null; d.fy = null; }
        }));
    enter.append("circle");
    enter.append("text").attr("dy", "0.32em");
    enter
      .on("mouseenter", function (event, d) { showTip(event, d); })
      .on("mousemove", function (event, d) { showTip(event, d); })
      .on("mouseleave", hideTip)
      .on("click", function (event, d) { event.stopPropagation(); select(d.id); })
      .on("keydown", function (event, d) {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(d.id); }
      });

    var all = enter.merge(node);
    all.attr("class", function (d) {
      return "nw-node nw-" + d.group + (d.label ? " has-label" : "") +
        (d.id === selected ? " is-selected is-active" : "");
    })
      .attr("aria-label", function (d) {
        return d.center ? SELF_NAME : d.name + ", " + d.count + " joint work" + (d.count === 1 ? "" : "s");
      });
    all.select("circle").attr("r", function (d) { return d.r; });
    all.select("text")
      .text(function (d) { return d.center ? SELF_NAME : d.short; })
      .attr("x", function (d) { return d.r + 4; });

    simulation.nodes(data.nodes);
    simulation.force("link").links(data.links);
    simulation.force("x").x(cx);
    simulation.force("y").y(cy);

    userZoomed = false; // new filters: fit the new layout
    if (reduceMotion) {
      simulation.alpha(1).stop();
      for (var i = 0; i < 300; i++) simulation.tick();
      ticked();
      fitView(0);
    } else {
      simulation.alpha(0.9).restart();
    }

    var nCollab = data.nodes.length - 1;
    $(".nw-stats").textContent = nCollab + " collaborator" + (nCollab === 1 ? "" : "s") + " · " +
      data.filtered.length + " work" + (data.filtered.length === 1 ? "" : "s") + " · " + data.from + "–" + data.to;
    svg.attr("aria-label", "Co-author network of Okan Bulut: " + nCollab + " collaborators across " +
      data.filtered.length + " publications and presentations, " + data.from + " to " + data.to +
      ". Each person is a focusable button; use the search box to find someone.");

    if (selected && !data.nodes.some(function (n) { return n.id === selected; })) select(null);
    else if (selected) select(selected);
  }

  function ticked() {
    gLinks.selectAll("line")
      .attr("x1", function (l) { return l.source.x; })
      .attr("y1", function (l) { return l.source.y; })
      .attr("x2", function (l) { return l.target.x; })
      .attr("y2", function (l) { return l.target.y; });
    gNodes.selectAll("g.nw-node").attr("transform", function (d) {
      positions.set(d.id, { x: d.x, y: d.y });
      return "translate(" + d.x + "," + d.y + ")";
    });
  }

  // Zoom so the whole network (plus room for labels) fits the frame.
  function fitView(ms) {
    if (!current.nodes.length || !width) return;
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    current.nodes.forEach(function (n) {
      x0 = Math.min(x0, n.x - n.r);
      y0 = Math.min(y0, n.y - n.r);
      x1 = Math.max(x1, n.x + n.r + (n.label ? 90 : 0));
      y1 = Math.max(y1, n.y + n.r);
    });
    var pad = 24;
    var k = Math.min(1.6, (width - pad * 2) / (x1 - x0), (height - pad * 2) / (y1 - y0));
    var t = d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(k)
      .translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    (ms && !reduceMotion ? svg.transition().duration(ms) : svg).call(zoom.transform, t);
  }

  /* ---------- tooltip, selection, panel ---------- */

  function showTip(event, d) {
    var box = stage.getBoundingClientRect();
    tooltip.hidden = false;
    tooltip.textContent = d.center
      ? SELF_NAME + " · " + d.count + " works"
      : d.name + " · " + d.count + " joint work" + (d.count === 1 ? "" : "s");
    var x = event.clientX - box.left + 14;
    var y = event.clientY - box.top + 14;
    tooltip.style.left = Math.min(x, box.width - tooltip.offsetWidth - 8) + "px";
    tooltip.style.top = Math.min(y, box.height - tooltip.offsetHeight - 8) + "px";
  }
  function hideTip() { tooltip.hidden = true; }

  function select(id) {
    selected = id;
    stage.classList.toggle("has-selection", !!id);
    var neighbours = {};
    if (id) {
      neighbours[id] = true;
      current.links.forEach(function (l) {
        if (l.source.id === id) neighbours[l.target.id] = true;
        if (l.target.id === id) neighbours[l.source.id] = true;
      });
    }
    gNodes.selectAll("g.nw-node")
      .classed("is-active", function (d) { return !!neighbours[d.id]; })
      .classed("is-selected", function (d) { return d.id === id; });
    gLinks.selectAll("line").classed("is-active", function (l) { return l.source.id === id || l.target.id === id; });
    if (id) showPanel(id); else panel.hidden = true;
  }

  function showPanel(id) {
    var inFilter = {};
    current.filtered.forEach(function (wi) { inFilter[wi] = true; });
    var list, heading, meta;
    if (id === SELF) {
      heading = SELF_NAME;
      meta = (current.nodes.length - 1) + " collaborators shown · " + current.filtered.length + " works";
      list = [];
    } else {
      var p = people[id];
      list = p.works.filter(function (wi) { return inFilter[wi]; }).map(function (wi) { return works[wi]; });
      list.sort(function (a, b) { return b.year - a.year; });
      heading = p.name;
      meta = GROUP_LABEL[p.group] + " · " + list.length + " joint work" + (list.length === 1 ? "" : "s");
    }
    panel.innerHTML = "";
    var close = document.createElement("button");
    close.type = "button";
    close.className = "nw-close";
    close.setAttribute("aria-label", "Close");
    close.textContent = "×";
    close.addEventListener("click", function () { select(null); });
    var h = document.createElement("h3");
    h.textContent = heading;
    var m = document.createElement("p");
    m.className = "nw-meta";
    m.textContent = meta;
    panel.appendChild(close);
    panel.appendChild(h);
    panel.appendChild(m);
    if (list.length) {
      var ul = document.createElement("ul");
      list.forEach(function (w) {
        var li = document.createElement("li");
        var y = document.createElement("span");
        y.className = "nw-year";
        y.textContent = w.status || w.year;
        var t = document.createElement("span");
        t.className = "nw-title";
        t.textContent = w.title;
        var tag = document.createElement("span");
        tag.className = "nw-tag nw-tag-" + w.type;
        tag.textContent = w.type === "presentation" ? "Presentation" : "Publication";
        li.appendChild(y);
        li.appendChild(t);
        li.appendChild(tag);
        ul.appendChild(li);
      });
      panel.appendChild(ul);
    }
    panel.hidden = false;
  }

  svg.on("click", function () { select(null); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && selected) select(null); });

  /* ---------- search ---------- */

  function focusPerson(id) {
    var relaid = false;
    if (!current.nodes.some(function (n) { return n.id === id; })) {
      // Not in the current filters: widen them so the person appears.
      ctl("from").value = MIN_YEAR;
      ctl("to").value = MAX_YEAR;
      ctl("publication").checked = true;
      ctl("presentation").checked = true;
      ctl("min").value = 1;
      render();
      relaid = true;
    }
    select(id);
    userZoomed = true; // keep the auto-fit from zooming back out
    var n = current.nodes.filter(function (x) { return x.id === id; })[0];
    function zoomTo() {
      // Center in the area left of the side panel (it sits on the right on wide screens).
      var cx = !panel.hidden && width > 700 ? (width - panel.offsetWidth - 20) / 2 : width / 2;
      var t = d3.zoomIdentity.translate(cx, height / 2).scale(1.6).translate(-n.x, -n.y);
      (reduceMotion ? svg : svg.transition().duration(600)).call(zoom.transform, t);
    }
    if (n) {
      // After a re-layout, wait for the nodes to settle before zooming in.
      if (relaid && !reduceMotion) simulation.on("end.focus", function () { simulation.on("end.focus", null); zoomTo(); });
      else setTimeout(zoomTo, reduceMotion ? 0 : 200);
    }
    stage.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
  }

  $(".nw-search input").addEventListener("change", function (e) {
    var q = fold(e.target.value.trim());
    if (!q) return;
    var keys = Object.keys(people);
    // Exact name, then partial name, then "first-name last-name" against
    // citation initials (e.g. "Mark Gierl" → M. J. Gierl).
    var tokens = q.replace(/[.,]/g, " ").split(/\s+/).filter(Boolean);
    var hit = keys.filter(function (k) { return fold(people[k].name) === q; })[0] ||
      keys.filter(function (k) { return fold(people[k].name).indexOf(q) !== -1; })[0] ||
      keys.filter(function (k) {
        var parts = k.split("|");
        var last = parts[0];
        var lastHit = tokens.some(function (t) { return t === last || last.split(" ").indexOf(t) !== -1; });
        return lastHit && (tokens.length === 1 || tokens[0].charAt(0) === parts[1]);
      }).sort(function (a, b) { return people[b].works.length - people[a].works.length; })[0];
    if (hit) focusPerson(hit);
  });

  /* ---------- controls & sizing ---------- */

  root.querySelector(".nw-controls").addEventListener("input", function (e) {
    if (e.target.matches("input[type=range], input[type=checkbox]")) render();
  });

  function resize() {
    var w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h || (w === width && h === height)) return;
    var first = !width;
    width = w;
    height = h;
    svg.attr("viewBox", [0, 0, width, height]);
    if (first) render();
    else {
      current.nodes.forEach(function (n) { if (n.center) { n.fx = width / 2; n.fy = height / 2; } });
      simulation.force("x").x(width / 2);
      simulation.force("y").y(height / 2);
      if (reduceMotion) { for (var i = 0; i < 120; i++) simulation.tick(); ticked(); }
      else simulation.alpha(0.3).restart();
    }
  }
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(stage);
  window.addEventListener("resize", resize);
  // A page opened in a hidden window has no size yet; draw once it's shown.
  document.addEventListener("visibilitychange", resize);
  resize();
})();
