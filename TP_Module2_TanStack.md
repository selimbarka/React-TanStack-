# TP Module 2 : « Ma collection TCG, version TanStack »

**Thème :** reprendre l'application du Module 1 et la faire passer à l'échelle avec l'écosystème TanStack : cache serveur, routage typé, tableaux et formulaires.

**Stack :** Vite + React 19 + JavaScript (JSX) + TanStack Query v5 + TanStack Router + TanStack Table v8 + TanStack Form v1 + Zod

**Prérequis :** Module 1 terminé (`tcg-collection`). On repart du même projet, sur une nouvelle branche Git.

**Fichier fourni :** `fournis/db.json` (24 cartes, plus les collections `favorites` et `notes`, vides).

> Les API de TanStack évoluent vite. En cas de doute sur un nom de fonction ou d'option, la documentation de **la version installée** fait foi (tanstack.com). Notez la version de chaque paquet dans votre rendu.

À la fin du TP, votre application :

- lit et écrit ses données via un **cache serveur** (TanStack Query) : plus de `useCards` fait main
- gère le chargement, les erreurs, le rafraîchissement et les **mises à jour optimistes**
- est découpée en **pages** avec un routeur typé (liste, détail d'une carte, favoris, ajout)
- garde filtres, tri et pagination **dans l'URL**
- propose une **vue tableau** triable, filtrable et paginée (TanStack Table)
- valide le formulaire d'ajout avec TanStack Form + Zod, y compris une validation **asynchrone**
- persiste favoris et notes côté serveur

---

## Étape 0 : Mise en place

### Consignes


2. Remplacez `db.json` à la racine par `fournis/db.json` (24 cartes).
3. Installez les dépendances :
   ```bash
   npm install @tanstack/react-query @tanstack/react-router @tanstack/react-table @tanstack/react-form zod
   npm install -D @tanstack/react-query-devtools @tanstack/react-router-devtools @tanstack/router-plugin json-server@0.17.4
   ```
   (json-server 0.17.4 : on s'appuie sur `_page`, `_limit`, `_sort`, `_order` et l'en-tête `X-Total-Count`.)
4. Dans `package.json`, mettez le script :
   ```json
   "api": "json-server db.json --port 3001 --delay 400"
   ```
   Le `--delay` simule un réseau lent : indispensable pour **voir** les états de chargement et les mises à jour optimistes.
5. Lancez `npm run api` (terminal 2) et `npm run dev` (terminal 1). Vérifiez `http://localhost:3001/cards?_page=1&_limit=5` : 5 cartes, et l'en-tête `X-Total-Count: 24` dans l'onglet Réseau.
6. Créez l'arborescence cible (dossiers vides pour l'instant) :
   ```
   src/
   ├─ api/          # fonctions fetch brutes
   ├─ queries/      # queryOptions, clés, mutations
   ├─ routes/       # routes (file-based)
   ├─ components/
   ├─ domain/
   └─ hooks/
   ```

### Vérification

L'application du Module 1 fonctionne toujours. `npm run lint` ne signale rien.



## Étape 1 : Le QueryClient et un premier `useQuery`

### Consignes

1. Dans `main.jsx`, créez **une seule fois**, hors de tout composant, un `QueryClient`, et entourez l'application de `<QueryClientProvider client={queryClient}>`.
2. Ajoutez `<ReactQueryDevtools />` (en développement seulement) et ouvrez-le : repérez la liste des requêtes en cache.
3. Créez `src/api/cards.js` avec `fetchCards()` (comme au Module 1 : `fetch`, test de `response.ok`, `response.json()`).
4. Dans `App`, remplacez l'appel à `useCards()` par :
   ```js
   const { data, status } = useQuery({ queryKey: ["cards"], queryFn: fetchCards });
   ```
   Adaptez le rendu à `status` (`"pending"`, `"error"`, `"success"`). Supprimez le `useEffect` de chargement, le drapeau `ignore` et le state `attempt`.
5. Gardez le reste (recherche, titre de l'onglet, formulaire) fonctionnel : les actions de modification viendront aux étapes 4 et 5, ne les réparez pas encore.

### Vérification

Les 24 cartes s'affichent. Les Devtools montrent une requête `["cards"]` à l'état `fresh` puis `stale`.

## Étape 2 : Comprendre le cache : `staleTime`, `gcTime`, refetch

### Consignes

1. Exposez dans l'interface un petit indicateur : `isFetching` affiche « Actualisation… » en haut de la liste (différent de `isPending`).
2. Ajoutez un bouton « Actualiser » qui appelle `refetch()`.
3. Expérimentez, en notant ce que vous voyez dans le Réseau et les Devtools :
   - réglage par défaut (`staleTime: 0`) : changez d'onglet du navigateur puis revenez ;
   - `staleTime: 30_000` : même manipulation ;
   - `refetchOnWindowFocus: false` ;
   - `retry: 3` (valeur par défaut) puis `retry: false`, avec l'API arrêtée.
4. Fixez au final `staleTime: 30_000` dans les options **par défaut** du `QueryClient` (`defaultOptions.queries`).

### Vérification

Arrêtez l'API : après les tentatives, l'erreur s'affiche avec un bouton « Réessayer » qui appelle `refetch()`. Relancez l'API : les données reviennent.



## Étape 3 : Une vraie couche API et des `queryOptions`

### Consignes

1. Complétez `src/api/cards.js` avec `fetchCard(id)`, `createCard(card)` (POST, sans `id` : c'est **json-server** qui le génère), `patchCard(id, patch)` (PATCH) et `deleteCard(id)` (DELETE). Factorisez la vérification de `response.ok` dans une fonction `request(path, options)`.
2. Créez `src/queries/cards.js` avec une **fabrique de clés** :
   ```js
   export const cardKeys = {
     all: ["cards"],
     lists: () => [...cardKeys.all, "list"],
     list: (filters) => [...cardKeys.lists(), filters],
     detail: (id) => [...cardKeys.all, "detail", id],
   };
   ```
3. Exportez des `queryOptions` réutilisables : `cardsQueryOptions(filters)` et `cardQueryOptions(id)` (clé + `queryFn`). C'est ce qui sera partagé entre composants, loaders et prefetch.
4. Utilisez-les dans `App` : `useQuery(cardsQueryOptions({}))`.

### Vérification

Même comportement qu'à l'étape 2, mais plus aucun littéral `["cards"]` dans les composants.


## Étape 4 : Les mutations (`useMutation`) et l'invalidation

### Consignes

1. Dans `src/queries/cards.js`, écrivez des hooks :
   - `useChangeQuantity()` : `useMutation` dont la `mutationFn` appelle `patchCard(id, { quantity })` ;
   - `useRemoveCard()` : `deleteCard(id)` ;
   - `useAddCard()` : `createCard(card)`.
2. Dans le `onSuccess` de chacune, **invalidez** les listes : `queryClient.invalidateQueries({ queryKey: cardKeys.lists() })` (récupérez le client avec `useQueryClient()`).
3. Branchez les hooks dans `CardGrid` / `QuantityControl` / `AddCardForm` à la place des fonctions locales de `useCards`. Le calcul de la nouvelle quantité (`Math.max(0, quantity + delta)`) se fait côté appelant, avant la mutation.
4. Pendant qu'une mutation est en cours (`isPending`), désactivez le bouton concerné.

### Vérification

Cliquez sur « + » : après ~400 ms (le délai du serveur) la quantité change, le header se met à jour. Rechargez la page : **la modification est conservée** (elle est dans `db.json`). C'est la différence majeure avec le Module 1.



## Étape 5 : Les mises à jour optimistes

Les 400 ms d'attente rendent l'interface molle. On affiche le résultat **avant** la réponse du serveur, en gardant de quoi revenir en arrière.

### Consignes

1. Dans `useChangeQuantity`, ajoutez les trois callbacks du motif classique :
   - `onMutate({ id, quantity })` : `await queryClient.cancelQueries({ queryKey: cardKeys.lists() })`, sauvegardez l'ancien état (`getQueriesData` ou `getQueryData`), modifiez le cache avec `setQueryData` (en **immuable** : `map` + spread), et **renvoyez** l'ancien état ;
   - `onError(error, variables, context)` : restaurez le cache depuis `context` ;
   - `onSettled` : `invalidateQueries` (resynchronisation avec la vérité du serveur).
2. Faites de même pour `useRemoveCard` (la carte disparaît tout de suite).
3. Provoquez une erreur volontaire : mettez temporairement une mauvaise URL dans `patchCard`. Constatez le **rollback**, et affichez un message d'erreur discret (`toast` maison ou `<p role="alert">`) via `onError`.

### Vérification

Le clic sur « + » change l'interface immédiatement ; en cas d'échec, la valeur revient et un message apparaît.



## Étape 6 : Le routeur : pages et navigation

On découpe l'application en pages, avec le routage par fichiers.

### Consignes

1. Ajoutez le plugin dans `vite.config.js`, **avant** le plugin React :
   ```js
   import { tanstackRouter } from "@tanstack/router-plugin/vite";
   // plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react()]
   ```
   (le nom exporté a changé selon les versions : vérifiez dans la doc de votre version.)
2. Créez les fichiers de routes ; le plugin génère `src/routeTree.gen.ts` (ne l'éditez jamais, ajoutez-le éventuellement à `.gitignore` selon la consigne du prof) :
   ```
   src/routes/__root.jsx          # layout : header, résumé, navigation, <Outlet />
   src/routes/index.jsx           # "/"       : collection (grille)
   src/routes/cards.$cardId.jsx   # "/cards/$cardId" : détail d'une carte
   src/routes/favorites.jsx       # "/favorites"
   src/routes/add.jsx             # "/add"    : formulaire d'ajout
   ```
3. Dans `__root.jsx`, utilisez `createRootRouteWithContext()` pour exposer `queryClient` dans le contexte du routeur, rendez `<Outlet />`, et une barre de navigation avec des `<Link to="/" activeProps={{ className: "active" }}>`.
4. Dans `main.jsx`, créez le routeur (`createRouter({ routeTree, context: { queryClient } })`) et rendez `<RouterProvider router={router} />` **à l'intérieur** des providers Query et Favoris.
5. Déplacez le contenu de `App.jsx` dans les routes : grille → `index.jsx`, formulaire → `add.jsx`. Chaque tuile devient un lien vers `/cards/$cardId`. `App.jsx` disparaît ou ne garde que les providers.
6. La route de détail lit son paramètre avec `Route.useParams()` et affiche la carte (via `useQuery(cardQueryOptions(cardId))`), ses notes et le bouton favori.
7. Ajoutez les **Devtools du routeur** en développement.

### Vérification

La navigation ne recharge pas la page. L'URL change, le bouton « précédent » fonctionne, `/cards/9` ouvert directement dans un nouvel onglet affiche Électhor.


---

## Étape 7 : Loaders, préchargement et pages d'erreur

### Consignes

1. Sur la route de détail, ajoutez un **loader** qui précharge les données **avant** l'affichage :
   ```js
   loader: ({ context: { queryClient }, params: { cardId } }) =>
     queryClient.ensureQueryData(cardQueryOptions(cardId))
   ```
   Dans le composant, relisez la donnée avec `useSuspenseQuery(cardQueryOptions(cardId))` : elle est déjà en cache.
2. Faites pareil pour la route `/` avec `cardsQueryOptions`.
3. Configurez `pendingComponent` (squelette de chargement), `errorComponent` (message + bouton « Réessayer » qui appelle `reset`/`router.invalidate()`) et `notFoundComponent`. Pour une carte inexistante (`fetchCard` reçoit un 404), levez `notFound()` dans le loader.
4. Activez le préchargement au survol : `defaultPreload: "intent"` dans `createRouter`. Survolez une tuile puis cliquez : la page de détail s'affiche instantanément.

### Vérification

`/cards/999` affiche une page « Carte introuvable » avec un lien de retour. Le survol d'un lien déclenche une requête visible dans le Réseau avant le clic.

### Questions

- **Q7.1** Pourquoi `ensureQueryData` et pas `fetchQuery` ou `prefetchQuery` dans le loader ? (Cherchez la différence quand la donnée est déjà fraîche en cache.)
- **Q7.2** Quel problème appelle-t-on « *render-then-fetch waterfall* » ? Comment les loaders le réduisent-ils ?
- **Q7.3** Que fait `useSuspenseQuery` de différent de `useQuery` côté `status` / `data` ? Pourquoi `data` n'est-il jamais `undefined` ?
- **Q7.4** Que signifie `preload="intent"` ? Quel coût pour le serveur, et quand le désactiver ?
- **Q7.5** Une erreur de loader et une erreur de `useQuery` : qui l'affiche et où ? Quel composant d'erreur reçoit quoi ?

---

## Étape 8 : L'état dans l'URL : *search params* typés

La recherche et le filtre du Module 1 vivaient dans un `useState` : ils étaient perdus au rechargement et impossibles à partager. On les met dans l'URL.

### Consignes

1. Sur la route `/`, déclarez un `validateSearch` avec Zod :
   ```js
   const searchSchema = z.object({
     q: z.string().catch(""),
     rarity: z.enum([...RARITIES, "toutes"]).catch("toutes"),
     page: z.number().int().min(1).catch(1),
   });
   ```
2. Lisez les paramètres avec `Route.useSearch()` à la place des `useState`. `SearchBar` ne change presque pas : ses callbacks appellent `navigate({ search: (prev) => ({ ...prev, q, page: 1 }) })`.
3. Passez le filtrage **au serveur** : `fetchCards({ q, rarity, page })` construit `?q=…&rarity=…&_page=…&_limit=8` et renvoie `{ items, total }` (lisez `X-Total-Count`). Les paramètres de recherche font partie de la `queryKey` (via `cardKeys.list(filters)`).
4. Ajoutez une pagination « Précédent / Suivant » (liens avec `search={(prev) => ({ ...prev, page: prev.page + 1 })}`). Utilisez `placeholderData: keepPreviousData` pour éviter le clignotement entre les pages.
5. Recherche : **debounce** de 300 ms avant de modifier l'URL (hook `useDebouncedValue` à écrire dans `src/hooks/`).

### Vérification

Copiez l'URL `/?q=ra&rarity=rare&page=2` dans un autre onglet : mêmes cartes, même page. Le bouton « précédent » du navigateur défait un filtre.

=

## Étape 9 : TanStack Table : la vue tableau

### Consignes

1. Créez `src/components/CardsTable.jsx`. Colonnes (via `createColumnHelper()`) : Nom, Extension, Rareté (avec `RarityBadge`), Prix (`formatPrice`), Quantité, Valeur (`price × quantity`, colonne **calculée** avec `accessorFn`), Actions (lien Détail + « Retirer »).
2. Instanciez la table :
   ```js
   const table = useReactTable({
     data, columns,
     getCoreRowModel: getCoreRowModel(),
     getSortedRowModel: getSortedRowModel(),
     getFilteredRowModel: getFilteredRowModel(),
     getPaginationRowModel: getPaginationRowModel(),
   });
   ```
   Rendu avec `flexRender` pour les en-têtes et cellules. `data` et `columns` doivent avoir une **référence stable** (`useMemo` ou constante hors composant).
3. Ajoutez : tri au clic sur l'en-tête (flèches ▲▼), filtre global (champ de recherche), pagination (taille de page 10), visibilité des colonnes (cases à cocher).
4. Sur la route `/`, ajoutez un sélecteur « Grille / Tableau » (stocké dans l'URL : `view=grid|table`).
5. Pour cette étape, le tableau travaille sur **toutes** les cartes (`_limit` grand ou requête dédiée) : tri, filtre et pagination se font **côté client**.

### Vérification

Un clic sur « Prix » trie, un second inverse, un troisième retire le tri. La colonne Valeur est triable. Les 24 cartes se répartissent sur 3 pages de 10.

=

## Étape 10 : Table pilotée par l'URL (mode contrôlé / serveur)

### Consignes

1. Passez la table en **mode manuel** : `manualSorting: true`, `manualPagination: true`, `manualFiltering: true`, et `rowCount` (ou `pageCount`) calculé depuis `X-Total-Count`.
2. Faites **contrôler** l'état par l'URL : `state: { sorting, pagination }` dérivé de `Route.useSearch()`, et `onSortingChange` / `onPaginationChange` qui appellent `navigate`. Ajoutez `sort` (ex. `price.desc`) et `pageSize` à `validateSearch`.
3. La `queryFn` traduit : `sorting` → `_sort=price&_order=desc`, pagination → `_page` / `_limit`, recherche → `q`.
4. Gardez `placeholderData: keepPreviousData` et affichez un léger voile pendant `isFetching`.

### Vérification

Le tri et la pagination passent par le serveur (visibles dans le Réseau) et survivent au rechargement. Un lien copié reproduit exactement la même vue.



## Étape 11 : TanStack Form : le formulaire d'ajout

### Consignes

1. Réécrivez `AddCardForm` (route `/add`) avec `useForm` :
   ```js
   const form = useForm({
     defaultValues: { name: "", set: SETS[0], rarity: "commune", price: "", quantity: "1" },
     onSubmit: async ({ value }) => { /* convertir puis mutation */ },
   });
   ```
   Chaque champ s'écrit avec `<form.Field name="name">{(field) => …}</form.Field>` (valeur : `field.state.value`, changement : `field.handleChange`, blur : `field.handleBlur`).
2. **Validation** avec le schéma Zod `newCardSchema` (nom ≥ 2 caractères sans les espaces, prix numérique ≥ 0, quantité entière ≥ 1) via `validators: { onChange: newCardSchema }` au niveau du formulaire, **ou** par champ. Affichez les erreurs sous chaque champ, seulement après qu'il a été touché (`field.state.meta.isTouched`).
3. **Validation asynchrone** sur le nom : `onChangeAsync` (avec `onChangeAsyncDebounceMs: 400`) interroge `GET /cards?name=…` et refuse un nom déjà présent dans la collection.
4. Le bouton « Ajouter la carte » est piloté par `form.Subscribe` (`canSubmit`, `isSubmitting`) et affiche « Ajout… » pendant la mutation.
5. Le `onSubmit` appelle `useAddCard().mutateAsync`, puis `form.reset()` et **redirige** vers `/` avec `useNavigate()` (ou reste sur la page avec un message de succès, au choix).
6. Remettez le curseur dans le champ Nom après un ajout (ref, comme au Module 1).

### Vérification

Champs invalides : messages sous chaque champ, soumission bloquée. Le nom « Pikachu » est refusé après une courte pause. « Évoli », prix « 3,5 » : la carte est créée côté serveur (id généré par json-server), visible dans la liste.


## Étape 12 : Favoris et notes persistés sur le serveur

On quitte le Context et le state local de la note : ces données appartiennent au **serveur**.

### Consignes

1. **Favoris** : la collection `favorites` de json-server contient des objets `{ id, cardId }`. Écrivez `favoritesQueryOptions()`, `useToggleFavorite()` (POST si absent, DELETE si présent) avec **mise à jour optimiste**. Supprimez `FavoritesProvider` / `useFavorites` : `FavoriteButton` et `FavoritesCount` lisent le cache Query. La route `/favorites` affiche les cartes favorites.
2. **Dérivation** : `favoriteIds` est calculé (un `Set`) depuis les données, jamais stocké. Les cartes de `/favorites` s'obtiennent en croisant `cards` et `favorites` (pas de requête supplémentaire par carte).
3. **Notes** : sur la page de détail, la note d'une carte est une query dépendante `["notes", cardId]` (`GET /notes?cardId=…`). La `textarea` est contrôlée, **sauvegardée automatiquement** 800 ms après la dernière frappe (`useDebouncedValue` + `useMutation`), avec un indicateur « Enregistrement… / Enregistré ».
4. Le reset par `key` du Module 1 n'est plus nécessaire sur la page de détail : expliquez pourquoi en Q12.4.

### Vérification

Marquez deux favoris, rechargez : ils sont conservés. Écrivez une note, attendez « Enregistré », rechargez : la note est là. Ouvrez le détail d'une autre carte : sa note à elle.


## Étape 13 : Pour aller plus loin (bonus, sans corrigé)

Choisissez **au moins deux** parmi :

1. **Scroll infini** : `useInfiniteQuery` + `getNextPageParam` et un bouton « Charger plus » (puis `IntersectionObserver`).
2. **TanStack Virtual** : virtualisez le tableau pour 10 000 cartes (générez-les avec un script).
3. **Mises à jour en arrière-plan** : `refetchInterval` de 10 s avec un indicateur visible quand les données changent.
4. **Gestion d'erreur globale** : `QueryCache` / `MutationCache` avec `onError` pour un toast unique, et `throwOnError` + Error Boundary pour les erreurs de rendu.
5. **Persistance du cache** : `persistQueryClient` (localStorage) pour une ouverture instantanée hors ligne.
6. **Tests** : `QueryClientProvider` dédié par test (`retry: false`), faux serveur avec MSW, test de la mise à jour optimiste et du rollback (Vitest + Testing Library).
7. **Prefetch + transitions** : préchargement du détail au survol (déjà `intent`), plus `useDeferredValue` sur la recherche.
8. **Accessibilité** : navigation clavier dans le tableau, `aria-sort` sur les en-têtes, annonce `aria-live` des résultats.
=
## Étape 14 : Bilan et architecture

### Consignes

1. Dessinez (ou décrivez) l'architecture finale : **qui possède quel état** (Query, URL, formulaire, état local, serveur) et **qui l'affiche**.
2. Mettez à jour le `README.md` du dépôt : prérequis, commandes (`npm run dev`, `npm run api`, `npm run lint`), arborescence, choix techniques, ce que vous feriez avec plus de temps.
3. Vérifiez : `npm run lint` propre, aucun `console.log` oublié, `routeTree.gen` cohérent, application utilisable à froid (`npm install`, `npm run api`, `npm run dev`).


