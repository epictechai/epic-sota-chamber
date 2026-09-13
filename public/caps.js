/* Local engines. Edge caps (imagine/video/voice/research) go through /api/v1/run. */
(function () {
  const K = window.SOTA;
  const DB = "epic-sota-chamber";
  const MEM = "lattice";

  function idb(store, mode, fn) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 2);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(MEM)) db.createObjectStore(MEM, { keyPath: "id" });
        if (!db.objectStoreNames.contains("graphs")) db.createObjectStore("graphs", { keyPath: "id" });
        if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings", { keyPath: "id" });
        if (!db.objectStoreNames.contains("library")) db.createObjectStore("library", { keyPath: "id" });
      };
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(store, mode);
        let value;
        tx.oncomplete = () => {
          db.close();
          resolve(value);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
        Promise.resolve(fn(tx.objectStore(store))).then((v) => {
          value = v;
        }, reject);
      };
    });
  }

  function wrapReq(r) {
    return new Promise((res, rej) => {
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }

  function tokens(s) {
    return String(s || "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2);
  }

  function paywall(out) {
    if (!out || (out.ok !== false && !out.need)) return false;
    const modal = document.getElementById("modal");
    if (modal) modal.classList.remove("hidden");
    const msg = document.getElementById("pay-msg") || document.getElementById("auth-msg");
    if (msg) msg.textContent = out.error || "BYOK or pay";
    return true;
  }

  K.register({
    id: "memory",
    title: "Lattice",
    desc: "Local knowledge. Survives reload.",
    kind: "local",
    async run(input) {
      const action = input.action || (input.q ? "search" : "upsert");
      if (action === "upsert") {
        const rec = {
          id: input.id || "m-" + crypto.randomUUID(),
          text: String(input.text || input.prompt || ""),
          tags: input.tags || [],
          ts: Date.now(),
        };
        await idb(MEM, "readwrite", (s) => wrapReq(s.put(rec)));
        return rec;
      }
      if (action === "list") {
        const all = await idb(MEM, "readonly", (s) => wrapReq(s.getAll()));
        return { items: all.slice(-50).reverse() };
      }
      const q = tokens(input.q || input.prompt || "");
      const all = await idb(MEM, "readonly", (s) => wrapReq(s.getAll()));
      const scored = all
        .map((r) => {
          const t = new Set(tokens(r.text));
          const hit = q.filter((x) => t.has(x)).length;
          return { r, hit };
        })
        .filter((x) => x.hit)
        .sort((a, b) => b.hit - a.hit)
        .slice(0, 8)
        .map((x) => x.r);
      return { items: scored };
    },
  });

  K.register({
    id: "code",
    title: "Codex",
    desc: "CF LLM agent computes it. Local JS fallback.",
    kind: "agent",
    async run(input, ctx) {
      try {
        const out = await edge("code", input, ctx);
        if (paywall(out)) throw new Error(out.error || "BYOK or pay");
        if (out && out.ok !== false && (out.text || out.value || out.markdown)) return out.result || out;
      } catch (err) {
        if (String(err.message || err).includes("BYOK") || String(err.message || err).includes("credits")) throw err;
      }
      const src = String(input.code || input.prompt || "return 1+1");
      const fn = new Function("input", `"use strict";\n${src}`);
      const value = fn(input.input || {});
      return { value: value && typeof value.then === "function" ? await value : value, engine: "local" };
    },
  });

  K.register({
    id: "review",
    title: "Review",
    desc: "CF LLM agent review.",
    kind: "agent",
    async run(input, ctx) {
      const out = await edge("review", input, ctx);
      if (!out || out.ok === false) throw new Error(out && out.error ? out.error : "review failed");
      return out.result || out;
    },
  });

  K.register({
    id: "design",
    title: "Spec",
    desc: "CF LLM agent spec.",
    kind: "agent",
    async run(input, ctx) {
      const out = await edge("design", input, ctx);
      if (!out || out.ok === false) throw new Error(out && out.error ? out.error : "spec failed");
      return out.result || out;
    },
  });

  K.register({
    id: "agent",
    title: "Agent",
    desc: "Ask anything. ChamberAgent on Workers AI computes it.",
    kind: "agent",
    async run(input, ctx) {
      const out = await edge("agent", input, ctx);
      if (!out || out.ok === false) throw new Error(out && out.error ? out.error : "agent failed");
      return out.result || out;
    },
  });

  K.register({
    id: "folio",
    title: "Folio",
    desc: "Download md / html / json.",
    kind: "local",
    async run(input) {
      const title = input.title || "chamber-folio";
      const body = String(input.text || input.prompt || input.markdown || input.from?.markdown || "");
      const fmt = input.format || "md";
      let content = body;
      let type = "text/markdown";
      let name = title.replace(/\s+/g, "-") + ".md";
      if (fmt === "json") {
        content = JSON.stringify({ title, body, ts: Date.now() }, null, 2);
        type = "application/json";
        name = title.replace(/\s+/g, "-") + ".json";
      } else if (fmt === "html") {
        content = `<!doctype html><meta charset="utf-8"><title>${title}</title><body style="background:#0a0a0a;color:#f4f4f5;font:16px Montserrat,sans-serif;padding:32px"><h1 style="color:#00f3ff">${title}</h1><pre>${body.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]))}</pre></body>`;
        type = "text/html";
        name = title.replace(/\s+/g, "-") + ".html";
      }
      return { filename: name, type, content, bytes: content.length };
    },
  });

  K.register({
    id: "glyph",
    title: "Glyph",
    desc: "Local generative mark. Labeled LOCAL — not Imagine.",
    kind: "local",
    async run(input) {
      const seed = String(input.prompt || input.seed || "chamber");
      let h = 2166136261 >>> 0;
      for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
      const c = document.createElement("canvas");
      c.width = 512;
      c.height = 512;
      const g = c.getContext("2d");
      g.fillStyle = "#0a0a0a";
      g.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 18; i++) {
        h = Math.imul(h ^ (i + 1), 16777619) >>> 0;
        g.strokeStyle = i % 2 ? "#00f3ff" : "#ff00aa";
        g.globalAlpha = 0.35 + ((h >>> 8) % 50) / 100;
        g.lineWidth = 1 + (h % 4);
        g.beginPath();
        const r = 40 + (h % 180);
        const sweep = Math.PI * 2 * ((h % 80) / 80 + 0.2);
        g.arc(256, 256, r, 0, sweep);
        g.stroke();
      }
      g.globalAlpha = 1;
      g.fillStyle = "#00f3ff";
      g.font = "12px sans-serif";
      g.fillText("LOCAL GLYPH · not Imagine", 16, 496);
      return { dataUrl: c.toDataURL("image/png"), label: "local" };
    },
  });

  K.register({
    id: "game",
    title: "Sprite",
    desc: "Four-frame sheet spec + local glyphs.",
    kind: "local",
    async run(input) {
      const prompt = String(input.prompt || "neon sprite");
      const frames = [];
      for (let i = 0; i < 4; i++) {
        const g = await K.invoke("glyph", { prompt: prompt + " frame " + i });
        if (!g.ok || !g.result || !g.result.dataUrl) throw new Error(g.error || "glyph failed");
        frames.push(g.result.dataUrl);
      }
      return { frames, spec: { name: prompt, frames: 4, fps: 8, size: 512, engine: "local-glyph" } };
    },
  });

  K.register({
    id: "score",
    title: "Music",
    desc: "Club-track WAV.",
    kind: "local",
    async run(input) {
      const track = await window.ChamberMedia.renderClubTrack({
        bpm: input.bpm || 96,
        rootHz: input.rootHz || input.hz || 55,
        scale: input.scale,
      });
      return { kind: "audio", audioUrl: track.url, mime: track.mime, duration: track.duration, bpm: track.bpm, played: true };
    },
  });

  K.register({
    id: "music",
    title: "Music",
    desc: "Club-track WAV from a ChamberAgent recipe.",
    kind: "agent",
    async run(input, ctx) {
      let recipe = { bpm: 96, rootHz: 55, pattern: "x.x.x..x", scale: [0, 3, 5, 7, 10, 12] };
      const out = await edge("music", input, ctx);
      if (!out || out.ok === false) throw new Error((out && out.error) || "music failed");
      const payload = out.result || out;
      if (payload.recipe) recipe = { ...recipe, ...payload.recipe };
      const track = await window.ChamberMedia.renderClubTrack(recipe);
      return {
        kind: "audio",
        audioUrl: track.url,
        mime: "audio/wav",
        duration: track.duration,
        recipe,
        played: true,
        engine: "club-track",
        text: payload.text || "",
      };
    },
  });

  K.register({
    id: "stitch",
    title: "Stitch",
    desc: "Any library media into one final video (or audio if no picture).",
    kind: "local",
    async run(input) {
      await spend("stitch");
      const lib = Array.isArray(input.library) ? input.library : [];
      const frames = [];
      const audios = [];
      for (const it of lib) {
        if (it.frames && it.frames.length) frames.push(...it.frames.slice(0, 4));
        else if (it.dataUrl && String(it.dataUrl).startsWith("data:image")) frames.push(it.dataUrl);
        if (it.audio) audios.push(it.audio);
        else if (it.audioUrl) audios.push(it.audioUrl);
      }
      const out = await window.ChamberMedia.stitch({ frames, audios });
      return { ...out, text: "Stitched " + frames.length + " frames + " + audios.length + " stems." };
    },
  });

  K.register({
    id: "pulse",
    title: "Pulse",
    desc: "Chamber health.",
    kind: "local",
    async run() {
      const me = await fetch("/api/v1/health").then((r) => r.json());
      return { me, caps: K.catalog().length, protocol: K.PROTOCOL };
    },
  });

  K.register({
    id: "weave",
    title: "Weave",
    desc: "Reserved — the field runner uses the graph.",
    kind: "local",
    async run(input) {
      return { note: "use Run weave in the field", nodes: (input.nodes || []).length };
    },
  });

  function byokHeaders(ctx) {
    const headers = { "content-type": "application/json" };
    let p = {};
    try {
      p = JSON.parse(localStorage.getItem("epic-sota-chamber-byok") || "{}");
    } catch {
      p = {};
    }
    const xai = (ctx && ctx.key) || p.xai || localStorage.getItem("epic-sota-chamber-key") || "";
    if (xai) headers["x-epic-key"] = xai;
    if (p.openai) headers["x-byok-openai"] = p.openai;
    if (p.anthropic) headers["x-byok-anthropic"] = p.anthropic;
    if (p.google) headers["x-byok-google"] = p.google;
    return headers;
  }

  async function spend(cap) {
    const res = await fetch("/api/v1/billing/spend", {
      method: "POST",
      credentials: "include",
      headers: byokHeaders(),
      body: JSON.stringify({ cap }),
    });
    const j = await res.json().catch(() => ({ ok: false, error: "billing" }));
    if (!j.ok) {
      paywall(j);
      throw new Error(j.error || "BYOK or pay");
    }
    return j;
  }

  async function edge(id, input, ctx) {
    let res;
    try {
      res = await fetch("/api/v1/run", {
        method: "POST",
        credentials: "include",
        headers: byokHeaders(ctx),
        body: JSON.stringify({ cap: id, input }),
      });
    } catch (err) {
      return { ok: false, error: "Network: " + String(err && err.message ? err.message : err) };
    }
    const out = await res.json().catch(() => ({ ok: false, error: "bad response" }));
    if (res.status === 402 || out.need) paywall(out);
    return out;
  }

  for (const id of ["imagine", "research", "media"]) {
    const titles = { imagine: "Still", research: "Probe", media: "Pack" };
    K.register({
      id,
      title: titles[id],
      kind: "agent",
      desc: "ChamberAgent on Workers AI",
      async run(input, ctx) {
        const out = await edge(id, input, ctx);
        if (!out || out.ok === false) throw new Error((out && out.error) || "edge failed");
        return out.result || out;
      },
    });
  }

  K.register({
    id: "video",
    title: "Motion",
    kind: "agent",
    desc: "Real video with matching club-track audio muxed in.",
    async run(input, ctx) {
      const out = await edge("video", input, ctx);
      if (!out || out.ok === false) throw new Error((out && out.error) || "motion failed");
      const payload = out.result || out;
      if (payload.videoUrl) return { ...payload, kind: "video" };
      const frames = payload.frames || (payload.dataUrl ? [payload.dataUrl] : []);
      if (!frames.length) throw new Error("motion returned no frames");
      const vid = await window.ChamberMedia.framesToVideo(frames, 1800, { bpm: 96, rootHz: 55 });
      return {
        ...payload,
        kind: "video",
        videoUrl: vid.url,
        audioUrl: vid.audioUrl,
        mime: vid.mime,
        seconds: vid.seconds,
        frames,
      };
    },
  });

  K.register({
    id: "voice",
    title: "Voice",
    kind: "agent",
    desc: "Spoken audio file.",
    async run(input, ctx) {
      const pieces = [];
      let offset = 0;
      let last = {};
      for (let i = 0; i < 4; i++) {
        const out = await edge("voice", { ...input, offset }, ctx);
        if (!out || out.ok === false) {
          if (pieces.length) break;
          throw new Error((out && out.error) || "voice failed");
        }
        const payload = out.result || out;
        last = payload;
        const audio = payload.dataUrl && String(payload.dataUrl).startsWith("data:audio") ? payload.dataUrl : payload.audioUrl;
        if (audio) pieces.push(audio);
        if (!payload.continue) break;
        offset = payload.offset || offset + 1;
      }
      return {
        ...last,
        kind: "audio",
        audioUrl: pieces[0] || last.audioUrl || "",
        chunks: pieces,
        mime: last.mime || "audio/mpeg",
      };
    },
  });

  K.idb = idb;
  K.wrapReq = wrapReq;
})();
