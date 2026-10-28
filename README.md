# TOP10BRANDS — Netlify
1. Mettre ce dossier dans un dépôt GitHub (ou utiliser `netlify deploy --prod`).
2. Netlify > Add new site > Import from Git. Aucun réglage requis (netlify.toml).
3. Les données se rafraîchissent chaque heure (fonction planifiée `refresh`, déploiement de production seulement).
   À la toute première visite, la collecte démarre d'elle-même (quelques minutes).
Catalogue des marchés : netlify/lib/catalog.mjs. Variable optionnelle SYNC_KEY (clé interne entre les fonctions).

## Sources de données
Google Actualités, Google Tendances, Wikipédia (pages vues), Reddit, Hacker News, Mastodon, CoinGecko — aucune clé requise.
Optionnel, pour un Reddit plus fiable : créer une app « script » sur reddit.com/prefs/apps puis définir REDDIT_ID et REDDIT_SECRET dans Netlify (Site configuration > Environment variables).
