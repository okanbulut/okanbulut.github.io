/* ==========================================================================
   Okan Bulut — Academic Portfolio
   "Ask about my research" chat widget. Answers come from the Vercel
   function in rag/vercel, which searches the full text of the papers.

   Include it on a page with:
     <script src="../assets/js/chat.js" data-endpoint="https://…vercel.app/api/chat"></script>
   Without a data-endpoint the widget stays hidden.
   ========================================================================== */

(function () {
  "use strict";

  var script = document.currentScript;
  var ENDPOINT = script && script.getAttribute("data-endpoint");
  if (!ENDPOINT) return;

  var STORE_KEY = "research-chat";
  var SUGGESTIONS = [
    "What are the main themes of Dr. Bulut's research?",
    "How has AI been used in educational assessment?",
    "What methods are used to detect disengaged test-taking?"
  ];

  var FOCUS_QUESTION = "What are the main findings of this paper?";

  var history = [];   // [{ role, content, sources?, followups? }]
  var focus = null;   // { key, title } when the chat is about one paper
  var busy = false;

  /* ---------- markup ---------- */

  var BOT_ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="4" y="8" width="16" height="12" rx="3.5"/><path d="M12 8V5"/><path d="M2 13v3M22 13v3"/><path d="M9.5 16.5h5"/>' +
      "</g>" +
      '<circle cx="12" cy="3.6" r="1.4" fill="currentColor"/>' +
      '<circle cx="9" cy="12.8" r="1.4" fill="currentColor"/><circle cx="15" cy="12.8" r="1.4" fill="currentColor"/>' +
    "</svg>";

  function avatar(cls) {
    var a = el("span", "chat-avatar" + (cls ? " " + cls : ""), { "aria-hidden": "true" });
    a.innerHTML = BOT_ICON;
    return a;
  }

  var launcher = el("button", "chat-launcher", { type: "button", "aria-expanded": "false", "aria-controls": "chat-panel" });
  launcher.innerHTML = BOT_ICON + "<span>Ask about my research</span>";

  var panel = el("section", "chat-panel", { id: "chat-panel", role: "dialog", "aria-label": "Ask about Okan Bulut's research", hidden: "" });
  panel.innerHTML =
    '<header class="chat-head">' +
      '<div class="chat-head-title">' +
        '<span class="chat-avatar chat-avatar-lg" aria-hidden="true">' + BOT_ICON + "</span>" +
        "<div><strong>Ask about my research</strong>" +
        "<small>Please check the cited paper before relying on any detail.</small></div>" +
      "</div>" +
      '<div class="chat-head-actions">' +
        '<button type="button" class="chat-icon-btn" data-act="clear" aria-label="Start a new conversation" title="New conversation">' +
          '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4"/></svg></button>' +
        '<button type="button" class="chat-icon-btn" data-act="close" aria-label="Close chat" title="Close">' +
          '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      "</div>" +
    "</header>" +
    '<div class="chat-log" aria-live="polite"></div>' +
    '<div class="chat-focus" hidden></div>' +
    '<form class="chat-form">' +
      '<label class="sr-only" for="chat-input">Your question</label>' +
      '<textarea id="chat-input" rows="1" maxlength="600" placeholder="Ask a question about my papers…"></textarea>' +
      '<button type="submit" class="chat-send" aria-label="Send">' +
        '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M3 20.5 21 12 3 3.5l2.5 8.5L3 20.5Zm2.5-8.5H13"/></svg></button>' +
    "</form>";

  document.body.appendChild(launcher);
  document.body.appendChild(panel);

  var log = panel.querySelector(".chat-log");
  var focusBar = panel.querySelector(".chat-focus");
  var form = panel.querySelector(".chat-form");
  var input = panel.querySelector("textarea");
  var sendBtn = panel.querySelector(".chat-send");

  /* ---------- open / close ---------- */

  function setOpen(open) {
    panel.hidden = !open;
    launcher.setAttribute("aria-expanded", open ? "true" : "false");
    launcher.classList.toggle("is-hidden", open);
    if (open) { input.focus(); scrollDown(); } else { launcher.focus(); }
  }

  launcher.addEventListener("click", function () { setOpen(true); });
  panel.addEventListener("click", function (e) {
    var act = e.target.closest("[data-act]");
    if (!act) return;
    if (act.getAttribute("data-act") === "close") setOpen(false);
    if (act.getAttribute("data-act") === "clear" && !busy) { history = []; focus = null; save(); render(); input.focus(); }
    if (act.getAttribute("data-act") === "unfocus" && !busy) { focus = null; save(); render(); input.focus(); }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !panel.hidden) setOpen(false);
  });

  /* ---------- input ---------- */

  input.addEventListener("input", autosize);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : submit(e); }
  });
  form.addEventListener("submit", submit);

  function autosize() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 120) + "px";
    input.style.overflowY = input.scrollHeight > 120 ? "auto" : "hidden";
  }

  function submit(e) {
    if (e) e.preventDefault();
    var q = input.value.trim();
    if (!q || busy) return;
    input.value = "";
    autosize();
    ask(q);
  }

  /* ---------- talking to the chat function ---------- */

  function ask(question) {
    busy = true;
    sendBtn.disabled = true;
    history.push({ role: "user", content: question });
    var reply = { role: "assistant", content: "", sources: [], pending: true };
    history.push(reply);
    render();

    var payload = history.slice(0, -1).map(function (m) { return { role: m.role, content: m.content }; });

    var body = { messages: payload };
    if (focus) body.paper = focus.key;

    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          throw new Error(body.error || "The assistant is unavailable right now. Please try again later.");
        });
      }
      return readEvents(res.body, function (ev) {
        if (ev.type === "sources") reply.sources = ev.sources;
        else if (ev.type === "status") reply.status = ev.text;
        else if (ev.type === "text") reply.content += ev.text;
        else if (ev.type === "followups") reply.followups = ev.questions;
        else if (ev.type === "done" && ev.truncated) reply.content += "\n\n*(Answer cut short.)*";
        else if (ev.type === "error") {
          if (ev.discard) { reply.content = ""; reply.sources = []; }
          reply.error = ev.message;
        }
        updateLast(reply);
      });
    }).catch(function (err) {
      reply.error = err && err.message && !/fetch|network/i.test(err.message)
        ? err.message
        : "Couldn't reach the assistant. Check your connection and try again.";
    }).then(function () {
      reply.pending = false;
      if (!reply.content && !reply.error) reply.error = "No answer came back. Please try again.";
      // A failed turn shouldn't be sent back as context next time.
      if (reply.error && !reply.content) { history.splice(history.length - 2, 2); history.push({ role: "notice", content: reply.error, question: question }); }
      busy = false;
      sendBtn.disabled = false;
      save();
      render();
      input.focus();
    });
  }

  // Parse a text/event-stream body: "data: {json}\n\n" records.
  function readEvents(body, onEvent) {
    var reader = body.getReader();
    var decoder = new TextDecoder();
    var buf = "";
    function pump() {
      return reader.read().then(function (r) {
        buf += decoder.decode(r.value || new Uint8Array(), { stream: !r.done });
        var parts = buf.split("\n\n");
        buf = parts.pop();
        parts.forEach(function (rec) {
          var line = rec.split("\n").filter(function (l) { return l.indexOf("data:") === 0; }).map(function (l) { return l.slice(5).trim(); }).join("");
          if (!line) return;
          try { onEvent(JSON.parse(line)); } catch (e) { /* ignore malformed record */ }
        });
        if (!r.done) return pump();
      });
    }
    return pump();
  }

  /* ---------- rendering ---------- */

  function render() {
    renderFocus();
    log.innerHTML = "";
    if (!history.length) {
      var intro = el("div", "chat-msg chat-bot chat-intro");
      intro.appendChild(avatar());
      var introBody = el("div", "chat-body");
      introBody.innerHTML = "<p>Hi! I'm an AI assistant for Dr. Bulut's research. Ask about the studies, methods, and findings in his published work; my answers cite the papers they draw on.</p>";
      var list = el("div", "chat-suggest");
      SUGGESTIONS.forEach(function (s) {
        var b = el("button", "chat-chip", { type: "button" });
        b.textContent = s;
        b.addEventListener("click", function () { if (!busy) ask(s); });
        list.appendChild(b);
      });
      introBody.appendChild(list);
      intro.appendChild(introBody);
      log.appendChild(intro);
      return;
    }
    history.forEach(function (m) { log.appendChild(bubble(m)); });
    scrollDown();
  }

  // "Asking about: <paper>" bar above the input while the chat is focused.
  function renderFocus() {
    focusBar.hidden = !focus;
    input.placeholder = focus ? "Ask about this paper…" : "Ask a question about my papers…";
    if (!focus) { focusBar.innerHTML = ""; return; }
    focusBar.innerHTML =
      '<span class="chat-focus-label">Asking about:</span> <span class="chat-focus-title"></span>' +
      '<button type="button" class="chat-icon-btn" data-act="unfocus" aria-label="Stop focusing on this paper" title="Ask about all papers">' +
        '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg></button>';
    focusBar.querySelector(".chat-focus-title").textContent = focus.title;
  }

  function updateLast(m) {
    var last = log.lastElementChild;
    if (last) log.replaceChild(bubble(m), last);
    scrollDown();
  }

  function bubble(m) {
    if (m.role === "notice") {
      var n = el("div", "chat-msg chat-notice");
      n.textContent = m.content + " ";
      var retry = el("button", "chat-retry", { type: "button" });
      retry.textContent = "Retry";
      retry.addEventListener("click", function () {
        if (busy) return;
        history.splice(history.indexOf(m), 1);
        ask(m.question);
      });
      n.appendChild(retry);
      return n;
    }
    var row = el("div", "chat-msg " + (m.role === "user" ? "chat-user" : "chat-bot"));
    if (m.role === "user") { row.textContent = m.content; return row; }

    // Bot replies: avatar on the left, content beside it.
    row.appendChild(avatar());
    var div = el("div", "chat-body");
    row.appendChild(div);

    if (m.content) {
      var body = el("div", "chat-text");
      body.innerHTML = formatAnswer(m.content, m.sources || []);
      div.appendChild(body);
    } else if (m.pending) {
      div.appendChild(el("div", "chat-typing", { "aria-label": "Searching papers" }));
      div.lastChild.innerHTML = "<span></span><span></span><span></span>";
      if (m.status) {
        var st = el("p", "chat-status");
        st.textContent = m.status;
        div.appendChild(st);
      }
    }
    if (m.error) {
      var err = el("p", "chat-error");
      err.textContent = m.error;
      div.appendChild(err);
    }
    var cited = citedSources(m.content, m.sources || []);
    if (cited.length && !m.pending) {
      var src = el("ol", "chat-sources");
      cited.forEach(function (s) {
        var li = el("li", "", { value: String(s.n) });
        var label = s.title + (s.year ? " (" + s.year + ")" : "");
        if (s.url) {
          var a = el("a", "", { href: s.url, target: "_blank", rel: "noopener" });
          a.textContent = label;
          li.appendChild(a);
        } else {
          li.textContent = label;
        }
        src.appendChild(li);
      });
      div.appendChild(src);
    }
    // Suggested next questions, on the latest answer only.
    if (m.followups && m.followups.length && !m.pending && m === history[history.length - 1]) {
      var fu = el("div", "chat-suggest chat-followups");
      m.followups.forEach(function (q) {
        var b = el("button", "chat-chip", { type: "button" });
        b.textContent = q;
        b.addEventListener("click", function () { if (!busy) ask(q); });
        fu.appendChild(b);
      });
      div.appendChild(fu);
    }
    return row;
  }

  // Only list the sources the answer actually cites.
  function citedSources(text, sources) {
    var used = {};
    (text.match(/\[(\d+)\]/g) || []).forEach(function (t) { used[t.slice(1, -1)] = true; });
    return sources.filter(function (s) { return used[String(s.n)]; });
  }

  // Minimal, safe Markdown: escape everything, then paragraphs, bullets,
  // **bold**, *italic*, and [n] citation links.
  function formatAnswer(text, sources) {
    var byN = {};
    sources.forEach(function (s) { byN[s.n] = s; });
    var html = escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, "$1<em>$2</em>")
      .replace(/( ?)\[(\d+)\]/g, function (m, space, n) {
        var s = byN[n];
        // A number that matches no source is dropped (once sources are
        // known), so stray citations don't show up as raw "[2]" text.
        if (!s) return sources.length ? "" : m;
        return space + (s.url
          ? '<a class="chat-cite" href="' + escapeHtml(s.url) + '" target="_blank" rel="noopener" title="' + escapeHtml(s.title) + '">' + n + "</a>"
          : '<span class="chat-cite" title="' + escapeHtml(s.title) + '">' + n + "</span>");
      });
    return html.split(/\n{2,}/).map(function (block) {
      var lines = block.split("\n");
      if (lines.every(function (l) { return /^\s*([-*•]|\d+\.)\s+/.test(l); })) {
        return "<ul>" + lines.map(function (l) { return "<li>" + l.replace(/^\s*([-*•]|\d+\.)\s+/, "") + "</li>"; }).join("") + "</ul>";
      }
      return "<p>" + lines.join("<br>") + "</p>";
    }).join("");
  }

  /* ---------- utilities ---------- */

  function el(tag, cls, attrs) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    return node;
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function scrollDown() { log.scrollTop = log.scrollHeight; }

  // Keep the conversation for this browser tab only.
  function save() {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify({
        history: history.filter(function (m) { return !m.pending; }),
        focus: focus
      }));
    } catch (e) { /* storage blocked */ }
  }
  try {
    var saved = JSON.parse(sessionStorage.getItem(STORE_KEY) || "null");
    if (Array.isArray(saved)) history = saved;
    else if (saved) { history = saved.history || []; focus = saved.focus || null; }
  } catch (e) { history = []; focus = null; }

  /* ---------- "Ask AI" buttons on the Publications page ---------- */

  // Same fingerprint as citationKey() in rag/vercel/lib/search.js: change both together.
  function citationKey(citation) {
    var s = citation.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return ("0000000" + h.toString(16)).slice(-8);
  }

  function citationText(li) {
    var copy = li.cloneNode(true);
    copy.querySelectorAll(".cite-note, .cite-ask").forEach(function (n) { n.remove(); });
    return copy.textContent.replace(/\s+/g, " ").trim();
  }

  // APA: "Authors (Year). Title. Source…" — falls back to the start of the citation.
  function titleOf(text) {
    var m = text.match(/\)\.\s+(.+?[.?!])(\s|$)/);
    var t = m ? m[1].replace(/\.$/, "") : text;
    return t.length > 110 ? t.slice(0, 107) + "…" : t;
  }

  function askAboutPaper(key, title) {
    if (busy) return;
    history = [];
    focus = { key: key, title: title };
    setOpen(true);
    ask(FOCUS_QUESTION);
  }

  function addPaperButtons() {
    var items = document.querySelectorAll(".cite-list > li");
    if (!items.length) return;
    fetch(ENDPOINT).then(function (r) { return r.ok ? r.json() : { keys: [] }; }).then(function (info) {
      var keys = {};
      (info.keys || []).forEach(function (k) { keys[k] = true; });
      items.forEach(function (li) {
        if (li.querySelector(".cite-ask")) return;
        var text = citationText(li);
        var key = citationKey(text);
        if (!keys[key]) return;
        var btn = el("button", "cite-ask", { type: "button", "aria-label": "Ask the AI assistant about this paper", title: "Ask the AI assistant about this paper" });
        btn.innerHTML = BOT_ICON;
        btn.addEventListener("click", function () { askAboutPaper(key, titleOf(text)); });
        var note = li.querySelector(".cite-note");
        li.insertBefore(btn, note);
      });
    }).catch(function () { /* no buttons if the endpoint is unreachable */ });
  }

  render();
  addPaperButtons();
})();
