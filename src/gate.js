import { DurableObject } from "cloudflare:workers";
import { json, sha, otp, token, normEmail, maskEmail } from "./lib.js";

export class ChamberGate extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS otp (email TEXT PRIMARY KEY, hash TEXT, exp INTEGER, n INTEGER, last INTEGER)",
    );
    this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS sess (id TEXT PRIMARY KEY, email TEXT, exp INTEGER)");
  }

  async start(email, env) {
    const em = normEmail(email);
    if (!em) return { ok: false, error: "Need a real email." };
    const now = Date.now();
    const row = this.ctx.storage.sql.exec("SELECT n, last FROM otp WHERE email = ?", em).toArray()[0];
    if (row && now - Number(row.last) < 60000) return { ok: false, error: "Wait a minute before another code." };
    if (row && Number(row.n) > 8 && now - Number(row.last) < 3600000) {
      return { ok: false, error: "Too many codes for this inbox." };
    }
    const code = otp();
    const hash = await sha(em + ":" + code);
    const n = row ? Number(row.n) + 1 : 1;
    this.ctx.storage.sql.exec(
      "INSERT INTO otp(email,hash,exp,n,last) VALUES(?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET hash=excluded.hash, exp=excluded.exp, n=excluded.n, last=excluded.last",
      em,
      hash,
      now + 10 * 60000,
      n,
      now,
    );
    if (!env.EMAIL || typeof env.EMAIL.send !== "function") {
      return {
        ok: false,
        configured: false,
        error: "Email sending is not enabled on this Worker yet.",
      };
    }
    try {
      await env.EMAIL.send({
        to: em,
        from: { email: "chamber@epictechai.app", name: "Epic SOTA Chamber" },
        subject: "Your Chamber resume code",
        text:
          "💯Epic Tech AI🔥™
\nYour Epic SOTA Chamber code: " +
          code +
          "\nIt expires in 10 minutes. Nobody at Epic Tech will ask you for this code in chat.\n\nhttps://chamber.epictechai.app/",
        html:
          "<p>💯Epic Tech AI🔥™</p><p>Your Epic SOTA Chamber code: <b>" +
          code +
          "</b></p><p>Expires in 10 minutes. We will never ask for this code in a DM.</p>",
      });
    } catch (err) {
      return { ok: false, error: "Could not send email (" + (err.code || "send") + "). Domain must be onboarded for Email Sending." };
    }
    return { ok: true, sent: true, email: maskEmail(em) };
  }

  async verify(email, code) {
    const em = normEmail(email);
    const c = String(code || "").replace(/\D/g, "");
    if (!em || c.length !== 6) return { ok: false, error: "Email and 6-digit code." };
    const row = this.ctx.storage.sql.exec("SELECT hash, exp FROM otp WHERE email = ?", em).toArray()[0];
    if (!row) return { ok: false, error: "No code pending." };
    if (Date.now() > Number(row.exp)) return { ok: false, error: "Code expired." };
    const hash = await sha(em + ":" + c);
    if (hash !== row.hash) return { ok: false, error: "Wrong code." };
    this.ctx.storage.sql.exec("DELETE FROM otp WHERE email = ?", em);
    const id = token();
    const exp = Date.now() + 30 * 24 * 60 * 60 * 1000;
    this.ctx.storage.sql.exec("INSERT INTO sess(id,email,exp) VALUES(?,?,?)", id, em, exp);
    return { ok: true, token: id, email: em, exp };
  }

  async me(sid) {
    if (!sid) return { ok: false, signedIn: false };
    const row = this.ctx.storage.sql.exec("SELECT email, exp FROM sess WHERE id = ?", sid).toArray()[0];
    if (!row || Date.now() > Number(row.exp)) return { ok: false, signedIn: false };
    return { ok: true, signedIn: true, email: row.email };
  }

  async logout(sid) {
    if (sid) this.ctx.storage.sql.exec("DELETE FROM sess WHERE id = ?", sid);
    return { ok: true };
  }

  async fetch(request) {
    const url = new URL(request.url);
    const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
    if (url.pathname.endsWith("/start")) return json(await this.start(body.email, this.env));
    if (url.pathname.endsWith("/verify")) return json(await this.verify(body.email, body.code));
    if (url.pathname.endsWith("/me")) return json(await this.me(body.sid || url.searchParams.get("sid")));
    if (url.pathname.endsWith("/logout")) return json(await this.logout(body.sid));
    return json({ ok: false, error: "gate" }, 404);
  }
}
