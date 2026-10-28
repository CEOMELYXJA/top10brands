// API : /api/trends (méta) · ?market=us|caen|cafr · ?market=..&q=sujet
import { getStore } from "@netlify/blobs";
import { MARKETS, TOPICS, newsStats, kick } from "../lib/core.mjs";
export default async (req, ctx) => {
  const p = new URL(req.url).searchParams, store = getStore("eclat"), mk = p.get("market"), mc = MARKETS[mk];
  const J = (o, c = "public, max-age=300") => new Response(JSON.stringify(o), { headers: { "content-type": "application/json", "cache-control": c } });
  const q = (p.get("q") || "").trim().slice(0, 80);
  if (q) { if (!mc) return J({}, "no-store"); const s = await newsStats(q, mc); return J({ a: s.c1, b: s.c7, heads: s.heads }, "no-store"); }
  if (mc) {
    const cats = Object.keys(TOPICS), parts = await Promise.all(cats.map(c => store.get(`m:${mk}:${c}`, { type: "json" })));
    const sg = ((await store.get("sig", { type: "json" })) || {}).s || {}, out = []; parts.forEach((arr, i) => (arr || []).forEach(x => out.push({ n: x.n, c: cats[i], a: x.a, b: x.b, k: x.k, chg: x.chg, h: (x.h || []).slice(-24), x: sg[cats[i] + "|" + x.n] })));
    return J({ items: out });
  }
  const meta = await store.get("trends", { type: "json" });
  if (!meta) { await kick(store, ctx?.site?.url || process.env.URL, false); return J({ empty: true }, "no-store"); }
  return J(meta);
};
export const config = { path: "/api/trends" };
