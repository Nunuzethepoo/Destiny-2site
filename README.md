# VIGIE — Arsenal Destiny 2

Site statique français pour consulter les Gardiens, rechercher des builds, sauvegarder des sets, partager une fiche de build par lien, déplacer/équiper des objets, consulter les rapports de raids et de donjons, et parcourir les membres de son clan Bungie. Les builds restent dans le stockage local du navigateur ; un lien de partage transporte une copie des éléments choisis, sans identifiant de compte.

## Déploiement GitHub Pages

Les fichiers du site doivent rester à la racine du dépôt. Dans GitHub, active Pages depuis **Settings → Pages → Deploy from a branch → main → /(root)**.

## Connexion Bungie

GitHub Pages n’exécute pas de code serveur. `worker.js` est le relais Cloudflare qui garde la clé API hors des pages publiques et relaie seulement les appels Bungie nécessaires.

1. Déploie `worker.js` dans **Cloudflare → Workers & Pages → Create Worker → Edit code → Deploy**.
2. Dans les paramètres du Worker, configure la variable `SITE_ORIGIN` avec l’origine du site, sans chemin. Pour le domaine GitHub Pages par défaut : `https://nunuzethepoo.github.io`. Si tu utilises un domaine personnalisé, entre son origine à la place.
3. Dans **Settings → Variables and Secrets**, ajoute `BUNGIE_CLIENT_ID` avec la valeur `56963` et `BUNGIE_API_KEY` comme **Secret** avec ta clé API actuellement valide.
4. Dans le portail développeur Bungie, configure le client `56963` en client public, avec l’URL de retour exacte : `https://nunuzethepoo.github.io/Destiny-2site/oauth.html`. Active `ReadDestinyInventoryAndVault`, `MoveEquipDestinyItems` et `Read Group/Clan Forums, Wall and Members` pour que l’onglet Clan puisse lire le clan connecté. N’ajoute pas de paramètre OAuth `scope` à l’URL.
5. Remplace/publie les fichiers modifiés du site dans le dépôt GitHub. Ouvre la page `oauth.html`, colle l’URL `https://NOM-DU-WORKER.NOM-DE-COMPTE.workers.dev`, puis clique **Connecter mon compte**.

Un client Bungie public ne reçoit pas de jeton de renouvellement. Si sa session expire, reconnecte-toi depuis `oauth.html`. Le jeton n’est stocké que dans `sessionStorage` pour l’onglet en cours.

## Sécurité

- Les anciennes pages contenaient une clé API directement dans le JavaScript. Cette version les remplace par `bungie-api.js` et le relais `worker.js` ; assure-toi de publier les fichiers nettoyés.
- Désactive/régénère toute ancienne clé API qui a déjà été publiée dans le dépôt ou partagée. Ne mets jamais une clé API ni un client secret dans un fichier HTML, JavaScript, commit, capture ou message public.
- L’application ne modifie que les routes d’inventaire listées dans `worker.js`. Les mods reversibles passent par `InsertSocketPlugFree`; les actions avancées de Bungie ne sont pas exposées.

## Fichiers

- `index.html` — accueil Arsenal VIGIE.
- `oauth.html` — connexion OAuth Bungie et configuration de l’URL du Worker.
- `bungie-api.js` — client navigateur, sans clé API.
- `worker.js` — relais Cloudflare.
- `vigie.css` et `vigie-shell.js` — thème commun et navigation des pages.
- `generateur.html` — recherche de builds par priorités de stats, exotique et bonus d’armure à 2 ou 4 pièces.
- `partager.html` et `builds-partage.js` — partage de builds par lien autonome et fiche publique récapitulative.
- `collection.html` et `collection.js` — catalogue des armes Bungie et recherche des rolls PvE recommandés par la liste communautaire Aegis.
- `raids.html` et `raids.js` — guides en français des raids, rôles, glossaire débutant, actions et erreurs à éviter, avec cartes communautaires ou captures réelles des salles créditées par rencontre.
- `rapports.html` et `activity-reports.js` — historiques Raid Report et Donjon Report, avec rapports PGCR Bungie.
- `clan.html` et `clan.js` — membres du clan connecté et rapports d’activités publics.
- `profil.html`, `armures.html`, `equiper.html`, `mods.html` — gestion de compte et d’équipement.
- `manifest.html`, `diagnostic*.html`, `bungie.html` — pages de diagnostic.


