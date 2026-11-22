/* ==========================================================================
   "How my research has evolved" stream chart (Research page, #research-stream).
   Built from the journal articles in data/publications.js: each title is
   sorted into a theme, and the river shows how much of each year's work
   falls in each theme. New papers move the river on their own.
   Requires d3 v7.
   ========================================================================== */
(function () {
  "use strict";
  var root = document.getElementById("research-stream");
  if (!root || typeof d3 === "undefined" || typeof PUBLICATIONS === "undefined") return;

  var FIRST_YEAR = 2015;
  // Checked top to bottom; the first match wins.
  var THEMES = [
    { key: "ai", label: "AI & language models", re: /\b(LLMs?|large language|language models?|generative|ChatGPT|GPT|chatbots?|conversational|conversation|artificial intelligence|AI|question generation|item generation)\b/i },
    { key: "process", label: "Process data & engagement", re: /(response time|process data|log data|sequential|disengage|engagement|effort|careless|rapid guess|slow|problem-solving|time)/i },
    { key: "ml", label: "Data mining & learning analytics", re: /(machine learning|data mining|learning analytics|assessment analytics|predict|explainable|random forest|feature|natural language|text|recommend|classification|deep|neural|embedding|essay scoring|anomaly|knowledge tracing|tutoring|dropout identification)/i },
    { key: "psy", label: "Measurement & assessment", re: /(item response|IRT|Rasch|adaptive|invariance|differential item|DIF|psychometric|measur|validity|validat|reliab|scales?\b|equating|factor|test|items?\b|assessments?|score report|scoring|feedback|missing data|ability estimation|distractors|profile analysis|subscore|multiple-choice|OSCE)/i },
    { key: "app", label: "Interdisciplinary collaborations", re: /./ },
  ];
  var STACK = ["psy", "ml", "process", "app", "ai"]; // bottom to top
  var COLORS = {
    light: { psy: "#0b5d36", ml: "#1f8a4f", process: "#5d9f45", app: "#9c9a2a", ai: "#c79a12" },
    dark:  { psy: "#2a9d63", ml: "#4cc483", process: "#95d36f", app: "#d8d35a", ai: "#ffdb05" },
  };

  var strip = function (t) { return t.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&"); };
  var counts = {};
  var newest = FIRST_YEAR;
  PUBLICATIONS.articles.forEach(function (g) {
    var y = parseInt(g.year, 10);
    if (!(y >= FIRST_YEAR)) return;
    newest = Math.max(newest, y);
    g.items.forEach(function (it) {
      var html = typeof it === "string" ? it : it.html;
      var m = html.match(/\)\.?\s*([\s\S]*?)\s*<em>/);
      var title = strip(m ? m[1] : html);
      var t = THEMES.filter(function (t) { return t.re.test(title); })[0] || THEMES[THEMES.length - 1];
      counts[y] = counts[y] || {};
      counts[y][t.key] = (counts[y][t.key] || 0) + 1;
    });
  });
  var years = d3.range(FIRST_YEAR, newest + 1);
  var raw = years.map(function (y) {
    var row = { year: y };
    STACK.forEach(function (k) { row[k] = (counts[y] && counts[y][k]) || 0; });
    return row;
  });
  // Light smoothing so single busy years don't spike the river.
  var data = raw.map(function (r, i) {
    var out = { year: r.year };
    STACK.forEach(function (k) {
      var a = raw[Math.max(0, i - 1)][k], b = r[k], c = raw[Math.min(raw.length - 1, i + 1)][k];
      out[k] = 0.25 * a + 0.5 * b + 0.25 * c + 0.15;
    });
    return out;
  });

  var W = 1000, H = 340, M = { t: 10, r: 8, b: 30, l: 8 };
  var x = d3.scaleLinear().domain([FIRST_YEAR, newest]).range([M.l, W - M.r]);
  var series = d3.stack().keys(STACK).offset(d3.stackOffsetWiggle).order(d3.stackOrderNone)(data);
  var lo = d3.min(series, function (s) { return d3.min(s, function (d) { return d[0]; }); });
  var hi = d3.max(series, function (s) { return d3.max(s, function (d) { return d[1]; }); });
  var y = d3.scaleLinear().domain([lo, hi]).range([H - M.b, M.t]);
  var area = d3.area().curve(d3.curveBasis)
    .x(function (d) { return x(d.data.year); })
    .y0(function (d) { return y(d[0]); })
    .y1(function (d) { return y(d[1]); });

  var label = {}; THEMES.forEach(function (t) { label[t.key] = t.label; });
  var svg = d3.select(root).append("svg")
    .attr("class", "stream-svg").attr("viewBox", "0 0 " + W + " " + H)
    .attr("role", "img")
    .attr("aria-label", "Stream chart of research themes in journal articles from " + FIRST_YEAR + " to " + newest + ".");
  var clipId = "stream-clip";
  var clipRect = svg.append("clipPath").attr("id", clipId).append("rect")
    .attr("class", "clip-rect").attr("x", 0).attr("y", 0).attr("height", H).attr("width", 0);
  var g = svg.append("g").attr("clip-path", "url(#" + clipId + ")");
  var yrLine = svg.append("line").attr("class", "yr-line").attr("y1", M.t).attr("y2", H - M.b);

  var layers = g.selectAll("path").data(series).enter().append("path")
    .attr("class", function (d) { return "layer layer-" + d.key; })
    .attr("d", area);

  // Labels sit where each stream is widest (desktop only).
  g.selectAll("text").data(series).enter().append("text")
    .attr("class", "s-label")
    .each(function (s) {
      var best = s.reduce(function (b, d, i) {
        var w = d[1] - d[0];
        return i > 0 && i < s.length - 1 && w > b.w ? { w: w, d: d } : b;
      }, { w: -1, d: s[1] });
      d3.select(this).attr("x", x(best.d.data.year)).attr("y", y((best.d[0] + best.d[1]) / 2) + 4)
        .attr("text-anchor", "middle").text(label[s.key]);
    });

  var axis = svg.append("g").attr("class", "axis").attr("transform", "translate(0," + (H - M.b + 8) + ")");
  years.forEach(function (yr, i) {
    if ((yr - FIRST_YEAR) % (window.innerWidth < 640 ? 3 : 1) && yr !== newest) return;
    axis.append("text").attr("x", x(yr)).attr("y", 14)
      .attr("text-anchor", i === 0 ? "start" : yr === newest ? "end" : "middle").text(yr);
  });

  function paint() {
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    var c = COLORS[dark ? "dark" : "light"];
    layers.attr("fill", function (d) { return c[d.key]; });
    legend.selectAll("i").style("background", function () { return c[this.parentNode.dataset.key]; });
  }

  // Legend doubles as a keyboard-friendly way to highlight a theme.
  var legend = d3.select(root).append("div").attr("class", "stream-legend");
  STACK.slice().reverse().forEach(function (k) {
    legend.append("button").attr("type", "button").attr("data-key", k)
      .html("<i></i>" + label[k])
      .on("mouseenter focus", function () { focusKey(k); })
      .on("mouseleave blur", function () { focusKey(null); });
  });
  var tip = d3.select(root).append("div").attr("class", "stream-tip");

  function focusKey(k) {
    svg.classed("hovering", !!k);
    layers.classed("on", function (d) { return d.key === k; });
    legend.selectAll("button").classed("on", function () { return this.dataset.key === k; });
    if (!k) { tip.classed("show", false); yrLine.style("opacity", null); }
  }

  layers.on("mousemove", function (ev, s) {
    focusKey(s.key);
    var pt = d3.pointer(ev, svg.node());
    var yr = Math.round(x.invert(pt[0]));
    var row = raw[yr - FIRST_YEAR];
    var total = STACK.reduce(function (n, k) { return n + row[k]; }, 0) || 1;
    var share = Math.round(100 * row[s.key] / total);
    yrLine.attr("x1", x(yr)).attr("x2", x(yr));
    var box = root.getBoundingClientRect(), sv = svg.node().getBoundingClientRect();
    tip.html("<b>" + label[s.key] + "</b><span>" + yr + " · about " + share + "% of that year's articles</span>")
      .style("left", Math.min(ev.clientX - box.left + 14, box.width - 260) + "px")
      .style("top", (ev.clientY - box.top - 50) + "px")
      .classed("show", true);
  }).on("mouseleave", function () { focusKey(null); });

  paint();
  new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function reveal() { root.classList.add("in"); clipRect.attr("width", W); }
  if (reduce || !("IntersectionObserver" in window)) { reveal(); return; }
  var io = new IntersectionObserver(function (en) {
    if (en[0].isIntersecting) { reveal(); io.disconnect(); }
  }, { threshold: 0.25 });
  io.observe(root);
})();
