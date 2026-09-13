import { DurableObject } from "cloudflare:workers";
import { json } from "./lib.js";

export class ChamberUser extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT, ts INTEGER)");
    this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS graphs (id TEXT PRIMARY KEY, title TEXT, body TEXT, ts INTEGER)");
    this.ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS library (id TEXT PRIMARY KEY, lane TEXT, title TEXT, prompt TEXT, kind TEXT, mime TEXT, ts INTEGER)",
    );
    this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, cap TEXT, ok INTEGER, ms INTEGER, ts INTEGER)");
  }

  summary() {
    const kv = this.ctx.storage.sql.exec("SELECT k, v FROM kv").toArray();
    const meta = {};
    for (const row of kv) meta[row.k] = row.v;
    const graphs = this.ctx.storage.sql.exec("SELECT COUNT(*) AS n FROM graphs").one();
    const libs = this.ctx.storage.sql.exec("SELECT COUNT(*) AS n FROM library").one();
    const jobs = this.ctx.storage.sql.exec("SELECT COUNT(*) AS n FROM jobs").one();
    return {
      ok: true,
      product: "epic-sota-chamber",
      db: "ChamberUser",
      brand: "💯Epic Tech AI🔥™",
      credits: Number(meta.credits || 0),
      graphs: Number(graphs.n || 0),
      library: Number(libs.n || 0),
      jobs: Number(jobs.n || 0),
    };
  }

  putGraph(body) {
    const id = String(body.id || "current");
    const title = String(body.title || "Untitled weave").slice(0, 120);
    const slim = {
      title,
      nodes: (body.nodes || []).map((n) => ({
        id: n.id,
        cap: n.cap,
        x: n.x,
        y: n.y,
        input: { prompt: n.input && n.input.prompt ? String(n.input.prompt).slice(0, 4000) : "" },
        status: n.status || "",
      })),
      edges: body.edges || [],
    };
    this.ctx.storage.sql.exec(
      "INSERT INTO graphs(id,title,body,ts) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title, body=excluded.body, ts=excluded.ts",
      id,
      title,
      JSON.stringify(slim),
      Date.now(),
    );
    return { ok: true, id, nodes: slim.nodes.length };
  }

  getGraph(id) {
    const row = this.ctx.storage.sql.exec("SELECT title, body, ts FROM graphs WHERE id = ?", id || "current").toArray()[0];
    if (!row) return { ok: true, empty: true };
    return { ok: true, title: row.title, ts: row.ts, ...JSON.parse(row.body || "{}") };
  }

  putLibrary(items) {
    const list = Array.isArray(items) ? items.slice(0, 80) : [];
    for (const it of list) {
      this.ctx.storage.sql.exec(
        "INSERT INTO library(id,lane,title,prompt,kind,mime,ts) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET lane=excluded.lane, title=excluded.title, prompt=excluded.prompt, kind=excluded.kind, mime=excluded.mime, ts=excluded.ts",
        String(it.id || "").slice(0, 64),
        String(it.lane || "pack").slice(0, 32),
        String(it.title || "").slice(0, 80),
        String(it.prompt || "").slice(0, 500),
        String(it.kind || "").slice(0, 32),
        String(it.mime || "").slice(0, 64),
        Number(it.ts) || Date.now(),
      );
    }
    return { ok: true, n: list.length };
  }

  listLibrary() {
    const rows = this.ctx.storage.sql.exec("SELECT id, lane, title, prompt, kind, mime, ts FROM library ORDER BY ts DESC LIMIT 80").toArray();
    return { ok: true, items: rows };
  }

  addJob(cap, ok, ms) {
    this.ctx.storage.sql.exec(
      "INSERT INTO jobs(cap,ok,ms,ts) VALUES(?,?,?,?)",
      String(cap || "").slice(0, 32),
      ok ? 1 : 0,
      Number(ms) || 0,
      Date.now(),
    );
    return { ok: true };
  }

  addCredits(n, sessionId) {
    if (sessionId) {
      const k = "paid:" + String(sessionId).slice(0, 80);
      const seen = this.ctx.storage.sql.exec("SELECT v FROM kv WHERE k = ?", k).toArray()[0];
      if (seen) {
        const row2 = this.ctx.storage.sql.exec("SELECT v FROM kv WHERE k = 'credits'").toArray()[0];
        return { ok: true, already: true, credits: Number(row2 && row2.v ? row2.v : 0) };
      }
      this.ctx.storage.sql.exec("INSERT INTO kv(k,v,ts) VALUES(?,?,?)", k, "1", Date.now());
    }
    const row = this.ctx.storage.sql.exec("SELECT v FROM kv WHERE k = 'credits'").toArray()[0];
    const next = Math.max(0, Number(row && row.v ? row.v : 0) + Number(n || 0));
    this.ctx.storage.sql.exec(
      "INSERT INTO kv(k,v,ts) VALUES('credits',?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v, ts=excluded.ts",
      String(next),
      Date.now(),
    );
    return { ok: true, credits: next };
  }

  async fetch(request) {
    const url = new URL(request.url);
    const body = request.method !== "GET" ? await request.json().catch(() => ({})) : {};
    if (url.pathname.endsWith("/summary") || (request.method === "GET" && url.pathname.endsWith("/db"))) return json(this.summary());
    if (url.pathname.endsWith("/graph") && request.method === "PUT") return json(this.putGraph(body));
    if (url.pathname.endsWith("/graph") && request.method === "GET") return json(this.getGraph(url.searchParams.get("id")));
    if (url.pathname.endsWith("/library") && request.method === "PUT") return json(this.putLibrary(body.items || body));
    if (url.pathname.endsWith("/library") && request.method === "GET") return json(this.listLibrary());
    if (url.pathname.endsWith("/job") && request.method === "POST") return json(this.addJob(body.cap, body.ok, body.ms));
    if (url.pathname.endsWith("/credits") && request.method === "POST") return json(this.addCredits(body.n, body.session_id));
    return json(this.summary());
  }
}
