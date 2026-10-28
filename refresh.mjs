// Fonction planifiée : toutes les heures (déploiement de production seulement)
import { getStore } from "@netlify/blobs";
import { kick } from "../lib/core.mjs";
export default async (req, ctx) => { await kick(getStore("eclat"), ctx?.site?.url || process.env.URL, true); };
export const config = { schedule: "@hourly" };
