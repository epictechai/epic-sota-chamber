/* Epic SOTA Chamber kernel — protocol 1. Caps register; unknown caps no-op. */
(function (global) {
  const PROTOCOL = 1;
  const caps = new Map();

  function register(def) {
    if (!def || !def.id) throw new Error("cap needs id");
    caps.set(def.id, {
      version: "1.0.0",
      kind: "local",
      title: def.id,
      desc: "",
      in: {},
      out: {},
      ...def,
    });
    return def.id;
  }

  async function invoke(id, input, ctx) {
    const cap = caps.get(id);
    if (!cap) return { ok: false, error: `unknown cap ${id}`, protocol: PROTOCOL };
    try {
      const result = await cap.run(input || {}, ctx || {});
      return { ok: true, cap: id, version: cap.version, protocol: PROTOCOL, result };
    } catch (err) {
      return { ok: false, cap: id, error: String(err && err.message ? err.message : err), protocol: PROTOCOL };
    }
  }

  function catalog() {
    return [...caps.values()].map(({ run, ...rest }) => rest);
  }

  global.SOTA = { PROTOCOL, register, invoke, catalog, caps };
})(window);
