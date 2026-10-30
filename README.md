# Ma collection TCG, version TanStack (Module 2)

Application React de gestion d'une collection de cartes à collectionner, construite avec l'écosystème TanStack : cache serveur (Query), routage typé (Router), tableau (Table) et formulaires (Form + Zod). Les données sont servies par json-server.

Explications détaillées, étape par étape, et réponses aux questions du TP : [`EXPLICATIONS.md`](./EXPLICATIONS.md).

## Prérequis

- Node.js 20 ou plus, npm 10 ou plus
- Ports libres : 5173 (Vite) et 3001 (json-server)

## Commandes

```bash
npm install          # dépendances
npm run api          # API json-server sur http://localhost:3001 (délai simulé de 400 ms)
npm run dev          # application sur http://localhost:5173
npm run lint         # oxlint (doit être silencieux)
npm run build        # build de production dans dist/
npm run api:reset    # remet db.json à l'état initial (copie de db.seed.json), API arrêtée
```

Lancer `npm run api` et `npm run dev` dans deux terminaux.

## Pages

| URL | Contenu |
|---|---|
| `/` | Collection en grille ou en tableau. Recherche, rareté, page, tri et vue dans l'URL : `/?q=ra&rarity=rare&page=2`, `/?view=table&sort=price.desc` |
| `/cards/$cardId` | Détail d'une carte : quantité, favori, suppression, note sauvegardée automatiquement |
| `/favorites` | Cartes favorites |
| `/add` | Formulaire d'ajout validé (Zod + vérification asynchrone du nom) |

## Arborescence

```
db.json               données json-server (cards, favorites, notes), modifiées par l'API
db.seed.json          état initial de db.json
src/
├─ main.jsx           QueryClient, routeur, providers, devtools
├─ routeTree.gen.ts   généré par @tanstack/router-plugin (ne pas modifier)
├─ api/               fonctions fetch brutes (client.js : request + HttpError)
├─ queries/           clés de cache, queryOptions, mutations (optimistes)
├─ routes/            routes par fichiers : __root, index, cards.$cardId, favorites, add
├─ components/        composants d'affichage (grille, tableau, formulaire, notes…)
├─ domain/            règles métier : constantes, formatage, schéma Zod d'une carte
└─ hooks/             useDebouncedValue, useDocumentTitle, useToasts
```

## Versions

React 19.3 · TanStack Query 5.105 · TanStack Router 1.170 (plugin 1.168) · TanStack Table 8.21 · TanStack Form 1.33 · Zod 4.6 · json-server 0.17.4 · Vite 8.3 · oxlint 1.89

## Choix techniques

- **Chaque état a un seul propriétaire.** Données : le serveur, mises en cache par TanStack Query. Ce qu'on regarde (filtre, page, tri, vue, carte) : l'URL. Saisie : TanStack Form. Préférences éphémères (colonnes masquées) : état local. Tout le reste est dérivé (ex. l'ensemble des favoris).
- **Clés de cache hiérarchiques** (`cardKeys`) et **`queryOptions`** partagés entre composants et loaders : aucune clé écrite à la main dans un composant.
- **Loaders + `ensureQueryData`** : les données sont chargées avant l'affichage, et dès le survol des liens (`defaultPreload: "intent"`). Sur la collection, le loader n'attend qu'à l'arrivée sur la page ; un changement de filtre affiche les anciennes données sous un voile (`keepPreviousData`) pendant le chargement.
- **Filtre, tri et pagination côté serveur** (`q`, `rarity`, `_sort`, `_order`, `_page`, `_limit`, `X-Total-Count`) ; la table TanStack est en mode manuel, contrôlée par l'URL.
- **Mises à jour optimistes** (quantité, suppression, favoris) avec rollback, et invalidation seulement à la fin de la dernière mutation en cours.
- **Erreurs** : pas de nouvelle tentative sur les 4xx ; `errorComponent` / `notFoundComponent` par route ; toasts globaux via `QueryCache` / `MutationCache`. Une requête qui échoue **sans** données est lancée (`throwOnError`) vers l'Error Boundary la plus proche (route, ou boundary locale pour l'en-tête et les notes) ; **avec** des données déjà affichées, on les garde et un toast prévient.
- **Formulaire** : un seul schéma Zod qui valide et convertit (« 3,5 » → 3.5) ; vérification asynchrone avec debounce et annulation.
- **Notes** : sauvegarde automatique 800 ms après la dernière frappe ; mutations sérialisées (`scope`) pour ne jamais créer deux notes.
- **Accessibilité** : `aria-sort`, `aria-live` sur le nombre de résultats, `aria-busy`, `aria-pressed`, `role="alert"`.

## Avec plus de temps

- Passer en **TypeScript** pour profiter du typage des routes, des paramètres et des search params généré par le routeur.
- **Tests** automatisés dans le dépôt : Vitest + Testing Library + MSW (un `QueryClient` par test, `retry: false`), en particulier pour la mise à jour optimiste et le rollback.
- **Scroll infini** (`useInfiniteQuery`) sur la grille et **virtualisation** (TanStack Virtual) du tableau pour de très grandes collections.
- Un vrai backend : **unicité du nom garantie côté serveur** (la vérification asynchrone peut être contournée par deux ajouts simultanés), recherche insensible à la casse, tri sur la valeur calculée, `cardId` indexé.
- **Persistance du cache** (`persistQueryClient`) pour une ouverture instantanée, y compris hors ligne.
- Une vraie page de détail des erreurs réseau (hors ligne / serveur en panne) et une file de mutations rejouées à la reconnexion.
