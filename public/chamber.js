(() => {
  "use strict";

  const KEY = "epic-sota-chamber-key";
  const GRAPH = "epic-sota-chamber-graph-v6";
  const $ = (id) => document.getElementById(id);
  const logEl = () => $("log");

  const state = {
    title: "Untitled weave",
    nodes: [],
    edges: [],
    selected: null,
    pan: { x: 0, y: 0 },
    linking: null,
    cursor: null,
    running: false,
    library: [],
  };

  function log(msg) {
    const line = document.createElement("div");
    line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logEl().prepend(line);
  }

  function uid() {
    return "n-" + Math.random().toString(36).slice(2, 8);
  }

  function key() {
    return sessionStorage.getItem(KEY) || localStorage.getItem(KEY) || "";
  }

  function saveGraph() {
    const blob = {
      title: state.title,
      nodes: state.nodes,
      edges: state.edges,
      ts: Date.now(),
    };
    localStorage.setItem(GRAPH, JSON.stringify(blob));
    $("title").value = state.title;
    window.__chamberState = { nodes: state.nodes, edges: state.edges, library: state.library, title: state.title };
    if (window.ChamberAccount && window.ChamberAccount.signedIn && window.ChamberAccount.syncUp) {
      clearTimeout(window.__dbT);
      window.__dbT = setTimeout(() => window.ChamberAccount.syncUp(), 2500);
    }
  }

  function loadGraph() {
    try {
      const raw = JSON.parse(localStorage.getItem(GRAPH) || "null");
      if (!raw) return false;
      state.title = raw.title || state.title;
      state.nodes = raw.nodes || [];
      state.edges = raw.edges || [];
      return true;
    } catch {
      return false;
    }
  }

  window.__chamberApplyGraph = function applyGraph(raw) {
    if (!raw || !Array.isArray(raw.nodes) || !raw.nodes.length) return;
    state.title = raw.title || state.title;
    state.nodes = raw.nodes.map((n) => ({
      id: n.id,
      cap: n.cap,
      x: n.x || 40,
      y: n.y || 70,
      input: n.input || { prompt: "" },
      output: n.output || null,
      status: n.status || "",
    }));
    state.edges = raw.edges || [];
    saveGraph();
    draw();
    if (state.nodes[0]) inspect(state.nodes[0]);
  };

  function seed() {
    state.title = "How a weave connects";
    const brief = "Void-black chamber, cyan structure, magenta heat. Epic Tech AI capability atelier.";
    state.nodes = [
      { id: "n-brief", cap: "design", x: 40, y: 70, input: { prompt: brief }, output: null, status: "" },
      { id: "n-mem", cap: "memory", x: 280, y: 70, input: { action: "upsert", text: brief }, output: null, status: "" },
      { id: "n-glyph", cap: "glyph", x: 40, y: 230, input: { prompt: "void reactor cyan magenta" }, output: null, status: "" },
      { id: "n-folio", cap: "folio", x: 280, y: 230, input: { prompt: brief, format: "md" }, output: null, status: "" },
      { id: "n-imagine", cap: "imagine", x: 520, y: 70, input: { prompt: brief }, output: null, status: "" },
      { id: "n-pulse", cap: "pulse", x: 520, y: 230, input: {}, output: null, status: "" },
      { id: "n-agent", cap: "agent", x: 40, y: 390, input: { prompt: brief }, output: null, status: "" },
    ];
    state.edges = [
      { from: "n-brief", to: "n-mem" },
      { from: "n-brief", to: "n-imagine" },
      { from: "n-brief", to: "n-agent" },
      { from: "n-glyph", to: "n-folio" },
    ];
  }

  function capDef(id) {
    return SOTA.caps.get(id) || { id, title: id, desc: "", kind: "local" };
  }

  const FLOWS = [
    {
      id: "imagine",
      title: "Still",
      tag: "PIC",
      prompt:
        "Single hero still, no type. Void-black chamber core, cyan hex reactor ring, magenta heat spark on the rim, dust motes in a shaft of cyan, vinyl-black negative space, anamorphic flare, 8K product still energy, no logos, no people, one object of power sitting in the dark like a relic pulled from a crate at 4am.",
    },
    {
      id: "video",
      title: "Motion",
      tag: "VID",
      prompt:
        "480-seconds cinematic void trailer. Camera hunts the chamber: crash-zoom on the cyan ring, whip-pan into magenta heat, handheld grit then locked-off god-shot, turntable-speed crash cuts, loop-the-loop push-ins, vinyl-scratch jump-cuts, dub delay on the lights, funk-record drop as the floor falls away, live-improv camera fury, no logos, no faces, motion only.",
    },
    {
      id: "voice",
      title: "Voice",
      tag: "SAY",
      prompt:
        "Spoken-word masterclass, 480-seconds in the mouth. Dry close mic, vinyl warmth, jungle heritage in the consonants, rocket-fuel breath, black-gold hip-hop cadence. Read it like a selector at the cut: short hits, then a long roll. Line: Epic SOTA Chamber. Cyan cut. Magenta sting. The record does not stop. Improvise the rest as a live drop, no lecture, no brand list.",
    },
    {
      id: "music",
      title: "Music",
      tag: "TRK",
      prompt:
        "480-Seconds, pure DJ style with raw scratch techniques, beat juggling intricate loops, rapid-fire Ave, dub, and funk records, record droppings, live improvisation turntable fury, hip-hop instrumental masterclass, phantom heart breaks, loop magnetism, earth taping gritty bass, chaos-coordinated rhythm, mystical rhythm horn, vinyl warmth, jungle heritage, rocket fuel black gold hip-hop, black gold hip-hop",
    },
    {
      id: "game",
      title: "Sprite",
      tag: "SPR",
      prompt:
        "Four-frame sprite sheet, same character, same palette. Neon chamber walker: cyan outline, magenta core, black gold fill, vinyl-scratch smear on the contact frame, dub-delay afterimage on frame three, funk-pop on the plant, no text, game-ready, loopable walk, one silhouette you could pick out at 32 pixels.",
    },
    {
      id: "media",
      title: "Pack",
      tag: "ALL",
      prompt:
        "Full SOTA pack from one brief. Still: relic in the void-black chamber, cyan hex, magenta spark. Motion: 480-second hunt with scratch-cuts and dub light. Voice: selector cadence, cyan cut, magenta sting. Music: 480-seconds pure DJ style, raw scratch, beat juggle, funk records, gritty bass, vinyl warmth, black gold hip-hop. Same world, four different media, no logos, no sibling products.",
    },
    {
      id: "stitch",
      title: "Stitch",
      tag: "STCH",
      prompt:
        "Stitch every take in the libraries into one final. Picture from stills and motion frames. Soundtrack from music plus voice. Output a single video of whatever we have — any type in, one finished media out.",
    },
  ];
  const TOOLS = ["glyph", "design", "agent", "research", "memory", "folio", "pulse"];

  function renderRail() {
    const rail = $("rail");
    rail.innerHTML = "";
    const make = document.createElement("h3");
    make.textContent = "Make";
    rail.appendChild(make);
    for (const f of FLOWS) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cap make";
      b.innerHTML = `<b>${f.tag}</b><span>${f.title}</span>`;
      b.title = "Drop a " + f.title + " generator. Type the ask. Generate.";
      b.addEventListener("click", () => dropFlow(f));
      rail.appendChild(b);
    }
    const tools = document.createElement("h3");
    tools.textContent = "Wire";
    rail.appendChild(tools);
    for (const id of TOOLS) {
      const c = capDef(id);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cap";
      b.innerHTML = `<b>W</b><span>${c.title}</span>`;
      b.title = c.desc || id;
      b.addEventListener("click", () => addNode(id));
      rail.appendChild(b);
    }
  }

  function addNode(capId, x, y, prompt) {
    const n = {
      id: uid(),
      cap: capId,
      x: x ?? 80 + (state.nodes.length % 3) * 220,
      y: y ?? 60 + Math.floor(state.nodes.length / 3) * 130,
      input: { prompt: prompt || "" },
      output: null,
      status: "",
    };
    state.nodes.push(n);
    state.selected = n.id;
    saveGraph();
    draw();
    inspect(n);
    return n;
  }

  function laneOf(cap) {
    if (cap === "imagine" || cap === "glyph" || cap === "game") return "imagine";
    if (cap === "video") return "video";
    if (cap === "voice") return "voice";
    if (cap === "music" || cap === "score") return "music";
    if (cap === "stitch") return "pack";
    return "pack";
  }

  function remember(n, payload) {
    if (!payload || payload.ok === false) return;
    const item = {
      id: uid(),
      cap: n.cap,
      lane: laneOf(n.cap),
      title: capDef(n.cap).title,
      prompt: (n.input && n.input.prompt) || "",
      ts: Date.now(),
      text: String(payload.markdown || payload.text || payload.value || "").slice(0, 2000),
      dataUrl: payload.dataUrl || "",
      frames: payload.frames || [],
      videoUrl: payload.videoUrl || "",
      audio: payload.audioUrl || (payload.dataUrl && String(payload.dataUrl).startsWith("data:audio") ? payload.dataUrl : ""),
      mime: payload.mime || "",
      recipe: payload.recipe || null,
    };
    if (!item.frames.length && item.dataUrl && String(item.dataUrl).startsWith("data:image")) item.frames = [item.dataUrl];
    state.library.unshift(item);
    state.library = state.library.slice(0, 80);
    if (SOTA.idb) {
      SOTA.idb("library", "readwrite", (s) => SOTA.wrapReq(s.put(item))).catch(() => {});
    }
    renderLibs();
  }

  function renderLibs() {
    const lanes = ["imagine", "video", "voice", "music", "pack"];
    for (const lane of lanes) {
      const box = $("lib-" + lane);
      if (!box) continue;
      const items = state.library.filter((x) => x.lane === lane);
      box.innerHTML = "";
      if (!items.length) {
        const e = document.createElement("div");
        e.className = "empty";
        e.textContent = "empty";
        box.appendChild(e);
        continue;
      }
      for (const it of items.slice(0, 12)) {
        const row = document.createElement("div");
        row.className = "lib-item";
        const when = new Date(it.ts).toLocaleTimeString();
        const thumb = it.frames[0] || (it.dataUrl && String(it.dataUrl).startsWith("data:image") ? it.dataUrl : "");
        const mediaBit = it.videoUrl
          ? `<video src="${it.videoUrl}" muted loop playsinline></video>`
          : thumb
            ? `<img alt="" src="${thumb}">`
            : `<div></div>`;
        row.innerHTML = mediaBit + `<div class="meta"><b>${it.title}</b><span>${when}</span></div>`;
        if (it.audio) {
          const au = document.createElement("audio");
          au.controls = true;
          au.src = it.audio;
          row.appendChild(au);
        }
        row.addEventListener("click", () => showLibItem(it));
        box.appendChild(row);
      }
    }
  }

  function showLibItem(it) {
    const n = {
      id: it.id,
      cap: it.cap,
      input: { prompt: it.prompt },
      output: it,
      status: "ok",
    };
    state.selected = null;
    inspect(n);
    $("ins-title").textContent = it.title + " · library";
    $("ins-meta").textContent = new Date(it.ts).toLocaleString() + " · " + (it.prompt || "").slice(0, 120);
  }

  function dropFlow(flow) {
    ignoreNodePointer = true;
    drag = null;
    document.body.style.cursor = "";
    state.nodes = [];
    state.edges = [];
    state.title = flow.title + " flow";
    $("title").value = state.title;
    if (flow.id === "media") {
      const brief = addNode("design", 40, 70, flow.prompt);
      const still = addNode("imagine", 280, 70, flow.prompt);
      const motion = addNode("video", 520, 70, flow.prompt);
      const voice = addNode("voice", 280, 220, flow.prompt);
      const music = addNode("music", 520, 220, flow.prompt);
      state.edges = [
        { from: brief.id, to: still.id },
        { from: brief.id, to: motion.id },
        { from: brief.id, to: voice.id },
        { from: brief.id, to: music.id },
      ];
      state.selected = brief.id;
      saveGraph();
      draw();
      inspect(brief);
      $("hint").textContent = "Pack: Spec wires into Still, Motion, Voice, Music. Running weave.";
      runWeave();
      return brief;
    }
    const gen = addNode(flow.id, 80, 90, flow.prompt);
    state.selected = gen.id;
    saveGraph();
    draw();
    inspect(gen);
    $("hint").textContent = flow.title + " generator. Wired to its own lane in the library below.";
    runNode(gen);
    return gen;
  }

  function nodeById(id) {
    return state.nodes.find((n) => n.id === id);
  }

  function portXY(sel) {
    const stage = $("stage").getBoundingClientRect();
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2 - stage.left, y: r.top + r.height / 2 - stage.top };
  }

  function wirePath(x1, y1, x2, y2, color, width, label) {
    const svg = $("wires");
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const m = (x1 + x2) / 2;
    p.setAttribute("d", `M ${x1} ${y1} C ${m} ${y1}, ${m} ${y2}, ${x2} ${y2}`);
    p.setAttribute("fill", "none");
    p.setAttribute("stroke", color);
    p.setAttribute("stroke-width", String(width));
    p.setAttribute("stroke-linecap", "round");
    svg.appendChild(p);
    if (label) {
      const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("x", String(m));
      t.setAttribute("y", String((y1 + y2) / 2 - 8));
      t.setAttribute("fill", color);
      t.setAttribute("font-size", "11");
      t.setAttribute("text-anchor", "middle");
      t.textContent = label;
      svg.appendChild(t);
    }
  }

  function drawWires() {
    const svg = $("wires");
    svg.innerHTML = "";
    for (const e of state.edges) {
      const a = portXY(`[data-id="${e.from}"] .port.out`);
      const b = portXY(`[data-id="${e.to}"] .port.in`);
      if (!a || !b) continue;
      const from = capDef(nodeById(e.from).cap).title;
      const to = capDef(nodeById(e.to).cap).title;
      wirePath(a.x, a.y, b.x, b.y, "#00f3ff", 3.5, from + " → " + to);
    }
    if (state.linking && state.cursor) {
      const a = portXY(`[data-id="${state.linking}"] .port.out`);
      if (a) wirePath(a.x, a.y, state.cursor.x, state.cursor.y, "#ff00aa", 2.5, "drop on IN");
    }
  }

  function draw() {
    const wrap = $("nodes");
    wrap.innerHTML = "";
    for (const n of state.nodes) {
      const d = capDef(n.cap);
      const el = document.createElement("div");
      el.className = "node" + (state.selected === n.id ? " on" : "") + (n.status === "bad" ? " bad" : "") + (n.status === "ok" ? " ok" : "");
      el.dataset.id = n.id;
      el.style.left = n.x + "px";
      el.style.top = n.y + "px";
      el.innerHTML = `<div class="k">${d.kind}</div><h4>${d.title}</h4><div class="port in" data-port="in"></div><div class="port out" data-port="out"></div>`;
      el.addEventListener("pointerdown", onNodeDown);
      wrap.appendChild(el);
    }
    requestAnimationFrame(drawWires);
  }

  let drag = null;
  let ignoreNodePointer = false;

  function endPointer(ev) {
    ignoreNodePointer = false;
    if (ev && ev.currentTarget && ev.pointerId != null) {
      try {
        ev.currentTarget.releasePointerCapture(ev.pointerId);
      } catch {
        /* already released */
      }
    }
    document.querySelectorAll(".node").forEach((el) => {
      el.classList.remove("dragging");
    });
    if (drag) {
      if (drag.moved) saveGraph();
      drag = null;
    }
    if (state.linking && ev && ev.type === "pointerup") {
      /* keep linking until next IN click or escape */
    }
    document.body.style.cursor = "";
  }

  function onNodeDown(ev) {
    if (ignoreNodePointer || ev.button !== 0) return;
    const id = ev.currentTarget.dataset.id;
    const port = ev.target.closest(".port");
    if (port) {
      ev.stopPropagation();
      if (port.dataset.port === "out") {
        state.linking = id;
        log("wire from " + capDef(nodeById(id).cap).title);
      } else if (state.linking && state.linking !== id) {
        if (!state.edges.some((e) => e.from === state.linking && e.to === id)) {
          state.edges.push({ from: state.linking, to: id });
        }
        state.linking = null;
        saveGraph();
        draw();
      }
      return;
    }
    state.selected = id;
    document.querySelectorAll(".node").forEach((el) => el.classList.toggle("on", el.dataset.id === id));
    inspect(nodeById(id));
    drag = {
      id,
      dx: ev.clientX - nodeById(id).x,
      dy: ev.clientY - nodeById(id).y,
      sx: ev.clientX,
      sy: ev.clientY,
      moved: false,
      pointerId: ev.pointerId,
    };
    ev.preventDefault();
  }

  $("stage").addEventListener("pointermove", (ev) => {
    const stage = $("stage").getBoundingClientRect();
    state.cursor = { x: ev.clientX - stage.left, y: ev.clientY - stage.top };
    if (state.linking) drawWires();
    if (!drag) return;
    const dist = Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy);
    if (!drag.moved && dist < 6) return;
    drag.moved = true;
    document.body.style.cursor = "grabbing";
    const n = nodeById(drag.id);
    if (!n) {
      drag = null;
      return;
    }
    n.x = Math.max(8, ev.clientX - drag.dx);
    n.y = Math.max(8, ev.clientY - drag.dy);
    const el = document.querySelector(`[data-id="${n.id}"]`);
    if (el) {
      el.style.left = n.x + "px";
      el.style.top = n.y + "px";
      el.classList.add("dragging");
    }
    drawWires();
  });
  window.addEventListener("pointerup", endPointer);
  window.addEventListener("pointercancel", endPointer);
  window.addEventListener("blur", () => endPointer({}));
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      state.linking = null;
      endPointer({});
      drawWires();
    }
  });

  function inspect(n) {
    if (!n) return;
    const d = capDef(n.cap);
    $("ins-title").textContent = d.title;
    const fed = parents(n.id).map((p) => capDef(p.cap).title);
    const feeds = state.edges.filter((e) => e.from === n.id).map((e) => capDef(nodeById(e.to).cap).title);
    const flow = [
      d.desc,
      fed.length ? "IN from: " + fed.join(", ") : "IN: type here, or wire another OUT into this magenta port",
      feeds.length ? "OUT to: " + feeds.join(", ") : "OUT: click the cyan port, then another node's magenta IN",
    ].join(" · ");
    $("ins-meta").textContent = flow;
    const body = $("ins-body");
    body.innerHTML = "";
    const lab = document.createElement("label");
    lab.textContent = "What to make";
    const ta = document.createElement("textarea");
    ta.rows = 8;
    ta.value = n.input.prompt || n.input.code || n.input.text || n.input.url || "";
    const apply = () => {
      n.input.prompt = ta.value;
      n.input.code = ta.value;
      n.input.url = ta.value;
      n.input.text = ta.value;
      n.input.markdown = ta.value;
      saveGraph();
    };
    ta.addEventListener("input", apply);
    ta.addEventListener("change", apply);
    const run = document.createElement("button");
    run.type = "button";
    run.textContent = "Generate";
    run.addEventListener("click", () => runNode(n));
    const del = document.createElement("button");
    del.type = "button";
    del.className = "ghost";
    del.textContent = "Remove";
    del.addEventListener("click", () => {
      state.nodes = state.nodes.filter((x) => x.id !== n.id);
      state.edges = state.edges.filter((e) => e.from !== n.id && e.to !== n.id);
      state.selected = null;
      saveGraph();
      draw();
    });
    const pre = document.createElement("pre");
    const readable = n.output && (n.output.markdown || n.output.text || n.output.value || n.output.error);
    pre.textContent = readable
      ? String(readable).slice(0, 8000)
      : n.output
        ? JSON.stringify(n.output, null, 2).slice(0, 4000)
        : "(no output yet)";
    if (n.status === "bad") pre.className = "err";
    body.append(lab, ta, document.createElement("div"));
    const row = document.createElement("div");
    row.className = "row";
    row.style.margin = "8px 0";
    row.append(run, del);
    body.append(row, pre);
    const out = n.output || {};
    if (out.videoUrl) {
      const v = document.createElement("video");
      v.className = "preview";
      v.controls = true;
      v.playsInline = true;
      v.loop = true;
      v.src = out.videoUrl;
      body.appendChild(v);
    } else {
      const frames = out.frames || (out.dataUrl && String(out.dataUrl).startsWith("data:image") ? [out.dataUrl] : []);
      for (const src of frames) {
        if (!src || typeof src !== "string") continue;
        if (src.startsWith("data:image") || src.startsWith("http")) {
          const im = document.createElement("img");
          im.className = "preview";
          im.alt = "generated";
          im.src = src;
          body.appendChild(im);
        }
      }
    }
    const audioSrc = out.audioUrl || (out.dataUrl && String(out.dataUrl).startsWith("data:audio") ? out.dataUrl : "");
    if (audioSrc) {
      const au = document.createElement("audio");
      au.controls = true;
      au.src = audioSrc;
      au.className = "preview";
      body.appendChild(au);
    }
  }

  function parents(id) {
    return state.edges.filter((e) => e.to === id).map((e) => nodeById(e.from)).filter(Boolean);
  }

  function topo() {
    const indeg = new Map(state.nodes.map((n) => [n.id, 0]));
    for (const e of state.edges) indeg.set(e.to, (indeg.get(e.to) || 0) + 1);
    const q = state.nodes.filter((n) => !indeg.get(n.id)).map((n) => n.id);
    const out = [];
    while (q.length) {
      const id = q.shift();
      out.push(id);
      for (const e of state.edges.filter((x) => x.from === id)) {
        indeg.set(e.to, indeg.get(e.to) - 1);
        if (indeg.get(e.to) === 0) q.push(e.to);
      }
    }
    for (const n of state.nodes) if (!out.includes(n.id)) out.push(n.id);
    return out.map(nodeById);
  }

  async function runNode(n) {
    n.status = "";
    const incoming = parents(n.id)
      .map((p) => p.output)
      .filter(Boolean);
    if (incoming.length) {
      const last = incoming[incoming.length - 1];
      if (last.markdown && !n.input.prompt) n.input.prompt = last.markdown;
      if (last.text && n.cap === "memory") n.input.text = last.text;
      if (typeof last === "object") n.input.from = last;
    }
    if (n.cap === "stitch") n.input.library = state.library;
    log("run " + capDef(n.cap).title);
    const out = await SOTA.invoke(n.cap, n.input, { key: key() });
    n.output = out.ok ? (out.result || out) : out;
    n.status = out.ok ? "ok" : "bad";
    if (!out.ok) log("fail " + (out.error || n.cap));
    else log("ok " + n.cap);
    if (out.ok) remember(n, n.output);
    saveGraph();
    draw();
    if (state.selected === n.id) inspect(n);
    if (n.cap === "folio" && out.ok && out.result && out.result.content) {
      const blob = new Blob([out.result.content], { type: out.result.type });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = out.result.filename;
      a.click();
    }
    return out;
  }

  async function runWeave() {
    if (state.running) return;
    state.running = true;
    $("run").disabled = true;
    log("weave start");
    for (const n of topo()) {
      await runNode(n);
    }
    log("weave done");
    state.running = false;
    $("run").disabled = false;
  }

  function renderSpot(q) {
    const list = $("spot-list");
    list.innerHTML = "";
    const items = [
      ...SOTA.catalog().map((c) => ({ t: "Drop " + c.title, run: () => addNode(c.id) })),
      { t: "Run weave", run: runWeave },
      { t: "Export graph JSON", run: exportGraph },
      { t: "Clear field", run: () => { state.nodes = []; state.edges = []; saveGraph(); draw(); } },
    ].filter((x) => !q || x.t.toLowerCase().includes(q.toLowerCase()));
    items.forEach((it, i) => {
      const li = document.createElement("li");
      li.textContent = it.t;
      if (i === 0) li.className = "on";
      li.addEventListener("click", () => { it.run(); closeSpot(); });
      list.appendChild(li);
    });
  }

  function openSpot() {
    $("spot").classList.remove("hidden");
    $("spot-q").value = "";
    renderSpot("");
    $("spot-q").focus();
  }
  function closeSpot() {
    $("spot").classList.add("hidden");
  }

  function exportGraph() {
    const blob = new Blob([JSON.stringify({ title: state.title, nodes: state.nodes, edges: state.edges, protocol: 1 }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (state.title || "weave").replace(/\s+/g, "-") + ".json";
    a.click();
  }

  async function bootPulse() {
    try {
      const h = await fetch("/api/health").then((r) => r.json());
      $("pulse").textContent = h.ok ? "live · p" + h.protocol : "down";
      $("pulse").style.color = h.ok ? "var(--cyan)" : "var(--bad)";
    } catch {
      $("pulse").textContent = "local";
    }
  }

  function bind() {
    $("run").addEventListener("click", runWeave);
    $("spot-btn").addEventListener("click", () => {
      if ($("spot").classList.contains("hidden")) openSpot();
      else closeSpot();
    });
    $("spot-q").addEventListener("input", (e) => renderSpot(e.target.value));
    $("title").addEventListener("input", (e) => { state.title = e.target.value; saveGraph(); });
    $("settings-btn").addEventListener("click", () => $("modal").classList.remove("hidden"));
    $("modal").addEventListener("click", (e) => { if (e.target.id === "modal") $("modal").classList.add("hidden"); });
    $("key").value = key();
    if ($("key-save")) $("key-save").addEventListener("click", () => {
      localStorage.setItem(KEY, $("key").value.trim());
      $("modal").classList.add("hidden");
      log("key stored in this browser only");
    });
    $("key-clear").addEventListener("click", () => {
      localStorage.removeItem(KEY);
      sessionStorage.removeItem(KEY);
      localStorage.removeItem("epic-sota-chamber-byok");
      $("key").value = "";
      if ($("byok-openai")) $("byok-openai").value = "";
      if ($("byok-anthropic")) $("byok-anthropic").value = "";
      if ($("byok-google")) $("byok-google").value = "";
      if ($("byok-msg")) $("byok-msg").textContent = "Keys cleared from this browser.";
      log("key cleared");
    });
    $("brand").addEventListener("click", () => addNode("pulse"));
    window.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openSpot();
      }
      if (e.key === "Escape") closeSpot();
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") runWeave();
    });
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }

  async function start() {
    renderRail();
    bind();
    if (new URLSearchParams(location.search).has("fresh")) localStorage.removeItem(GRAPH);
    if (!loadGraph()) seed();
    $("title").value = state.title;
    try {
      const all = await SOTA.idb("library", "readonly", (s) => SOTA.wrapReq(s.getAll()));
      if (Array.isArray(all)) state.library = all.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    } catch {
      /* first run */
    }
    renderLibs();
    draw();
    if (state.nodes[0]) {
      state.selected = state.nodes[0].id;
      inspect(state.nodes[0]);
    }
    await bootPulse();
    setTimeout(() => {
      $("boot").classList.add("hidden");
      $("app").classList.remove("hidden");
      draw();
      renderLibs();
    }, 700);
  }

  start();
})();
