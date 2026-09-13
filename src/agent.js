import { DurableObject } from "cloudflare:workers";
import {
  json,
  MODEL_LLM,
  MODEL_IMAGE,
  askOf,
  contextBlock,
  mediaKind,
  fallbackStill,
  chunks,
  llm,
  still,
  speak,
  publicHttps,
  vendorFetch,
} from "./lib.js";

export class ChamberAgent extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
  }

  async ping() {
    return { ok: true, agent: "ChamberAgent", llm: MODEL_LLM, image: MODEL_IMAGE };
  }

  async compute(cap, input = {}, keys = {}) {
    const started = Date.now();
    let out;
    try {
      out = await this.run(cap, input, keys);
    } catch (err) {
      out = {
        engine: "fallback",
        text: "ChamberAgent recovered: " + String(err && err.message ? err.message : err),
        markdown: String(err && err.message ? err.message : err),
        dataUrl: fallbackStill(askOf(input)),
        soft: true,
      };
    }
    out.ok = true;
    out.cap = cap;
    out.agent = "ChamberAgent";
    out.ms = Date.now() - started;
    const log = (await this.ctx.storage.get("jobs")) || [];
    log.unshift({ cap, ok: out.ok, ts: Date.now(), ms: out.ms });
    await this.ctx.storage.put("jobs", log.slice(0, 24));
    await this.ctx.storage.put("last", { cap, ok: out.ok, ts: Date.now() });
    return out;
  }

  async run(cap, input, keys) {
    const ask = askOf(input);
    const wired = contextBlock(input);
    const kind = mediaKind(cap, ask);
    const offset = Math.max(0, Number(input.offset) || 0);

    if (kind === "imagine" || cap === "imagine") {
      const shot = await still(this.env, ask + (wired ? " " + wired.slice(0, 400) : ""), keys);
      return { ...shot, frames: [shot.dataUrl].filter(Boolean), text: ask };
    }

    if (kind === "video" || cap === "video") {
      if (keys.xai) {
        try {
          const res = await vendorFetch("https://api.x.ai/v1/videos/generations", {
            method: "POST",
            headers: { authorization: "Bearer " + keys.xai, "content-type": "application/json" },
            body: JSON.stringify({ model: "grok-imagine-video", prompt: ask.slice(0, 2000), duration: 6 }),
          });
          const body = await res.json().catch(() => ({}));
          const url = body.data?.[0]?.url || body.video?.url || body.url;
          if (res.ok && url) return { engine: "xai", kind: "video", videoUrl: url, text: ask, mime: "video/mp4" };
        } catch {
          /* keyframes next */
        }
      }
      const shots = await llm(
        this.env,
        "Write 6 cinematic 6-second shots for this brief. Number them. Present tense. One camera move each.\n\n" + ask + wired,
        keys,
      );
      const lines = String(shots.text || "")
        .split(/\n/)
        .filter((l) => /^\s*\d/.test(l))
        .slice(0, 4);
      const prompts = lines.length ? lines : ["cinematic keyframe, " + ask.slice(0, 200)];
      const frames = [];
      for (const line of prompts) {
        const s = await still(this.env, line.replace(/^\s*\d+[.)]\s*/, "").slice(0, 400), keys);
        if (s.dataUrl) frames.push(s.dataUrl);
      }
      return {
        engine: shots.model ? "workers-ai" : "fallback",
        kind: "video",
        encode: true,
        text: shots.text,
        markdown: shots.text,
        shots: shots.text,
        frames,
        dataUrl: frames[0] || fallbackStill(ask),
        model: shots.model,
      };
    }

    if (kind === "voice" || cap === "voice") {
      const full = ask || "Epic SOTA Chamber. Cloudflare agent live.";
      const bits = chunks(full, 400);
      const piece = bits[Math.min(offset, bits.length - 1)] || full.slice(0, 400);
      const tts = await speak(this.env, piece, keys);
      return {
        ...tts,
        text: full,
        chunk: piece,
        continue: offset + 1 < bits.length,
        offset: offset + 1,
        chunks: bits.length,
        note: bits.length > 1 ? "Long ask split into voice chunks. Re-run Eve with next offset." : "",
      };
    }

    if (cap === "research") {
      const url = publicHttps(input.url || input.prompt);
      if (!url) {
        const got2 = await llm(
          this.env,
          "No URL was given. Research this ask from what you know and say what to fetch next.\n\n" + ask + wired,
          keys,
        );
        return { engine: "workers-ai", url: "", text: got2.text, markdown: got2.text, model: got2.model, soft: true };
      }
      const res = await vendorFetch(url, { redirect: "follow", headers: { accept: "text/html,text/plain,application/json" } });
      const raw = await res.text();
      const text = raw
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 8000);
      const brief = await llm(this.env, "Brief this page for the captain. Facts only, then what to do next.\nURL: " + url + "\n\n" + text, keys);
      return { engine: "workers-ai", status: res.status, url, text, markdown: brief.text, model: brief.model || MODEL_LLM };
    }

    if (cap === "design") {
      const got2 = await llm(
        this.env,
        "Write a buildable spec. Markdown. Include name, surfaces, non-goals (do not wrap sibling Epic products), protocol 1, cyan #00f3ff magenta #ff00aa black #0a0a0a.\n\nBrief:\n" +
          ask +
          wired,
        keys,
      );
      return { engine: "workers-ai", markdown: got2.text, spec: { name: ask.slice(0, 48) || "Chamber spec", protocol: 1 }, model: got2.model || MODEL_LLM };
    }

    if (cap === "review") {
      const got2 = await llm(this.env, "Review this. Findings first, then what to ship. Short.\n\n" + ask + wired, keys);
      return { engine: "workers-ai", markdown: got2.text, text: got2.text, model: got2.model || MODEL_LLM };
    }

    if (cap === "code") {
      const got2 = await llm(
        this.env,
        "Compute this. If it is code, return the result and the code. If it is a question, answer it with working code when that helps.\n\n" +
          ask +
          wired,
        keys,
      );
      return { engine: "workers-ai", text: got2.text, value: got2.text, model: got2.model || MODEL_LLM };
    }

    if (cap === "music") {
      const got2 = await llm(
        this.env,
        'Return ONLY JSON for a playable track: {"bpm":90,"rootHz":110,"mood":"dark","pattern":"x.x.x..x","scale":[0,3,5,7,10]}. Ask:\n' +
          ask +
          wired,
        keys,
      );
      let recipe = { bpm: 96, rootHz: 110, mood: "void", pattern: "x.x.x..x", scale: [0, 3, 5, 7, 10] };
      const m = String(got2.text || "").match(/\{[\s\S]*\}/);
      if (m) {
        try {
          recipe = { ...recipe, ...JSON.parse(m[0]) };
        } catch {
          /* keep default recipe */
        }
      }
      return { engine: "workers-ai", recipe, text: got2.text, markdown: got2.text, model: got2.model };
    }

    if (cap === "media") {
      const shot = await still(this.env, ask, keys);
      const extra = [];
      try {
        const a = await still(this.env, "cinematic pull-back, " + ask.slice(0, 280), keys);
        if (a.dataUrl) extra.push(a.dataUrl);
      } catch {
        /* one frame is enough */
      }
      try {
        const b = await still(this.env, "macro detail, " + ask.slice(0, 280), keys);
        if (b.dataUrl) extra.push(b.dataUrl);
      } catch {
        /* skip */
      }
      const copy = await llm(this.env, "Write on-screen copy and a 2-line caption for this media ask:\n" + ask + wired, keys);
      let voice = { dataUrl: "" };
      try {
        voice = await speak(this.env, String(copy.text || ask).slice(0, 400), keys);
      } catch {
        /* pack still ships without voice */
      }
      const frames = [shot.dataUrl, ...extra].filter(Boolean);
      return {
        ...shot,
        kind: "pack",
        frames,
        text: copy.text,
        markdown: copy.text,
        audioUrl: voice.dataUrl || "",
        dataUrl: frames[0] || fallbackStill(ask),
      };
    }

    if (cap === "agent" || cap === "weave") {
      const k = mediaKind("agent", ask);
      if (k === "imagine" || k === "video" || k === "voice") return this.run(k, input, keys);
      const got2 = await llm(this.env, "The captain asked:\n" + ask + wired + "\n\nProduce the result now.", keys);
      return { engine: "workers-ai", text: got2.text, markdown: got2.text, model: got2.model };
    }

    const got = await llm(this.env, "Cap `" + cap + "` asked:\n" + ask + wired, keys);
    return { engine: "workers-ai", text: got.text, markdown: got.text, cap, model: got.model || MODEL_LLM };
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/ping") || request.method === "GET") {
      return json({ ...(await this.ping()), jobs: ((await this.ctx.storage.get("jobs")) || []).slice(0, 8) });
    }
    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const keys = body.keys && typeof body.keys === "object" ? body.keys : { xai: String(body.key || "") };
    const out = await this.compute(String(body.cap || "agent"), body.input || {}, keys);
    return json(out, out.ok ? 200 : 422);
  }
}
