import { ChamberGate } from "./gate.js";
import { ChamberUser } from "./user-db.js";
import { ChamberAgent } from "./agent.js";
import {
  PRODUCT,
  CAPS,
  COST,
  MODEL_LLM,
  MODEL_IMAGE,
  json,
  bad,
  corsPreflight,
  cookieSid,
  sidCookie,
  byokFrom,
  userDoSafe,
  billCap,
  stripeCheckout,
  assetAlias,
  vendorFetch,
  STRIPE_TIMEOUT_MS,
} from "./lib.js";

export { ChamberAgent, ChamberGate, ChamberUser };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return corsPreflight();

    const agent = env.CHAMBER.get(env.CHAMBER.idFromName("weave"));
    if (url.pathname === "/api/health" || url.pathname === "/api/v1/health") {
      let ai = "error";
      let agentPing = null;
      try {
        agentPing = await agent.ping();
        ai = "bound";
      } catch (e) {
        ai = String(e && e.message ? e.message : e);
      }
      return json({
        ...PRODUCT,
        caps: CAPS.length,
        ai,
        agent: "ChamberAgent",
        llm: MODEL_LLM,
        image: MODEL_IMAGE,
        ping: agentPing,
        auth: { emailCodes: Boolean(env.EMAIL), byok: true, hardcodedKeys: false, userDb: true },
        billing: {
          stripe: Boolean(env.STRIPE_SECRET_KEY),
          microUsd: 99,
          creditsPerMicro: 10,
          cost: COST,
          byokOrPay: true,
        },
        legal: [
          "/legal/terms.html",
          "/legal/privacy.html",
          "/legal/aup.html",
          "/legal/license.html",
          "/legal/whitepaper.html",
          "/legal/security.html",
        ],
        ts: new Date().toISOString(),
      });
    }

    const gate = env.GATE.get(env.GATE.idFromName("gate"));

    if (url.pathname === "/api/v1/auth/start" && request.method === "POST") {
      return gate.fetch(
        new Request("https://gate/start", {
          method: "POST",
          body: await request.text(),
          headers: { "content-type": "application/json" },
        }),
      );
    }

    if (url.pathname === "/api/v1/auth/verify" && request.method === "POST") {
      const g = await gate.fetch(
        new Request("https://gate/verify", {
          method: "POST",
          body: await request.text(),
          headers: { "content-type": "application/json" },
        }),
      );
      const data = await g.json();
      const headers = {};
      if (data.ok && data.token) headers["set-cookie"] = sidCookie(data.token);
      return json({ ok: data.ok, email: data.email, error: data.error, signedIn: Boolean(data.ok) }, data.ok ? 200 : 401, { headers });
    }

    if (url.pathname === "/api/v1/auth/me") {
      const g = await gate.fetch(new Request("https://gate/me?sid=" + encodeURIComponent(cookieSid(request))));
      return new Response(await g.text(), {
        status: g.status,
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
      });
    }

    if (url.pathname === "/api/v1/auth/logout" && request.method === "POST") {
      await gate.fetch(
        new Request("https://gate/logout", {
          method: "POST",
          body: JSON.stringify({ sid: cookieSid(request) }),
          headers: { "content-type": "application/json" },
        }),
      );
      return json({ ok: true }, 200, { headers: { "set-cookie": sidCookie("", true) } });
    }

    if (url.pathname === "/api/v1/billing/checkout" && request.method === "POST") {
      const origin = url.origin.replace(/http:/, "https:");
      const u = await userDoSafe(env, request, gate);
      const out = await stripeCheckout(env, origin, u && u.who && u.who.email);
      return json(out, out.ok ? 200 : 503);
    }

    if (url.pathname === "/api/v1/billing/confirm" && request.method === "POST") {
      const u = await userDoSafe(env, request, gate);
      if (!u) return json({ ok: false, error: "Sign in first, then pay." }, 401);
      if (!env.STRIPE_SECRET_KEY) return json({ ok: false, configured: false, error: "Stripe not configured" }, 503);
      let body = {};
      try {
        body = await request.json();
      } catch {
        body = {};
      }
      const sid = String(body.session_id || url.searchParams.get("session_id") || "");
      if (!sid) return json({ ok: false, error: "missing session_id" }, 400);
      const res = await vendorFetch(
        "https://api.stripe.com/v1/checkout/sessions/" + encodeURIComponent(sid),
        {
          headers: { authorization: "Bearer " + env.STRIPE_SECRET_KEY },
        },
        STRIPE_TIMEOUT_MS,
      );
      const ses = await res.json().catch(() => ({}));
      if (!res.ok || ses.payment_status !== "paid") {
        return json({ ok: false, error: "Payment not complete." }, 402);
      }
      const add = await u.stub.fetch(
        new Request("https://user/credits", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ n: 10, session_id: sid }),
        }),
      );
      return json(await add.json());
    }

    if (url.pathname === "/api/v1/billing/spend" && request.method === "POST") {
      let body = {};
      try {
        body = await request.json();
      } catch {
        body = {};
      }
      const billed = await billCap(request, env, String(body.cap || ""), await userDoSafe(env, request, gate));
      return json(billed, billed.ok ? 200 : billed.status || 402);
    }

    if (url.pathname.startsWith("/api/v1/db")) {
      const who = await (await gate.fetch(new Request("https://gate/me?sid=" + encodeURIComponent(cookieSid(request))))).json();
      if (!who.signedIn || !who.email) return json({ ok: false, error: "Sign in with email + code to open your SOTA db." }, 401);
      const stub = env.USERS.get(env.USERS.idFromName(who.email.toLowerCase()));
      const path = url.pathname.replace("/api/v1/db", "") || "/summary";
      const method = request.method;
      const init = { method, headers: { "content-type": "application/json" } };
      if (method !== "GET") init.body = await request.text();
      return stub.fetch(new Request("https://user" + path + url.search, init));
    }

    if (url.pathname === "/api/v1/caps") {
      return json({ ok: true, protocol: 1, caps: CAPS, agent: "ChamberAgent", llm: MODEL_LLM });
    }

    if ((url.pathname === "/api/v1/run" || url.pathname === "/api/v1/ask") && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return bad("invalid json");
      }
      const id = String(body.cap || body.id || "agent");
      const meta = CAPS.find((c) => c.id === id);
      if (meta && meta.kind === "local") {
        return json({ ok: true, cap: id, deferred: "local", note: "run in the chamber kernel" });
      }
      const billed = await billCap(request, env, id, await userDoSafe(env, request, gate));
      if (!billed.ok) return json(billed, billed.status || 402);
      const out = await agent.compute(id, body.input || body, byokFrom(request));
      return json({ ...out, billed }, 200);
    }

    if (url.pathname.startsWith("/api/")) return bad("not found", 404);

    const alias = assetAlias(url.pathname);
    if (alias) {
      const aliased = new URL(request.url);
      aliased.pathname = alias;
      return env.ASSETS.fetch(new Request(aliased, request));
    }
    return env.ASSETS.fetch(request);
  },
};
