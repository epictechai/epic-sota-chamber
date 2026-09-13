import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  publicHttps,
  mediaKind,
  llmText,
  askOf,
  chunks,
  fallbackStill,
  toDataUrl,
  hasByok,
  byokFrom,
  COST,
  CAPS,
  PRODUCT,
  assetAlias,
  normEmail,
  maskEmail,
  parseJsonBody,
  contextBlock,
} from "../src/lib.js";

describe("product", () => {
  it("is protocol 1 chamber, not a sibling OS", () => {
    assert.equal(PRODUCT.product, "epic-sota-chamber");
    assert.equal(PRODUCT.protocol, 1);
    assert.equal(PRODUCT.os, false);
    assert.equal(PRODUCT.sibling, false);
    assert.equal(CAPS.length, 18);
  });
});

describe("publicHttps", () => {
  it("accepts public https", () => {
    assert.equal(publicHttps("https://example.com/page"), "https://example.com/page");
  });
  it("rejects http, localhost, and private nets", () => {
    assert.equal(publicHttps("http://example.com"), null);
    assert.equal(publicHttps("https://localhost/x"), null);
    assert.equal(publicHttps("https://127.0.0.1/"), null);
    assert.equal(publicHttps("https://192.168.1.4/"), null);
    assert.equal(publicHttps("https://user:pass@example.com/"), null);
    assert.equal(publicHttps("not a url"), null);
  });
});

describe("mediaKind", () => {
  it("keeps explicit media caps", () => {
    assert.equal(mediaKind("imagine", "make a song"), "imagine");
    assert.equal(mediaKind("video", "draw a poster"), "video");
    assert.equal(mediaKind("voice", "cinematic trailer"), "voice");
  });
  it("routes agent/media prompts", () => {
    assert.equal(mediaKind("agent", "cinematic trailer of the chamber"), "video");
    assert.equal(mediaKind("agent", "speak this line"), "voice");
    assert.equal(mediaKind("agent", "instrumental bpm 90"), "music");
    assert.equal(mediaKind("agent", "poster still of the relic"), "imagine");
  });
});

describe("llmText", () => {
  it("reads workers-ai, openai, anthropic, gemini shapes", () => {
    assert.equal(llmText({ response: "hi" }), "hi");
    assert.equal(llmText({ choices: [{ message: { content: "yo" } }] }), "yo");
    assert.equal(llmText({ content: [{ text: "a" }, { text: "b" }] }), "ab");
    assert.equal(llmText({ candidates: [{ content: { parts: [{ text: "g" }] } }] }), "g");
    assert.equal(llmText(null), "");
  });
});

describe("ask and chunks", () => {
  it("reads prompt fields", () => {
    assert.equal(askOf({ prompt: "hello" }), "hello");
    assert.equal(askOf({ url: "https://x.test" }), "https://x.test");
  });
  it("splits long text into at most 4 chunks", () => {
    assert.deepEqual(chunks("ab", 1), ["a", "b"]);
    assert.equal(chunks("x".repeat(100), 10).length, 4);
    assert.deepEqual(chunks("", 10), [""]);
  });
  it("serializes wired input", () => {
    assert.equal(contextBlock({}), "");
    assert.match(contextBlock({ from: { text: "wired" } }), /wired/);
  });
});

describe("stills", () => {
  it("never returns an empty fallback mark", () => {
    const url = fallbackStill("void");
    assert.match(url, /^data:image\/svg\+xml/);
    assert.match(decodeURIComponent(url), /FALLBACK MARK/);
  });
  it("normalizes image payloads", () => {
    assert.equal(toDataUrl("data:image/png;base64,xx"), "data:image/png;base64,xx");
    assert.equal(toDataUrl("https://cdn.example/a.jpg"), "https://cdn.example/a.jpg");
    assert.equal(toDataUrl({ image: "abc" }), "data:image/jpeg;base64,abc");
    assert.equal(toDataUrl(null), "");
  });
});

describe("billing and byok", () => {
  it("prices the make lanes", () => {
    assert.equal(COST.imagine, 1);
    assert.equal(COST.voice, 1);
    assert.equal(COST.music, 1);
    assert.equal(COST.video, 3);
    assert.equal(COST.stitch, 2);
    assert.equal(COST.media, 5);
  });
  it("treats a 12+ char vendor header as BYOK", () => {
    const req = new Request("https://chamber.epictechai.app/api/v1/run", {
      headers: { "x-byok-openai": "sk-abcdefghijklmnopqrstuvwxyz" },
    });
    assert.equal(hasByok(req), true);
    assert.equal(byokFrom(req).openai.startsWith("sk-"), true);
    const empty = new Request("https://chamber.epictechai.app/api/v1/run");
    assert.equal(hasByok(empty), false);
  });
});

describe("email and json", () => {
  it("normalizes and masks email", () => {
    assert.equal(normEmail("  A@B.COM "), "a@b.com");
    assert.equal(normEmail("nope"), "");
    assert.equal(maskEmail("captain@epictechai.app"), "c***@epictechai.app");
  });
  it("parses json bodies without throwing", () => {
    assert.deepEqual(parseJsonBody("{"), {});
    assert.deepEqual(parseJsonBody('{"a":1}'), { a: 1 });
  });
});

describe("asset aliases", () => {
  it("maps favicon and legal pretty paths", () => {
    assert.equal(assetAlias("/"), "/index.html");
    assert.equal(assetAlias("/favicon.ico"), "/icon.jpg");
    assert.equal(assetAlias("/legal/terms"), "/legal/terms.html");
    assert.equal(assetAlias("/legal/privacy"), "/legal/privacy.html");
    assert.equal(assetAlias("/nope"), null);
  });
});
