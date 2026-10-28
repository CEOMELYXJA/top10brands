import { TOPICS, GEOS } from "./catalog.mjs";
export { TOPICS };
export const MARKETS = {
  us:   { hl: "en-US", gl: "US", ceid: "US:en" },
  caen: { hl: "en-CA", gl: "CA", ceid: "CA:en" },
  cafr: { hl: "fr-CA", gl: "CA", ceid: "CA:fr" }
};
const KEY = () => process.env.SYNC_KEY || process.env.SITE_ID || "dev";
async function get(url, ms = 8000) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; Top10BrandsBot/1.0)" }, signal: c.signal }); return r.ok ? await r.text() : ""; }
  catch { return ""; } finally { clearTimeout(t); }
}
const dec = s => s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const tag = (x, t) => { const m = x.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)); return m ? dec(m[1]).trim() : ""; };
const items = x => x.match(/<item>[\s\S]*?<\/item>/g) || [];
async function pool(list, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < list.length) { const j = i++; out[j] = await fn(list[j]); } }));
  return out;
}
// Signal réel : articles Google Actualités des dernières 24 h (c1) vs les 6 jours précédents (c7)
export async function newsStats(topic, mc) {
  const xml = await get(`https://news.google.com/rss/search?q=${encodeURIComponent(`"${topic}" when:7d`)}&hl=${mc.hl}&gl=${mc.gl}&ceid=${mc.ceid}`);
  const now = Date.now(); let c1 = 0, c7 = 0; const heads = [];
  for (const it of items(xml)) {
    const d = Date.parse(tag(it, "pubDate")); if (!d) continue;
    if (now - d < 864e5) c1++; else c7++;
    if (heads.length < 4) heads.push({ t: tag(it, "title"), u: tag(it, "link") });
  }
  return { c1, c7, heads, ok: !!xml };
}
async function coins() {
  try {
    const j = JSON.parse(await get("https://api.coingecko.com/api/v3/search/trending"));
    return (j.coins || []).slice(0, 7).map(({ item: i }) => ({ n: `${i.name} (${i.symbol})`, chg: i.data?.price_change_percentage_24h?.usd ?? 0 }));
  } catch { return []; }
}
// Recherches en vogue Google par pays, province et État
export async function refreshTrends(store) {
  const res = await pool(GEOS, 20, async g => [g, items(await get(`https://trends.google.com/trending/rss?geo=${g}`)).map(it => tag(it, "title")).slice(0, 25)]);
  const old = (await store.get("trends", { type: "json" }))?.t || {}, t = {};
  res.forEach(([g, l]) => { t[g] = l.length ? l : (old[g] || []); });
  await store.setJSON("trends", { updated: new Date().toISOString(), t });
}
// Collecte d'une catégorie (100 marchés × 3 marchés linguistiques), historique horaire conservé 7 jours
export async function collectCategory(store, cat) {
  const names = TOPICS[cat], cn = cat === "finance" ? await coins() : [];
  for (const [mk, mc] of Object.entries(MARKETS)) {
    const key = `m:${mk}:${cat}`, prev = new Map(((await store.get(key, { type: "json" })) || []).map(i => [i.n, i]));
    const res = await pool(names, 15, async n => ({ n, s: await newsStats(n, mc) }));
    const out = [];
    for (const { n, s } of res) {
      const p = prev.get(n);
      if (!s.ok) { if (p) out.push(p); continue; } // jamais de faux zéros si la source échoue
      out.push({ n, a: s.c1, b: s.c7, h: [...(p ? p.h : []), s.c1].slice(-168) });
    }
    cn.forEach(c => out.push({ n: c.n, k: 1, chg: c.chg, a: 0, b: 0, h: [] }));
    await store.setJSON(key, out);
  }
}
export async function kick(store, base, force) {
  const last = await store.get("kick", { type: "json" });
  if (!force && last && Date.now() - last < 3e5) return;
  await store.setJSON("kick", Date.now());
  await Promise.all([...Object.keys(TOPICS), "_meta"].map(c => fetch(`${base}/.netlify/functions/collect-background?cat=${c}`, { method: "POST", headers: { "x-sync-key": KEY() } }).catch(() => {})));
}
export const checkKey = req => req.headers.get("x-sync-key") === KEY();
