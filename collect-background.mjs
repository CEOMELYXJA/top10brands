// Fonction d'arrière-plan (jusqu'à 15 min) : une catégorie, ou "_meta" (recherches en vogue + autres sources)
import { getStore } from "@netlify/blobs";
import { TOPICS, collectCategory, refreshTrends, checkKey } from "../lib/core.mjs";
import { refreshSignals } from "../lib/sources.mjs";
export default async (req) => {
  if (!checkKey(req)) return new Response("forbidden", { status: 403 });
  const cat = new URL(req.url).searchParams.get("cat"), store = getStore("eclat");
  if (cat === "_meta") { await refreshTrends(store); await refreshSignals(store); return new Response("ok"); }
  if (!TOPICS[cat]) return new Response("bad", { status: 400 });
  await collectCategory(store, cat);
  return new Response("ok");
};
