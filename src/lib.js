export const PRODUCT = {
  ok: true,
  product: "epic-sota-chamber",
  name: "Epic SOTA Chamber",
  brand: "💯Epic Tech AI🔥™️",
  version: "1.6.0",
  protocol: 1,
  os: false,
  sibling: false,
};

export const MODEL_LLM = "@cf/zai-org/glm-4.7-flash";
export const MODEL_IMAGE = "@cf/black-forest-labs/flux-1-schnell";
export const MODEL_TTS = "@cf/myshell-ai/melotts";
export const LLM_FALLBACK = ["@cf/meta/llama-3.1-8b-instruct-fast", "@cf/meta/llama-3.2-3b-instruct"];
export const IMAGE_FALLBACK = ["@cf/bytedance/stable-diffusion-xl-lightning", "@cf/lykon/dreamshaper-8-lcm"];
export const TTS_FALLBACK = ["@cf/deepgram/aura-1"];

export const SYSTEM = [
  "You are ChamberAgent, a Cloudflare Workers AI agent inside Epic SOTA Chamber for 💯Epic Tech AI🔥™️.",
  "Compute the ask. Return the full deliverable in the response. Direct. No lecture. No filler.",
  "Do not wrap Harness, Super App, Crew, AIgent, Bot OS, or Railway Epic OS.",
  "Fulfill ordinary creative and technical work. If a fact is unknown, say so and still produce the usable artifact.",
].join(" ");

export const CAPS = [
  { id: "imagine", version: "1.3.0", kind: "agent", title: "Imagine", desc: "Any still — BYOK vendors then Flux, then fallbacks, never empty" },
  { id: "video", version: "1.3.0", kind: "agent", title: "Drift", desc: "Any motion ask — shot pack + keyframes, chunked" },
  { id: "voice", version: "1.3.0", kind: "agent", title: "Eve", desc: "Any speech ask — TTS with chunk continue" },
  { id: "media", version: "1.3.0", kind: "agent", title: "Pack", desc: "Still + motion frames + voice from one ask" },
  { id: "music", version: "1.3.0", kind: "agent", title: "Music", desc: "Track recipe for the in-tab sequencer" },
  { id: "research", version: "1.2.0", kind: "agent", title: "Probe", desc: "Fetch public https + CF LLM brief" },
  { id: "code", version: "1.2.0", kind: "agent", title: "Codex", desc: "CF LLM writes/runs the answer" },
  { id: "review", version: "1.2.0", kind: "agent", title: "Review", desc: "CF LLM review of the wired input" },
  { id: "design", version: "1.2.0", kind: "agent", title: "Spec", desc: "CF LLM design spec from the brief" },
  { id: "agent", version: "1.2.0", kind: "agent", title: "Agent", desc: "Ask anything — ChamberAgent computes it" },
  { id: "memory", version: "1.0.0", kind: "local", title: "Lattice", desc: "Local knowledge" },
  { id: "score", version: "1.0.0", kind: "local", title: "Score", desc: "WebAudio score" },
  { id: "glyph", version: "1.0.0", kind: "local", title: "Glyph", desc: "Local generative mark" },
  { id: "folio", version: "1.0.0", kind: "local", title: "Folio", desc: "Export md/html/json" },
  { id: "game", version: "1.0.0", kind: "local", title: "Sprite", desc: "Sheet spec + local glyph frames" },
  { id: "weave", version: "1.0.0", kind: "local", title: "Weave", desc: "Run the graph" },
  { id: "pulse", version: "1.1.0", kind: "local", title: "Pulse", desc: "Chamber health" },
  { id: "stitch", version: "1.3.0", kind: "local", title: "Stitch", desc: "Any media in → one final out" },
];

export const COST = {
  imagine: 1,
  video: 3,
  voice: 1,
  music: 1,
  stitch: 2,
  media: 5,
  game: 1,
  agent: 1,
  design: 1,
  review: 1,
  code: 1,
  research: 1,
};

export const CORS_HEADERS =
  "content-type, x-epic-key, authorization, x-byok-openai, x-byok-anthropic, x-byok-google";

export const ORIGIN = "https://chamber.epictechai.app";

export function json(data, status = 200, extra = {}) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-epic-chamber": "sota",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-frame-options": "DENY",
    "access-control-allow-origin": extra.origin || ORIGIN,
    "access-control-allow-headers": CORS_HEADERS,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET,POST,PUT,OPTIONS",
    ...extra.headers,
  };
  return new Response(JSON.stringify(data), { status, headers });
}

export function bad(msg, status = 400) {
  return json({ ok: false, error: msg }, status);
}

export function corsPreflight() {
  return new Response(null, {
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": CORS_HEADERS,
      "access-control-allow-methods": "GET,POST,PUT,OPTIONS",
      "access-control-max-age": "86400",
    },
  });
}

export function publicHttps(raw) {
  let u;
  try {
    u = new URL(String(raw || ""));
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  if (u.username || u.password) return null;
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host === "127.0.0.1" || host === "::1") return null;
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|169\.254\.)/.test(host)) return null;
  return u.toString();
}

export function llmText(data) {
  if (data == null) return "";
  if (typeof data === "string") return data;
  if (typeof data.response === "string") return data.response;
  if (typeof data.result === "string") return data.result;
  if (typeof data.text === "string") return data.text;
  const c = data.choices?.[0]?.message?.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map((p) => p.text || p.content || "").join("");
  const parts = data.content;
  if (Array.isArray(parts)) return parts.map((p) => p.text || p.content || "").join("");
  if (typeof data.candidates?.[0]?.content?.parts?.[0]?.text === "string") {
    return data.candidates[0].content.parts.map((p) => p.text || "").join("");
  }
  return "";
}

export function askOf(input) {
  return String(input?.prompt || input?.text || input?.code || input?.url || input?.brief || input?.markdown || "").slice(
    0,
    8000,
  );
}

export function contextBlock(input) {
  if (!input || !input.from) return "";
  try {
    return "\n\nWired input from previous node:\n" + JSON.stringify(input.from).slice(0, 6000);
  } catch {
    return "";
  }
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function chunks(s, size) {
  const t = String(s || "");
  if (t.length <= size) return t ? [t] : [""];
  const out = [];
  for (let i = 0; i < t.length && out.length < 4; i += size) out.push(t.slice(i, i + size));
  return out;
}

export function fallbackStill(prompt) {
  const p = String(prompt || "chamber").replace(/[<>&"]/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect fill="#0a0a0a" width="1024" height="1024"/><circle cx="512" cy="512" r="220" fill="none" stroke="#00f3ff" stroke-width="8"/><circle cx="512" cy="512" r="140" fill="none" stroke="#ff00aa" stroke-width="4"/><text x="512" y="980" text-anchor="middle" fill="#00f3ff" font-size="22">FALLBACK MARK · ${p.slice(0, 48)}</text></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

export function toDataUrl(img) {
  if (!img) return "";
  if (typeof img === "string") {
    if (img.startsWith("data:")) return img;
    if (img.startsWith("http")) return img;
    return `data:image/jpeg;base64,${img}`;
  }
  const b64 = img.image || img.result || "";
  if (!b64) return "";
  return String(b64).startsWith("data:") ? b64 : `data:image/jpeg;base64,${b64}`;
}

export function mediaKind(cap, ask) {
  const t = String(ask || "").toLowerCase();
  if (cap === "imagine" || cap === "video" || cap === "voice" || cap === "music") return cap;
  if (/\b(video|film|clip|cinematic|animate|motion|trailer)\b/.test(t)) return "video";
  if (/\b(speak|voice|narrat|tts|podcast|read this|say )\b/.test(t)) return "voice";
  if (/\b(music|track|beat|song|score|instrumental|bpm)\b/.test(t)) return "music";
  if (/\b(image|still|picture|poster|cover|art|photo|render)\b/.test(t)) return "imagine";
  if (cap === "media" || cap === "agent") {
    if (/\b(make|generate|create|draw|shoot)\b/.test(t)) return "imagine";
  }
  return cap;
}

export function bytesToB64(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}

export function headerToken(request, name) {
  const h = request.headers.get(name) || "";
  return h.replace(/^Bearer\s+/i, "").trim();
}

export function byokFrom(request) {
  return {
    xai: headerToken(request, "x-epic-key") || headerToken(request, "authorization"),
    openai: headerToken(request, "x-byok-openai"),
    anthropic: headerToken(request, "x-byok-anthropic"),
    google: headerToken(request, "x-byok-google"),
  };
}

export function hasByok(request) {
  return Object.values(byokFrom(request)).some((v) => v.length >= 12);
}

export function cookieSid(request) {
  const raw = request.headers.get("cookie") || "";
  const m = raw.match(/(?:^|;\s*)chamber_sid=([a-f0-9]+)/);
  return m ? m[1] : "";
}

export function sidCookie(token, clear) {
  if (clear) return "chamber_sid=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax";
  return "chamber_sid=" + token + "; Path=/; Max-Age=2592000; Secure; HttpOnly; SameSite=Lax";
}

export async function sha(s) {
  const b = new TextEncoder().encode(s);
  const d = await crypto.subtle.digest("SHA-256", b);
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export function otp() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(100000 + (a[0] % 900000));
}

export function token() {
  const a = new Uint8Array(24);
  crypto.getRandomValues(a);
  return [...a].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export function normEmail(raw) {
  const e = String(raw || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || e.length > 120) return "";
  return e;
}

export function maskEmail(em) {
  return em.replace(/^(.).*(@.*)$/, "$1***$2");
}

export function parseJsonBody(text) {
  try {
    return JSON.parse(text || "{}");
  } catch {
    return {};
  }
}

export function assetAlias(pathname) {
  if (pathname === "/" || pathname === "/index.html") return "/index.html";
  if (pathname === "/favicon.ico" || pathname === "/favicon.png") return "/icon.jpg";
  if (pathname === "/apple-touch-icon.png") return "/icon.jpg";
  if (pathname === "/legal/terms") return "/legal/terms.html";
  if (pathname === "/legal/privacy") return "/legal/privacy.html";
  if (pathname === "/legal/aup") return "/legal/aup.html";
  if (pathname === "/legal/license") return "/legal/license.html";
  if (pathname === "/legal/whitepaper") return "/legal/whitepaper.html";
  if (pathname === "/legal/security") return "/legal/security.html";
  return null;
}

export async function llm(env, user, keys = {}) {
  const parts = chunks(user, 6000);
  const texts = [];
  let model = MODEL_LLM;

  async function vendorText(part) {
    if (keys.xai) {
      try {
        const res = await fetch("https://api.x.ai/v1/chat/completions", {
          method: "POST",
          headers: { authorization: "Bearer " + keys.xai, "content-type": "application/json" },
          body: JSON.stringify({
            model: "grok-3-mini",
            messages: [
              { role: "system", content: SYSTEM },
              { role: "user", content: part },
            ],
            max_tokens: 2048,
            temperature: 0.7,
          }),
        });
        const data = await res.json().catch(() => ({}));
        const got = llmText(data);
        if (res.ok && got) return { text: got, model: "grok-3-mini", engine: "xai" };
      } catch {
        /* next vendor */
      }
    }
    if (keys.openai) {
      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { authorization: "Bearer " + keys.openai, "content-type": "application/json" },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: SYSTEM },
              { role: "user", content: part },
            ],
            max_tokens: 2048,
            temperature: 0.7,
          }),
        });
        const data = await res.json().catch(() => ({}));
        const got = llmText(data);
        if (res.ok && got) return { text: got, model: "gpt-4o-mini", engine: "openai" };
      } catch {
        /* next vendor */
      }
    }
    if (keys.anthropic) {
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": keys.anthropic,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 2048,
            system: SYSTEM,
            messages: [{ role: "user", content: part }],
          }),
        });
        const data = await res.json().catch(() => ({}));
        const got = llmText(data);
        if (res.ok && got) return { text: got, model: "claude-sonnet-4-20250514", engine: "anthropic" };
      } catch {
        /* next vendor */
      }
    }
    if (keys.google) {
      try {
        const res = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" +
            encodeURIComponent(keys.google),
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: SYSTEM }] },
              contents: [{ role: "user", parts: [{ text: part }] }],
              generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
            }),
          },
        );
        const data = await res.json().catch(() => ({}));
        const got = llmText(data);
        if (res.ok && got) return { text: got, model: "gemini-2.0-flash", engine: "google" };
      } catch {
        /* workers ai next */
      }
    }
    return null;
  }

  for (const part of parts) {
    const vendored = await vendorText(part);
    if (vendored) {
      texts.push(vendored.text);
      model = vendored.model;
      continue;
    }
    const models = [MODEL_LLM, ...LLM_FALLBACK];
    let got = "";
    if (env && env.AI && typeof env.AI.run === "function") {
      for (const m of models) {
        for (let i = 0; i < 2 && !got; i++) {
          try {
            const data = await env.AI.run(m, {
              messages: [
                { role: "system", content: SYSTEM },
                { role: "user", content: part },
              ],
              max_tokens: 2048,
              temperature: 0.7,
            });
            got = llmText(data) || String(data?.response || "").trim();
            if (got) model = m;
          } catch {
            await sleep(200 * (i + 1));
          }
        }
        if (got) break;
      }
    }
    texts.push(got || "(chunk empty — continuing)");
  }
  const text = texts.join("\n\n").trim();
  if (!text || text === "(chunk empty — continuing)") {
    return { text: "ChamberAgent produced a stub. Re-run the node.", model: "none", soft: true };
  }
  return { text, model };
}

export async function still(env, prompt, keys = {}) {
  const p = (prompt || "void black chamber, cyan hex, magenta spark, no text").slice(0, 2048);
  if (keys.xai) {
    try {
      const res = await fetch("https://api.x.ai/v1/images/generations", {
        method: "POST",
        headers: { authorization: "Bearer " + keys.xai, "content-type": "application/json" },
        body: JSON.stringify({ model: "grok-imagine-image", prompt: p, n: 1 }),
      });
      const body = await res.json().catch(() => ({}));
      const url = body.data?.[0]?.url || body.data?.[0]?.b64_json;
      if (res.ok && url) {
        const dataUrl = String(url).startsWith("http") ? url : toDataUrl(url);
        if (dataUrl) return { engine: "xai", dataUrl, model: "grok-imagine-image", prompt: p };
      }
    } catch {
      /* next */
    }
  }
  if (keys.openai) {
    for (const model of ["gpt-image-1", "dall-e-3"]) {
      try {
        const res = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: { authorization: "Bearer " + keys.openai, "content-type": "application/json" },
          body: JSON.stringify({ model, prompt: p, n: 1, size: "1024x1024" }),
        });
        const body = await res.json().catch(() => ({}));
        const url = body.data?.[0]?.url;
        const b64 = body.data?.[0]?.b64_json;
        if (res.ok && (url || b64)) {
          return { engine: "openai", dataUrl: url || toDataUrl(b64), model, prompt: p };
        }
      } catch {
        /* next model */
      }
    }
  }
  if (keys.google) {
    try {
      const res = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=" +
          encodeURIComponent(keys.google),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "Generate an image: " + p }] }],
            generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
          }),
        },
      );
      const body = await res.json().catch(() => ({}));
      const inline = body.candidates?.[0]?.content?.parts?.find((x) => x.inlineData)?.inlineData;
      if (res.ok && inline?.data) {
        const mime = inline.mimeType || "image/png";
        return { engine: "google", dataUrl: `data:${mime};base64,${inline.data}`, model: "gemini-image", prompt: p };
      }
    } catch {
      /* workers ai next */
    }
  }
  const models = [MODEL_IMAGE, ...IMAGE_FALLBACK];
  if (env && env.AI && typeof env.AI.run === "function") {
    for (const m of models) {
      for (let i = 0; i < 2; i++) {
        try {
          const img = await env.AI.run(m, { prompt: p, steps: 4 });
          const dataUrl = toDataUrl(img);
          if (dataUrl) return { engine: "workers-ai", model: m, dataUrl, prompt: p };
        } catch {
          await sleep(250 * (i + 1));
        }
      }
    }
  }
  return { engine: "fallback", model: "svg", dataUrl: fallbackStill(p), prompt: p, soft: true };
}

export async function speak(env, text, keys = {}) {
  const spoken = String(text || "Epic SOTA Chamber. Cyan cut. Magenta sting.").slice(0, 500);
  if (keys.xai) {
    try {
      const res = await fetch("https://api.x.ai/v1/tts", {
        method: "POST",
        headers: { authorization: "Bearer " + keys.xai, "content-type": "application/json" },
        body: JSON.stringify({ model: "grok-voice", voice: "eve", input: spoken }),
      });
      const buf = await res.arrayBuffer();
      if (res.ok && buf.byteLength > 200) {
        return { engine: "xai", model: "grok-voice", text: spoken, dataUrl: "data:audio/mpeg;base64," + bytesToB64(buf) };
      }
    } catch {
      /* next */
    }
  }
  if (keys.openai) {
    try {
      const res = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { authorization: "Bearer " + keys.openai, "content-type": "application/json" },
        body: JSON.stringify({ model: "tts-1", voice: "nova", input: spoken }),
      });
      const buf = await res.arrayBuffer();
      if (res.ok && buf.byteLength > 200) {
        return { engine: "openai", model: "tts-1", text: spoken, dataUrl: "data:audio/mpeg;base64," + bytesToB64(buf) };
      }
    } catch {
      /* workers ai next */
    }
  }
  const models = ["@cf/deepgram/aura-1", MODEL_TTS, ...TTS_FALLBACK];
  if (env && env.AI && typeof env.AI.run === "function") {
    for (const m of models) {
      try {
        const tts = await env.AI.run(m, { prompt: spoken, lang: "en", text: spoken });
        let dataUrl = "";
        if (tts instanceof ArrayBuffer) dataUrl = "data:audio/mpeg;base64," + bytesToB64(tts);
        else if (tts?.audio) dataUrl = "data:audio/wav;base64," + tts.audio;
        else if (typeof tts === "string" && tts.length > 20) dataUrl = tts.startsWith("data:") ? tts : "data:audio/wav;base64," + tts;
        if (dataUrl) return { engine: "workers-ai", model: m, text: spoken, dataUrl };
      } catch {
        /* next model */
      }
    }
  }
  return { engine: "fallback", text: spoken, dataUrl: "", note: "TTS busy — script is in text. Re-run Eve.", soft: true };
}

export async function stripeCheckout(env, origin, email) {
  if (!env.STRIPE_SECRET_KEY) {
    return { ok: false, configured: false, error: "Stripe is not configured. Set STRIPE_SECRET_KEY as a Worker secret." };
  }
  const body = new URLSearchParams({
    mode: "payment",
    success_url: origin + "/?paid=1&session_id={CHECKOUT_SESSION_ID}",
    cancel_url: origin + "/?paid=0",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": "99",
    "line_items[0][price_data][product_data][name]": "Epic SOTA Chamber · 10 media credits",
    "line_items[0][price_data][product_data][description]":
      "💯Epic Tech AI🔥™️ pay-as-you-go if you are not using BYOK. Still 1 · Voice/Music 1 · Motion 3 · Stitch 2 · Pack 5.",
  });
  if (email) {
    body.set("client_reference_id", email);
    body.set("customer_email", email);
  }
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: "Bearer " + env.STRIPE_SECRET_KEY,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, configured: true, error: data.error?.message || "Stripe checkout failed" };
  return { ok: true, url: data.url, id: data.id };
}

export async function userDoSafe(env, request, gate) {
  const who = await (await gate.fetch(new Request("https://gate/me?sid=" + encodeURIComponent(cookieSid(request))))).json();
  if (!who.signedIn || !who.email) return null;
  return { who, stub: env.USERS.get(env.USERS.idFromName(who.email.toLowerCase())) };
}

export async function billCap(request, env, cap, u) {
  const cost = COST[cap] || 0;
  if (!cost) return { ok: true, billed: "free", cost: 0 };
  if (hasByok(request)) return { ok: true, billed: "byok", cost: 0 };
  if (!u) {
    return {
      ok: false,
      status: 402,
      need: "byok_or_pay",
      cost,
      error: "BYOK or sign in and buy credits. Still 1 · Voice/Music 1 · Motion 3 · Stitch 2 · Pack 5. $0.99 = 10 credits.",
    };
  }
  const sum = await (await u.stub.fetch(new Request("https://user/summary"))).json();
  const credits = Number(sum.credits || 0);
  if (credits < cost) {
    return {
      ok: false,
      status: 402,
      need: "credits",
      cost,
      credits,
      error: "Need " + cost + " credits (you have " + credits + "). Buy $0.99 for 10 or paste BYOK.",
    };
  }
  const after = await (
    await u.stub.fetch(
      new Request("https://user/credits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ n: -cost }),
      }),
    )
  ).json();
  return { ok: true, billed: "credits", cost, credits: after.credits };
}
