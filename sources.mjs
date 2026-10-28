// Sources supplémentaires : Wikipédia (pages vues), Reddit, Hacker News, Mastodon.
// Chaque source est rapprochée des marchés par correspondance du nom (phrase exacte).
import { TOPICS } from "./catalog.mjs";
const UA = "web:top10brands:1.0 (trend radar)";
async function getJ(url, opt = {}, ms = 8000) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { ...opt, headers: { "user-agent": UA, ...(opt.headers || {}) }, signal: c.signal }); return r.ok ? await r.json() : null; }
  catch { return null; } finally { clearTimeout(t); }
}
async function par(list, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < list.length) { const j = i++; out[j] = await fn(list[j]); } }));
  return out;
}
const norm = s => " " + String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim() + " ";
const REDDIT = ["gadgets","BuyItForLife","homeautomation","3Dprinting","Frugal","smallbusiness","Entrepreneur","HomeImprovement","hobbies","camping","Fishing","woodworking","gardening","pickleball","gaming","Games","pcgaming","boardgames","NintendoSwitch","CryptoCurrency","wallstreetbets","investing","PersonalFinanceCanada","Bitcoin","CanadianInvestor","sports","nhl","nba","running","cycling","cars","electricvehicles","ebikes","malefashionadvice","femalefashionadvice","streetwear","Sneakers","food","Cooking","recipes","nutrition","whiskey","cocktails","beer","wine","spirits","all"];
// Wikipédia : pages vues du jour le plus récent disponible vs moyenne des 3 jours précédents (top 1000, en + fr)
async function wiki() {
  const out = new Map(), day = n => { const x = new Date(Date.now() - n * 864e5); return x.getUTCFullYear() + "/" + String(x.getUTCMonth() + 1).padStart(2, "0") + "/" + String(x.getUTCDate()).padStart(2, "0"); };
  for (const lg of ["en", "fr"]) {
    const js = await Promise.all([2, 3, 4, 5].map(n => getJ(`https://wikimedia.org/api/rest_v1/metrics/pageviews/top/${lg}.wikipedia/all-access/${day(n)}`)));
    const ds = js.map(j => { const a = (j && j.items && j.items[0] && j.items[0].articles) || []; return { m: new Map(a.map(x => [x.article, x.views])), min: a.length ? a[a.length - 1].views : 0 }; });
    if (!ds[0].m.size) continue;
    for (const [t, v] of ds[0].m) {
      if (t.includes(":") || t === "Main_Page") continue;
      const base = ds.slice(1).reduce((s, x) => s + (x.m.get(t) ?? x.min), 0) / 3, k = norm(t.replace(/_/g, " ")), old = out.get(k);
      if (!old || v > old[0]) out.set(k, [v, Math.round(base)]);
    }
  }
  return out;
}
// Reddit : publications populaires ("hot"). Option : REDDIT_ID / REDDIT_SECRET (app « script » gratuite) pour plus de fiabilité.
async function reddit() {
  const id = process.env.REDDIT_ID, sec = process.env.REDDIT_SECRET;
  let hdr = {}, host = "https://www.reddit.com", path = s => `/r/${s}/hot.json?limit=100&raw_json=1`;
  if (id && sec) {
    const t = await getJ("https://www.reddit.com/api/v1/access_token", { method: "POST", headers: { authorization: "Basic " + Buffer.from(id + ":" + sec).toString("base64"), "content-type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
    if (t && t.access_token) { hdr = { authorization: "Bearer " + t.access_token }; host = "https://oauth.reddit.com"; path = s => `/r/${s}/hot?limit=100&raw_json=1`; }
  }
  const res = await par(REDDIT, 6, s => getJ(host + path(s), { headers: hdr })), seen = new Set(), out = [];
  res.forEach(j => ((j && j.data && j.data.children) || []).forEach(({ data: p }) => { if (p && !seen.has(p.id)) { seen.add(p.id); out.push([norm(p.title), p.score || 0]); } }));
  return out;
}
async function hn() {
  const since = Math.floor(Date.now() / 1e3) - 86400;
  const j = await getJ(`https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=1000&numericFilters=${encodeURIComponent(`created_at_i>${since},points>5`)}`);
  return ((j && j.hits) || []).map(x => [norm(x.title || ""), x.points || 0]);
}
async function masto() {
  const j = await getJ("https://mastodon.social/api/v1/trends/tags?limit=20");
  return Array.isArray(j) ? j.map(t => [String(t.name).toLowerCase(), +((t.history && t.history[0] && t.history[0].uses) || 0), +((t.history && t.history[1] && t.history[1].uses) || 0)]) : [];
}
export async function refreshSignals(store) {
  const prev = ((await store.get("sig", { type: "json" })) || {}).s || {};
  const [w, r, h, m] = await Promise.all([wiki(), reddit(), hn(), masto()]), s = {};
  for (const [cat, names] of Object.entries(TOPICS)) for (const n of names) {
    const k = cat + "|" + n, nk = norm(n), p = prev[k] || {}, o = {};
    if (nk.trim().length >= 3) {
      if (w.size) { let b = null; for (const [t, v] of w) if (t.includes(nk) && (!b || v[0] > b[0])) b = v; if (b) o.w = b; } else if (p.w) o.w = p.w;
      if (r.length) { let c = 0, sc = 0; for (const [t, v] of r) if (t.includes(nk)) { c++; sc += v; } if (c) o.r = [c, sc]; } else if (p.r) o.r = p.r;
      if (h.length) { let c = 0, sc = 0; for (const [t, v] of h) if (t.includes(nk)) { c++; sc += v; } if (c) o.hn = [c, sc]; } else if (p.hn) o.hn = p.hn;
      if (m.length) { const e = m.find(x => x[0] === nk.replace(/ /g, "")); if (e) o.ms = [e[1], e[2]]; } else if (p.ms) o.ms = p.ms;
    }
    if (Object.keys(o).length) s[k] = o;
  }
  await store.setJSON("sig", { updated: new Date().toISOString(), s });
  return s;
}
