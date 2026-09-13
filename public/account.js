(() => {
  const $ = (id) => document.getElementById(id);
  const BYOK = "epic-sota-chamber-byok";

  function providers() {
    try {
      return JSON.parse(localStorage.getItem(BYOK) || "{}");
    } catch {
      return {};
    }
  }
  function saveProv(p) {
    localStorage.setItem(BYOK, JSON.stringify(p));
  }

  async function start() {
    const email = $("auth-email").value.trim();
    const r = await fetch("/api/v1/auth/start", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const j = await r.json().catch(() => ({ ok: false, error: "auth start failed" }));
    $("auth-msg").textContent = j.ok ? "Code sent. Check that inbox." : j.error || "Could not send.";
  }
  async function verify() {
    const r = await fetch("/api/v1/auth/verify", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: $("auth-email").value.trim(), code: $("auth-code").value.trim() }),
    });
    const j = await r.json().catch(() => ({ ok: false, error: "verify failed" }));
    $("auth-msg").textContent = j.ok ? "Session resumed as " + j.email : j.error || "No.";
    await me();
    if (j.ok) {
      await loadDown();
      await syncUp();
    }
  }
  async function me() {
    const r = await fetch("/api/v1/auth/me", { credentials: "include" });
    const j = await r.json().catch(() => ({ signedIn: false }));
    window.ChamberAccount = window.ChamberAccount || {};
    window.ChamberAccount.signedIn = Boolean(j.signedIn);
    window.ChamberAccount.email = j.email || "";
    if ($("auth-who")) {
      $("auth-who").textContent = j.signedIn ? j.email + " · private SOTA db on" : "Not signed in";
    }
    return j;
  }
  async function loadDown() {
    if (!window.ChamberAccount || !window.ChamberAccount.signedIn) return { ok: false };
    try {
      const graph = await (await fetch("/api/v1/db/graph", { credentials: "include" })).json();
      if (graph && graph.ok && !graph.empty && window.__chamberApplyGraph) {
        window.__chamberApplyGraph(graph);
      }
    } catch {
      /* local graph stays */
    }
    return { ok: true };
  }
  async function syncUp() {
    if (!window.ChamberAccount || !window.ChamberAccount.signedIn) return { ok: false };
    const graph = {
      id: "current",
      title: (document.getElementById("title") && document.getElementById("title").value) || "Untitled weave",
      nodes: (window.__chamberState && window.__chamberState.nodes) || [],
      edges: (window.__chamberState && window.__chamberState.edges) || [],
    };
    const items = ((window.__chamberState && window.__chamberState.library) || []).map((it) => ({
      id: it.id,
      lane: it.lane,
      title: it.title,
      prompt: String(it.prompt || "").slice(0, 500),
      kind: it.kind || "",
      mime: it.mime || "",
      ts: it.ts,
    }));
    await fetch("/api/v1/db/graph", {
      method: "PUT",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(graph),
    });
    await fetch("/api/v1/db/library", {
      method: "PUT",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items }),
    });
    const sum = await (await fetch("/api/v1/db", { credentials: "include" })).json().catch(() => ({}));
    if ($("auth-who") && sum.ok) {
      $("auth-who").textContent =
        (window.ChamberAccount.email || "") +
        " · db graphs " +
        sum.graphs +
        " · takes " +
        sum.library +
        " · credits " +
        (sum.credits || 0);
    }
    return sum;
  }
  async function logout() {
    await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" });
    me();
  }
  async function pay() {
    const r = await fetch("/api/v1/billing/checkout", { method: "POST", credentials: "include" });
    const j = await r.json().catch(() => ({ ok: false, error: "checkout failed" }));
    if (j.ok && j.url) location.href = j.url;
    else $("pay-msg").textContent = j.error || "Sign in first, then pay. Or paste BYOK.";
  }
  async function confirmPay() {
    const q = new URLSearchParams(location.search);
    if (q.get("paid") !== "1" || !q.get("session_id")) return;
    const r = await fetch("/api/v1/billing/confirm", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ session_id: q.get("session_id") }),
    });
    const j = await r.json().catch(() => ({ ok: false, error: "confirm failed" }));
    if ($("pay-msg")) $("pay-msg").textContent = j.ok ? "Credits on your SOTA db: " + j.credits : j.error || "Pay confirm failed";
    if ($("modal")) $("modal").classList.remove("hidden");
    if (j.ok) me();
  }

  window.ChamberAccount = { start, verify, me, logout, pay, confirmPay, providers, saveProv, syncUp, loadDown, signedIn: false };

  document.addEventListener("DOMContentLoaded", () => {
    if ($("auth-send")) $("auth-send").addEventListener("click", start);
    if ($("auth-go")) $("auth-go").addEventListener("click", verify);
    if ($("auth-out")) $("auth-out").addEventListener("click", logout);
    if ($("pay-go")) $("pay-go").addEventListener("click", pay);
    if ($("byok-save")) {
      $("byok-save").addEventListener("click", () => {
        const p = {
          xai: $("key").value.trim(),
          openai: $("byok-openai").value.trim(),
          anthropic: $("byok-anthropic").value.trim(),
          google: $("byok-google").value.trim(),
        };
        saveProv(p);
        if (p.xai) localStorage.setItem("epic-sota-chamber-key", p.xai);
        else localStorage.removeItem("epic-sota-chamber-key");
        $("byok-msg").textContent = "Saved in this browser only. Never uploaded as a stored secret.";
      });
    }
    const p = providers();
    if ($("key") && p.xai) $("key").value = p.xai;
    if ($("byok-openai")) $("byok-openai").value = p.openai || "";
    if ($("byok-anthropic")) $("byok-anthropic").value = p.anthropic || "";
    if ($("byok-google")) $("byok-google").value = p.google || "";
    me();
    confirmPay();

    const ON = "epic-sota-chamber-onboard-v1";
    const board = $("onboard");
    if (board && !localStorage.getItem(ON)) board.classList.remove("hidden");
    function closeOn() {
      localStorage.setItem(ON, "1");
      if (board) board.classList.add("hidden");
    }
    if ($("on-skip")) $("on-skip").addEventListener("click", closeOn);
    if ($("on-send")) {
      $("on-send").addEventListener("click", async () => {
        if ($("auth-email") && $("on-email")) $("auth-email").value = $("on-email").value;
        await start();
        if ($("on-msg") && $("auth-msg")) $("on-msg").textContent = $("auth-msg").textContent;
      });
    }
    if ($("on-go")) {
      $("on-go").addEventListener("click", async () => {
        if ($("auth-email") && $("on-email")) $("auth-email").value = $("on-email").value;
        if ($("auth-code") && $("on-code")) $("auth-code").value = $("on-code").value;
        await verify();
        if ($("on-msg") && $("auth-msg")) $("on-msg").textContent = $("auth-msg").textContent;
        const j = await me();
        if (j && j.signedIn) closeOn();
      });
    }
    if (board) {
      board.addEventListener("click", (e) => {
        if (e.target.id === "onboard") closeOn();
      });
    }
  });
})();
