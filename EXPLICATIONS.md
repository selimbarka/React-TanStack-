# TP Module 2 : explications pas à pas

Ce document explique **tout ce qui a été fait** pour le TP « Ma collection TCG, version TanStack », étape par étape : ce que demande l'énoncé, le code écrit, **pourquoi** il est écrit ainsi, et ce qu'il faut observer pour vérifier. Les réponses aux questions (Q7.1 à Q7.5, Q12.4) sont à la fin, ainsi que l'architecture finale (étape 14).

---

## 0. Lancer le projet

```bash
npm install
npm run api      # terminal 2 : json-server sur http://localhost:3001 (délai 400 ms)
npm run dev      # terminal 1 : Vite sur http://localhost:5173
npm run lint     # oxlint : doit être silencieux
npm run api:reset  # (ajouté) remet db.json dans son état initial (24 cartes, aucun favori, aucune note)
```

> json-server **écrit dans `db.json`** à chaque modification (quantité, ajout, favori, note). `db.seed.json` est une copie de l'état initial, et `npm run api:reset` la recopie (à lancer API arrêtée).

### Versions installées (à noter dans le rendu)

| Paquet | Version |
|---|---|
| react / react-dom | 19.3.1 |
| @tanstack/react-query (+ devtools) | 5.105.0 |
| @tanstack/react-router | 1.170.46 |
| @tanstack/react-router-devtools | 1.167.2 |
| @tanstack/router-plugin | 1.168.48 |
| @tanstack/react-table | **8.21.3** (la v9 existe, mais le TP demande la v8 : installée avec `@8`) |
| @tanstack/react-form | 1.33.5 |
| zod | 4.6.7 |
| json-server | 0.17.4 |
| vite | 8.3.5 |
| oxlint | 1.89.0 |

---

## L'idée générale du Module 2 (à comprendre avant tout)

Au Module 1, **tout** l'état vivait dans des `useState` : la liste des cartes, le filtre, la carte sélectionnée, les favoris (Context), la note. Problèmes :

- les modifications étaient perdues au rechargement (rien n'était renvoyé au serveur) ;
- le filtre n'était pas dans l'URL (impossible de partager un lien, le bouton « précédent » ne marchait pas) ;
- on recodait à la main le chargement, les erreurs, le « réessayer », le drapeau `ignore`…

Le Module 2 range chaque état **chez son vrai propriétaire** :

| Type d'état | Propriétaire | Outil |
|---|---|---|
| Données du serveur (cartes, favoris, notes) | le **serveur**, avec une copie en **cache** côté client | TanStack Query |
| Ce qu'on regarde (page, filtre, tri, vue, carte ouverte) | l'**URL** | TanStack Router |
| Ce qu'on est en train de saisir | le **formulaire** | TanStack Form + Zod |
| Préférences d'affichage éphémères | état **local** | `useState` |

Tout le TP consiste à faire ce rangement.

---

## Étape 0 : Mise en place

**Ce qui a été fait**

1. **Dépendances** installées :
   ```bash
   npm install @tanstack/react-query@5 @tanstack/react-router@1 @tanstack/react-table@8 @tanstack/react-form@1 zod@4
   npm install -D @tanstack/react-query-devtools@5 @tanstack/react-router-devtools@1 @tanstack/router-plugin@1 json-server@0.17.4
   ```
   Les versions majeures sont **épinglées** (`@8`, `@5`…) : `npm install @tanstack/react-table` sans précision aurait installé la v9, dont l'API diffère de l'énoncé.
2. **`db.json`** : le fichier `fournis/db.json` n'était pas dans le dossier. J'ai donc écrit un `db.json` de **24 cartes** : les 12 premières sont identiques à celles du Module 1 (donc `/cards/9` = Électhor, « Pikachu » existe), plus 12 nouvelles (sans « Évoli », qu'on ajoute à l'étape 11). Il contient aussi les collections vides `"favorites": []` et `"notes": []`. Si votre prof fournit son `db.json`, remplacez simplement le fichier.
3. **Script** dans `package.json` : `"api": "json-server db.json --port 3001 --delay 400"`. Le `--delay 400` simule un réseau lent : sans lui, on ne verrait **jamais** les états de chargement ni l'intérêt des mises à jour optimistes.
4. **Arborescence** créée : `src/api`, `src/queries`, `src/routes`, `src/components`, `src/domain`, `src/hooks`.

**Vérification** : `http://localhost:3001/cards?_page=1&_limit=5` renvoie 5 cartes et l'en-tête `X-Total-Count: 24` (testé).

> L'étape « 1. » de l'énoncé (créer une branche Git) n'apparaît pas dans le fichier, et le dossier **n'est pas un dépôt Git**. Pour l'appliquer : `git init && git add -A && git commit -m "Module 1"` puis `git switch -c module-2`.

---

## Étape 1 : Le `QueryClient` et un premier `useQuery`

**Le concept.** TanStack Query est un **cache de données serveur**. On ne stocke plus les cartes dans un `useState` : on déclare « j'ai besoin des données identifiées par la clé `["cards"]`, et voici comment les obtenir (`queryFn`) ». Query s'occupe du reste : chargement, erreurs, nouvelles tentatives, partage entre composants, rafraîchissement.

**Le code** (`src/main.jsx`) :

```jsx
// Créé une seule fois, hors de tout composant : c'est LE cache de l'application.
const queryClient = new QueryClient({ ... });

<QueryClientProvider client={queryClient}>
  ...
  {import.meta.env.DEV && <ReactQueryDevtools buttonPosition="bottom-right" />}
</QueryClientProvider>
```

**Pourquoi hors de tout composant ?** Si on écrivait `new QueryClient()` dans un composant, chaque re-rendu créerait un **nouveau cache vide** : toutes les données seraient perdues et rechargées en boucle.

Dans l'ancien `App`, `useCards()` (un `useEffect` + `useState` + drapeau `ignore` + compteur `attempt`) a été remplacé par :

```js
const { data, status } = useQuery({ queryKey: ["cards"], queryFn: fetchCards });
// status : "pending" | "error" | "success"
```

Tout ce que faisait `useCards` à la main est fourni par Query :

| Module 1 (à la main) | Module 2 (TanStack Query) |
|---|---|
| `useState({ status: "loading" })` | `status === "pending"` |
| drapeau `ignore` contre les réponses en retard | géré par Query (une seule requête par clé) |
| state `attempt` + `retry()` | `refetch()` |
| aucun cache | cache partagé par tous les composants |

C'est pour ça que `src/hooks/useCards.js` a été **supprimé** (ainsi que `App.jsx` à l'étape 6).

**À observer** : dans les Devtools (bouton en bas à droite), la requête `["cards"]` est verte (**fresh**) puis passe en jaune (**stale**).

---

## Étape 2 : Comprendre le cache (`staleTime`, `gcTime`, refetch)

**Les notions clés**

- **`staleTime`** (défaut **0**) : durée pendant laquelle une donnée est considérée **fraîche**. Une donnée fraîche n'est jamais redemandée automatiquement. Une donnée **périmée (stale)** est réaffichée immédiatement depuis le cache, **puis** redemandée en arrière-plan à certains moments : montage d'un composant, retour sur l'onglet (`refetchOnWindowFocus`), reconnexion.
- **`gcTime`** (défaut **5 min**) : durée pendant laquelle une donnée **plus utilisée par aucun composant** reste en mémoire avant d'être supprimée (garbage collection).
- **`isPending`** = « je n'ai **aucune** donnée » (premier chargement). **`isFetching`** = « une requête est en cours », y compris un rafraîchissement en arrière-plan alors que des données sont affichées. D'où deux indicateurs différents.
- **`retry`** (défaut **3**) : en cas d'échec, Query réessaie 3 fois avec un délai croissant (1 s, 2 s, 4 s) avant de passer en erreur.

**Ce qui a été fait** (`src/routes/index.jsx`) :

```jsx
<button type="button" onClick={() => refetch()} disabled={isFetching}>Actualiser</button>
{isFetching && <span className="hint">Actualisation…</span>}
```

et, si la requête échoue sans données à afficher, un message avec « Réessayer » qui appelle `refetch()`. (Dans la version finale, ce cas est confié à l'`errorComponent` de la route grâce à `throwOnError`, voir le bonus 4 ; le message « La dernière actualisation a échoué » + « Réessayer » → `refetch()` reste pour un échec **avec** des données déjà affichées.)

**Les expériences demandées, et ce qu'on observe** :

| Réglage | Changer d'onglet puis revenir |
|---|---|
| `staleTime: 0` (défaut) | une requête part à **chaque** retour (Réseau), « Actualisation… » s'affiche |
| `staleTime: 30_000` | aucune requête si on revient avant 30 s ; après 30 s, une requête |
| `refetchOnWindowFocus: false` | jamais de requête au retour sur l'onglet |
| `retry: 3`, API arrêtée | ~7 s de tentatives (visibles dans le Réseau) puis l'erreur |
| `retry: false`, API arrêtée | l'erreur s'affiche immédiatement |

**Réglage final** (`main.jsx`) :

```js
defaultOptions: {
  queries: {
    staleTime: 30_000,
    retry: shouldRetry,
  },
},
```

`shouldRetry` est une petite amélioration : on garde 3 tentatives pour les erreurs réseau, mais **pas de nouvelle tentative sur une erreur 4xx**. Un 404 (carte inexistante) ne changera pas en réessayant, et sans cela `/cards/999` mettrait 7 s à afficher « introuvable ».

```js
function shouldRetry(failureCount, error) {
  if (error instanceof HttpError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 3;
}
```

**Vérification (testée)** : API arrêtée → après les tentatives, l'erreur s'affiche avec « Réessayer » ; API relancée → « Réessayer » ramène les données.

---

## Étape 3 : Une vraie couche API et des `queryOptions`

### 3.1 La couche API (`src/api/`)

Toute la communication avec le serveur passe par **une seule** fonction, `request` (`src/api/client.js`) :

```js
export async function request(path, { body, ...options } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    throw new HttpError(response.status);
  }
  return response;
}
```

- Elle **factorise** le test `response.ok` demandé par l'énoncé.
- Elle lève une `HttpError` qui **garde le code HTTP** (`error.status`). C'est ce qui permet, plus tard, de distinguer un 404 (→ « Carte introuvable ») d'une panne réseau.
- Elle renvoie la `Response` (et non directement le JSON) parce que `fetchCards` a besoin de lire l'en-tête `X-Total-Count`.
- Je l'ai placée dans `client.js` plutôt que dans `cards.js` parce qu'elle sert aussi à `favorites.js` et `notes.js`.

Les fonctions demandées (`src/api/cards.js`) : `fetchCards`, `fetchCard(id)`, `createCard(card)` (POST **sans id** : json-server le génère), `patchCard(id, patch)`, `deleteCard(id)`, plus `findCardsByName` pour la validation asynchrone de l'étape 11.

### 3.2 La fabrique de clés (`src/queries/cards.js`)

```js
export const cardKeys = {
  all: ["cards"],
  lists: () => [...cardKeys.all, "list"],
  list: (filters) => [...cardKeys.lists(), filters],
  detail: (id) => [...cardKeys.all, "detail", id],
};
```

**Pourquoi une hiérarchie ?** Les clés de Query se comparent **par préfixe**. Avec cette structure :

```
["cards"]                                   ← cardKeys.all       : TOUT ce qui concerne les cartes
["cards", "list"]                           ← cardKeys.lists()   : toutes les listes
["cards", "list", { page: 2, q: "ra" … }]   ← cardKeys.list(f)   : UNE liste précise
["cards", "detail", "9"]                    ← cardKeys.detail(9) : UNE carte
```

`invalidateQueries({ queryKey: cardKeys.lists() })` invalide **toutes** les pages et tous les filtres d'un coup, sans toucher aux détails. Et on n'écrit jamais une clé « à la main » dans un composant : impossible de se tromper d'orthographe.

### 3.3 Les `queryOptions`

```js
export function cardsQueryOptions(filters) {
  return queryOptions({
    queryKey: cardKeys.list(filters),
    queryFn: () => fetchCards(filters),
  });
}

export function cardQueryOptions(id) {
  return queryOptions({
    queryKey: cardKeys.detail(id),
    queryFn: () => fetchCard(id),
  });
}
```

Un `queryOptions` réunit **la clé et la fonction** au même endroit. Le même objet sert dans un composant (`useQuery(cardQueryOptions(id))`), dans un loader (`ensureQueryData(cardQueryOptions(id))`) et pour un prefetch. Clé et fonction ne peuvent donc jamais diverger.

J'ai ajouté `allCardsQueryOptions()` (= `cardsQueryOptions({})`) : toute la collection, sans pagination, pour le résumé de l'en-tête et la page Favoris.

---

## Étape 4 : Les mutations (`useMutation`) et l'invalidation

**Le concept.** Une *query* **lit**, une *mutation* **écrit** (POST, PATCH, DELETE). Après une écriture, le cache est faux : on **invalide** les requêtes concernées, et Query les recharge automatiquement si elles sont affichées.

Les trois hooks (`src/queries/cards.js`) : `useChangeQuantity()`, `useRemoveCard()` et `useAddCard()`. Version « étape 4 » (avant l'optimisme) :

```js
export function useChangeQuantity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, quantity }) => patchCard(id, { quantity }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cardKeys.lists() }),
  });
}
```

**Branchement.** Chaque bouton « + / − » doit pouvoir être désactivé **individuellement** pendant sa mutation (`isPending`). C'est pourquoi c'est `QuantityControl` qui appelle le hook : chaque carte a sa propre instance de mutation, donc son propre `isPending`.

```jsx
export function QuantityControl({ card }) {
  const { mutate, isPending } = useChangeQuantity();

  function change(delta) {
    // Le calcul est fait par l'appelant, AVANT la mutation (consigne 4.3).
    mutate({ id: card.id, quantity: Math.max(0, card.quantity + delta) });
  }
  ...
  <button ... disabled={isPending}>+</button>
```

Même principe pour `RemoveCardButton` (nouveau composant) et pour le formulaire.

**Vérification (testée)** : « + » → la quantité change, le résumé de l'en-tête aussi ; **rechargez : la modification est conservée**, car elle est dans `db.json`. C'est la grande différence avec le Module 1.

---

## Étape 5 : Les mises à jour optimistes

**Le problème.** Avec 400 ms de délai, chaque clic semble « mou ». **L'idée** : modifier le cache **tout de suite**, comme si le serveur avait déjà dit oui, en gardant une sauvegarde pour revenir en arrière s'il dit non.

**Le motif en 3 temps** (`useChangeQuantity`, version finale) :

```js
onMutate: async ({ id, quantity }) => {
  // 1. Annuler les requêtes en cours : leur réponse (ancienne) écraserait notre modification.
  await queryClient.cancelQueries({ queryKey: cardKeys.all });
  // 2. Sauvegarder l'état actuel de TOUTES les entrées concernées (listes + détail).
  const previous = queryClient.getQueriesData({ queryKey: cardKeys.all });
  // 3. Modifier le cache, en IMMUABLE (map + spread, jamais de card.quantity = …).
  updateCachedCard(queryClient, id, (card) => ({ ...card, quantity }));
  // 4. Renvoyer la sauvegarde : elle sera passée à onError sous le nom « context ».
  return { previous };
},
onError: (_error, _variables, context) => restoreSnapshot(queryClient, context?.previous),
onSettled: () => invalidateWhenIdle(queryClient, cardKeys.all),
```

- **`getQueriesData`** (au pluriel) : la carte peut apparaître dans plusieurs entrées du cache (page 1, liste « toutes les cartes » de l'en-tête, détail). On les sauvegarde et on les modifie **toutes** (`setQueriesData`).
- **Immuable** : Query compare les références pour savoir quoi re-rendre. Muter l'objet en place ne déclencherait aucun rendu et corromprait la sauvegarde.
- **`onError`** : on remet la sauvegarde (*rollback*).
- **`onSettled`** (succès **ou** échec) : on invalide pour se resynchroniser avec la vérité du serveur.

**Un détail en plus : `invalidateWhenIdle`** (`src/queries/optimistic.js`). Si l'on clique vite sur « + » de deux cartes différentes, la 1ʳᵉ mutation se termine et invalide, ce qui lance un refetch. Si ce refetch revient avant la 2ᵉ mutation, il **écrase** la valeur optimiste de la 2ᵉ carte, qui « clignote » en arrière. On n'invalide donc qu'à la fin de la **dernière** mutation en cours :

```js
if (queryClient.isMutating({ mutationKey: key }) === 1) {
  queryClient.invalidateQueries({ queryKey: key });
}
```

**`useRemoveCard`** suit le même motif : la carte est retirée de toutes les listes (avec `total - 1`) dans `onMutate`, donc elle **disparaît immédiatement**.

**Le message d'erreur (consigne 5.3).** Le rollback est fait dans le `onError` du hook. Le **message** est affiché par un `onError` **global**, celui du `MutationCache` (voir bonus 4) : chaque hook décrit son message dans `meta`.

```js
meta: { errorMessage: "La quantité n'a pas pu être modifiée." },
```

**Tester le rollback** : mettez temporairement une mauvaise URL dans `patchCard` (ex. `/cardsXX/${id}`). Le clic sur « + » change l'interface, puis la valeur **revient** et un toast rouge apparaît. Remettez la bonne URL ensuite. (Testé automatiquement en simulant une réponse 500 : `3 → 4 → 3` et toast affiché.)

---

## Étape 6 : Le routeur, pages et navigation

**Le concept.** Au lieu d'une seule page qui affiche/masque des panneaux, on a de vraies **pages** avec leur URL. TanStack Router en **routage par fichiers** : chaque fichier de `src/routes/` est une route, et le plugin Vite génère l'arbre des routes `src/routeTree.gen.ts` (à ne **jamais** modifier à la main).

**`vite.config.js`** : le plugin du routeur passe **avant** celui de React, car il doit transformer les fichiers de routes avant que React ne compile le JSX.

```js
plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react()],
```

(Dans la version installée, l'export s'appelle bien `tanstackRouter` ; l'ancien `TanStackRouterVite` existe encore comme alias.)

`autoCodeSplitting` : le code de chaque page est mis dans un fichier JS séparé, téléchargé seulement quand on visite la page (visible dans le `vite build` : `cards._cardId-….js`, `add-….js`…).

**Les fichiers de routes**

```
src/routes/__root.jsx          layout : en-tête, résumé, navigation, <Outlet />
src/routes/index.jsx           "/"               collection (grille ou tableau)
src/routes/cards.$cardId.jsx   "/cards/$cardId"  détail d'une carte ($cardId = paramètre)
src/routes/favorites.jsx       "/favorites"
src/routes/add.jsx             "/add"            formulaire d'ajout
```

Le `.` dans `cards.$cardId.jsx` signifie `/` dans l'URL, et le `$` marque un **paramètre**.

**`__root.jsx`** : la route racine enveloppe toutes les autres. Ce qui est commun (en-tête, navigation, toasts) y est rendu, et `<Outlet />` est l'emplacement où s'affiche la page courante.

```jsx
export const Route = createRootRouteWithContext()({
  component: RootLayout,
  notFoundComponent: () => <NotFound>Cette adresse ne correspond à aucune page.</NotFound>,
});
```

`createRootRouteWithContext()` déclare que le routeur reçoit un **contexte** (ici `{ queryClient }`) transmis à tous les loaders. C'est ainsi qu'un loader accède au cache sans import global.

Les liens de navigation :

```jsx
<Link to="/" activeOptions={{ exact: true, includeSearch: false }} activeProps={activeProps}>Collection</Link>
<Link to="/favorites" activeProps={activeProps}>Favoris</Link>
```

`activeProps={{ className: "active" }}` ajoute la classe quand on est sur la page. Pour `/`, `exact: true` est nécessaire : sinon `/` serait « actif » sur toutes les pages, puisque toutes commencent par `/`.

**`main.jsx`** : création du routeur, puis `<RouterProvider>` **à l'intérieur** de `QueryClientProvider` (les pages utilisent `useQuery`, il leur faut le provider au-dessus d'elles).

```jsx
const router = createRouter({ routeTree, context: { queryClient }, ... });

<QueryClientProvider client={queryClient}>
  <RouterProvider router={router} />
</QueryClientProvider>
```

**Contenu de `App.jsx` déplacé** : la grille va dans `index.jsx`, le formulaire dans `add.jsx`, et le résumé + titre de l'onglet dans `__root.jsx`. `App.jsx` est **supprimé**. Chaque tuile devient un lien : le **nom** de la carte est un `<Link to="/cards/$cardId" params={{ cardId: card.id }}>`. Seul le nom est un lien, pas toute la tuile, car une tuile contient des boutons, et un bouton dans un lien est du HTML invalide.

**Page de détail** : `Route.useParams()` donne `{ cardId }`, et la carte est lue avec `cardQueryOptions(cardId)`. On y trouve aussi la quantité, le favori, « Retirer » et les notes.

**Devtools du routeur** : `<TanStackRouterDevtools />` dans le layout racine (en bas à gauche), seulement en développement (`import.meta.env.DEV`).

**Vérification (testée)** : la navigation ne recharge pas la page, « précédent » fonctionne, `/cards/9` ouvert directement affiche **Électhor**.

---

## Étape 7 : Loaders, préchargement et pages d'erreur

**Le concept.** Un **loader** est une fonction exécutée par le routeur **avant** d'afficher une page, dès que la navigation commence (et même au survol du lien, voir 7.4). Il remplit le cache ; le composant n'a plus qu'à lire.

**Route de détail** (`cards.$cardId.jsx`) :

```js
loader: async ({ context: { queryClient }, params: { cardId } }) => {
  // La note part en parallèle (sans l'attendre) : pas de cascade carte → note.
  queryClient.prefetchQuery(noteQueryOptions(cardId));
  try {
    await queryClient.ensureQueryData(cardQueryOptions(cardId));
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      throw notFound();   // → notFoundComponent « Carte introuvable »
    }
    throw error;          // → errorComponent
  }
},
pendingComponent: DetailSkeleton,
errorComponent: RouteError,
notFoundComponent: () => <NotFound title="Carte introuvable">…</NotFound>,
```

Dans le composant, la donnée est relue avec **`useSuspenseQuery`** : elle est déjà en cache, donc `card` n'est **jamais** `undefined` (voir Q7.3).

```js
const { data: card } = useSuspenseQuery(cardQueryOptions(cardId));
```

**Route `/`** : même principe, avec une subtilité expliquée à l'étape 8.

**Les trois composants spéciaux**

- `pendingComponent` : squelette gris animé (`src/components/Skeletons.jsx`). Le routeur l'affiche si le loader dure plus de `defaultPendingMs`, que j'ai réglé à **200 ms** au lieu de 1 s par défaut, sinon on ne le verrait jamais avec un délai de 400 ms.
- `errorComponent` (`src/components/RouteError.jsx`) : message + « Réessayer ».
  ```js
  const router = useRouter();
  const queryErrorResetBoundary = useQueryErrorResetBoundary();
  useEffect(() => { queryErrorResetBoundary.reset(); }, [queryErrorResetBoundary]);
  ...
  <button onClick={() => router.invalidate()}>Réessayer</button>
  ```
  `router.invalidate()` relance les loaders et réinitialise la zone d'erreur du routeur. `queryErrorResetBoundary.reset()` dit à Query que les `useSuspenseQuery` en erreur ont le droit de refaire leur requête. Sans cela, ils relanceraient immédiatement la même erreur.
- `notFoundComponent` : « Carte introuvable » avec un lien de retour. Il est déclenché par `throw notFound()` dans le loader. La racine en a aussi un pour les URL inconnues (`/nimporte-quoi` → « Page introuvable »).

**Préchargement au survol** (`main.jsx`) :

```js
defaultPreload: "intent",
defaultPreloadStaleTime: 0,
```

`defaultPreloadStaleTime: 0` : le routeur a son propre petit cache de loaders. On lui dit de **toujours** rappeler le loader : c'est TanStack Query (avec son `staleTime`) qui décide s'il faut vraiment refaire une requête. Un seul cache décide, pas deux.

**Vérification (testée)** : `/cards/999` → « Carte introuvable » + lien de retour. Survol du nom d'une carte → requêtes `/cards/2` et `/notes?cardId=2` visibles dans le Réseau **avant** le clic ; le clic affiche ensuite la page en ~100 ms.

---

## Étape 8 : L'état dans l'URL, *search params* typés

**Le concept.** La recherche, la rareté et la page **décrivent ce qu'on regarde** : leur place est dans l'URL. On gagne le partage de lien, le rechargement sans perte et le bouton « précédent » qui défait un filtre.

**8.1 Validation avec Zod** (`index.jsx`) :

```js
const searchSchema = z.object({
  q: z.string().catch(""),
  rarity: z.enum([...RARITIES, "toutes"]).catch("toutes"),
  page: z.number().int().min(1).catch(1),
  view: z.enum(["grid", "table"]).catch("grid"),                       // étape 9
  sort: z.string().regex(SORT_PATTERN).optional().catch(undefined),     // étape 10
  pageSize: z.number().int().min(1).max(50).optional().catch(undefined), // étape 10
});

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  search: { middlewares: [stripSearchParams(defaultSearch)] },
  ...
```

L'URL est une **entrée utilisateur** : n'importe qui peut taper `?page=-3&rarity=licorne`. `.catch(valeur)` remplace toute valeur absente ou invalide par une valeur par défaut, donc **la page ne plante jamais** à cause de l'URL. (Le routeur convertit déjà `?page=2` en nombre `2`, d'où `z.number()`.)

`stripSearchParams(defaultSearch)` (en plus de l'énoncé) retire de l'URL les paramètres qui valent leur valeur par défaut : `/?q=&rarity=toutes&page=1` devient simplement `/`.

**8.2 Lecture et écriture.** On lit avec `Route.useSearch()`, on écrit avec `navigate` :

```js
const search = Route.useSearch();
const navigate = Route.useNavigate();

function updateSearch(patch) {
  navigate({ search: (previous) => ({ ...previous, ...patch }) });
}
...
<SearchBar
  query={search.q}
  onQueryChange={(q) => updateSearch({ q, page: 1 })}
  rarity={search.rarity}
  onRarityChange={(rarity) => updateSearch({ rarity, page: 1 })}
/>
```

`page: 1` : quand le filtre change, on revient à la première page, sinon on pourrait être « page 3 » d'un résultat qui n'en a qu'une.

**8.3 Filtrage côté serveur.** `fetchCards` traduit les filtres en paramètres json-server :

```js
export async function fetchCards({ q, rarity, page, limit, sort } = {}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (rarity && rarity !== "toutes") params.set("rarity", rarity);
  if (sort) { const [field, order] = sort.split("."); params.set("_sort", field); params.set("_order", order); }
  if (page) { params.set("_page", String(page)); params.set("_limit", String(limit)); }
  const response = await request(`/cards?${params}`);
  const items = await response.json();
  const total = Number(response.headers.get("X-Total-Count") ?? items.length);
  return { items, total };
}
```

- `total` vient de `X-Total-Count` : sans lui, on ne saurait pas combien il y a de pages.
- Les filtres font partie de la **clé** (`cardKeys.list(filters)`) : chaque combinaison filtre/page a sa propre entrée de cache. Revenir à la page 1 est donc instantané si elle est encore en cache.
- ⚠️ Le paramètre `q` de json-server cherche dans **tous** les champs, y compris `rarity`. C'est pour ça que `q=ra` trouve toutes les cartes « rare » et « ultra-rare ».

Les filtres sont calculés par une seule fonction, utilisée à la fois par le loader et par le composant :

```js
function toCardFilters({ q, rarity, page, view, sort, pageSize }) {
  const limit = pageSize ?? (view === "table" ? TABLE_PAGE_SIZE : GRID_PAGE_SIZE);
  return { q, rarity, page, limit, sort };
}
loaderDeps: ({ search }) => toCardFilters(search),
```

`loaderDeps` déclare **de quoi dépend le loader** : il est relancé quand ces valeurs changent, et le composant les relit avec `Route.useLoaderDeps()`.

**8.4 Pagination et `keepPreviousData`**

```jsx
<Link from={Route.fullPath} search={(previous) => ({ ...previous, page: previous.page + 1 })}
      disabled={search.page >= pageCount}>Suivant →</Link>
```

Ce sont des **liens**, pas des boutons : on peut les ouvrir dans un nouvel onglet, et ils sont préchargés au survol.

```js
const { data, status, error, isFetching, refetch } = useQuery({
  ...cardsQueryOptions(filters),
  placeholderData: keepPreviousData,
});
```

Sans `keepPreviousData`, passer à la page 2 donne une **nouvelle clé** sans données : la grille disparaît, le squelette s'affiche, puis la page 2. C'est le « clignotement ». Avec `keepPreviousData`, Query **garde la page 1 affichée** (sous un voile, voir 10.4) jusqu'à l'arrivée de la page 2.

**La subtilité du loader de `/`.** Le loader attend les données **à l'arrivée sur la page**, mais **pas** quand on change seulement un filtre en restant sur la page :

```js
loader: async ({ context: { queryClient }, deps, cause }) => {
  if (cause === "stay") {
    // Filtre, tri ou page changé alors qu'on est déjà sur la page : on n'attend pas.
    queryClient.prefetchQuery(cardsQueryOptions(deps));
    return;
  }
  // Arrivée sur la page (ou préchargement au survol) : données prêtes avant l'affichage.
  await queryClient.ensureQueryData(cardsQueryOptions(deps));
},
```

Pourquoi ? Si le loader attendait à chaque changement de filtre, l'URL ne changerait qu'**après** 400 ms : la saisie paraîtrait bloquée et `keepPreviousData` ne servirait à rien. Avec `cause === "stay"` (le routeur indique `"enter"` à l'arrivée, `"stay"` quand on reste sur la même route, `"preload"` au survol), on obtient le meilleur des deux : rien à charger à l'arrivée, et des changements de filtre instantanés avec les anciennes données sous un voile.

**8.5 Debounce de la recherche.** Le hook demandé (`src/hooks/useDebouncedValue.js`) :

```js
export function useDebouncedValue(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout); // nouvelle frappe → on annule le minuteur précédent
  }, [value, delay]);
  return debounced;
}
```

Dans `SearchBar`, le champ a **sa propre valeur** pendant la frappe (`text`), et on ne publie vers l'URL qu'après 300 ms sans frappe. Sinon, taper « dracaufeu » créerait 9 entrées d'historique et 9 requêtes.

```js
const [text, setText] = useState(query);
const debouncedText = useDebouncedValue(text, SEARCH_DEBOUNCE_MS);

// L'URL a changé sans passer par la frappe (bouton « précédent », lien partagé…) :
// on aligne le champ dessus, pendant le rendu (pas d'effet nécessaire).
const [previousQuery, setPreviousQuery] = useState(query);
if (query !== previousQuery) {
  setPreviousQuery(query);
  setText(query);
}

const publish = useEffectEvent((value) => {
  if (value !== query) onQueryChange(value);
});
useEffect(() => {
  publish(debouncedText);
}, [debouncedText]);
```

Le piège évité ici : si l'effet dépendait aussi de `query`, appuyer sur « précédent » (URL `q=dra` → `q=`) relancerait l'effet alors que `debouncedText` vaut encore `"dra"`, ce qui **renverrait** `dra` dans l'URL et casserait le bouton « précédent ». `useEffectEvent` (React 19.2+) lit la **dernière** valeur de `query` sans en faire une dépendance de l'effet : seul un changement du texte temporisé publie.

**Vérification (testée)** : `/?q=ra&rarity=rare&page=2` dans un nouvel onglet → Insécateur, Kabutops, Lokhlass, avec les champs remplis ; taper « dra » → l'URL ne change qu'après la pause ; « précédent » → filtre défait et champ vidé.

---

## Étape 9 : TanStack Table, la vue tableau (côté client)

**Le concept.** TanStack Table est une bibliothèque **headless** : elle ne dessine rien. Elle calcule les lignes, le tri, la pagination et la visibilité des colonnes ; c'est nous qui écrivons le `<table>`.

**Les colonnes** (`src/components/CardsTable.jsx`), avec `createColumnHelper()` :

```js
const columns = [
  columnHelper.accessor("name", { header: "Nom" }),
  columnHelper.accessor("set", { header: "Extension" }),
  columnHelper.accessor("rarity", { header: "Rareté", cell: (info) => <RarityBadge rarity={info.getValue()} /> }),
  columnHelper.accessor("price", { header: "Prix", cell: (info) => formatPrice(info.getValue()) }),
  columnHelper.accessor("quantity", { header: "Quantité" }),
  columnHelper.accessor((card) => card.price * card.quantity, {   // colonne CALCULÉE
    id: "value", header: "Valeur", cell: (info) => formatPrice(info.getValue()),
  }),
  columnHelper.display({ id: "actions", header: "Actions", cell: ({ row }) => (/* Détail + Retirer */) }),
];
```

- `accessor("price")` lit un champ ; `accessor(fn, { id })` **calcule** une valeur (Valeur = prix × quantité), qui est triable comme les autres en mode client.
- `display` : une colonne sans donnée (boutons).
- `columns` est défini **hors du composant** : sa référence est stable. Si on le recréait à chaque rendu, la table recalculerait tout à chaque fois (voire bouclerait). Même exigence pour `data` : celui de Query est stable.
- Rendu : `flexRender(header.column.columnDef.header, header.getContext())` pour les en-têtes, `flexRender(cell.column.columnDef.cell, cell.getContext())` pour les cellules.

**La version de l'étape 9 (tout côté client)** ressemblait à ceci, avec **toutes** les cartes (`allCardsQueryOptions()`) :

```js
const [sorting, setSorting] = useState([]);
const [globalFilter, setGlobalFilter] = useState("");
const table = useReactTable({
  data, columns,
  state: { sorting, globalFilter, columnVisibility },
  onSortingChange: setSorting,
  onGlobalFilterChange: setGlobalFilter,
  onColumnVisibilityChange: setColumnVisibility,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),        // trie en mémoire
  getFilteredRowModel: getFilteredRowModel(),    // filtre en mémoire
  getPaginationRowModel: getPaginationRowModel(),// découpe en pages en mémoire
  initialState: { pagination: { pageSize: 10 } },
});
```

Chaque `get…RowModel()` est une étape du « pipeline » : lignes brutes → filtrées → triées → page courante. L'étape 10 remplace ce mode par le mode serveur ; **le code final est donc celui de l'étape 10**.

**Ce qui reste valable dans le code final** :

- **Tri au clic** : `header.column.getToggleSortingHandler()`. Le cycle est croissant ▲ → décroissant ▼ → aucun tri. J'ai mis `sortDescFirst: false`, car par défaut TanStack Table commence par **décroissant** sur les colonnes numériques.
- **Visibilité des colonnes** : cases à cocher, `column.getIsVisible()` / `column.getToggleVisibilityHandler()`. C'est un état **local** (`useState`), car c'est une simple préférence d'affichage.
- **Sélecteur Grille / Tableau** : stocké dans l'URL (`view=grid|table`).

---

## Étape 10 : Table pilotée par l'URL (mode serveur)

**Le concept.** En mode client, la table doit avoir **toutes** les lignes en mémoire. Avec 100 000 cartes, c'est impossible : c'est le **serveur** qui trie et pagine. La table passe en **mode manuel** : elle n'applique plus rien elle-même, elle **affiche** ce qu'on lui donne et **signale** les changements demandés.

```js
const table = useReactTable({
  data: cards,
  columns,
  getCoreRowModel: getCoreRowModel(),
  state: { sorting, pagination, columnVisibility },
  onSortingChange,
  onPaginationChange,
  onColumnVisibilityChange: setColumnVisibility,
  manualSorting: true,     // le serveur trie
  manualPagination: true,  // le serveur pagine
  manualFiltering: true,   // le serveur filtre (q)
  rowCount,                // = X-Total-Count → la table calcule le nombre de pages
  enableMultiSort: false,
  sortDescFirst: false,
});
```

Plus besoin de `getSortedRowModel` & co : ils ne serviraient à rien en mode manuel.

**Table « contrôlée » par l'URL.** `CardsTable` ne possède ni le tri ni la page : elle les **reçoit** de la route, qui les **dérive** de l'URL.

```js
// index.jsx
const pagination = { pageIndex: search.page - 1, pageSize: filters.limit };  // page 1 de l'URL = index 0
const sorting = toSorting(search.sort);   // "price.desc" → [{ id: "price", desc: true }]

function handleSortingChange(updater) {
  const next = typeof updater === "function" ? updater(sorting) : updater;
  updateSearch({ sort: toSortParam(next), page: 1 });
}
function handlePaginationChange(updater) {
  const next = typeof updater === "function" ? updater(pagination) : updater;
  updateSearch({ page: next.pageIndex + 1, pageSize: next.pageSize });
}
```

TanStack Table appelle `onSortingChange` avec un **updater** (une fonction « ancien état → nouvel état », comme `setState`) ou une valeur ; on calcule le nouvel état puis on l'écrit dans l'URL. Le cycle complet :

```
clic sur « Prix » → onSortingChange → navigate(?sort=price.asc) → URL change
→ Route.useSearch() → sorting dérivé → loaderDeps → nouvelle clé de cache
→ fetchCards traduit en _sort=price&_order=asc → le serveur trie → la table affiche
```

**Une limite assumée** : la colonne **Valeur** n'est **plus triable** (`enableSorting: false`). json-server ne trie que sur des champs **stockés** (`_sort=price`), pas sur un calcul. Il faudrait que le serveur stocke ou calcule `value`.

**10.4 Le voile** : `keepPreviousData` garde l'ancienne page affichée, et la classe `is-fetching` (opacité 0,55) indique qu'on attend la nouvelle.

```jsx
<div className={`results${isFetching ? " is-fetching" : ""}`} aria-busy={isFetching}>
```

**Vérification (testée)** : clic sur Prix → `?view=table&sort=price.asc` (requête `_sort=price&_order=asc` dans le Réseau) ; 2ᵉ clic → `price.desc` (Électhor 52 € en tête) ; 3ᵉ clic → plus de tri. 3 pages de 10. Page 2 et taille 5 conservées après rechargement.

---

## Étape 11 : TanStack Form, le formulaire d'ajout

**Le concept.** TanStack Form gère, pour chaque champ, la valeur, l'état « touché », les erreurs et la validation (synchrone et asynchrone), sans re-rendre tout le formulaire à chaque frappe.

**11.1 Le formulaire** (`src/components/AddCardForm.jsx`) :

```js
const form = useForm({
  defaultValues: { name: "", set: SETS[0], rarity: "commune", price: "", quantity: "1" },
  onSubmit: async ({ value, formApi }) => { ... },
});
```

Les valeurs restent des **chaînes** (c'est ce que donnent les `<input>`) ; on convertit au moment de soumettre. Chaque champ :

```jsx
<form.Field name="price" validators={{ onChange: newCardSchema.shape.price }}>
  {(field) => (
    <label>
      Prix
      <input
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
      />
      <FieldInfo field={field} />
    </label>
  )}
</form.Field>
```

**11.2 Validation avec Zod** (`src/domain/card.js`). Le schéma **valide et convertit** :

```js
export const newCardSchema = z.object({
  name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères (hors espaces)."),
  set: z.enum(SETS),
  rarity: z.enum(RARITIES),
  price: z.string().trim().min(1, "Le prix est obligatoire.")
    .transform(parsePrice)                      // "3,5" → 3.5
    .pipe(z.number({ error: "Le prix doit être un nombre." }).min(0, "Le prix doit être positif ou nul.")),
  quantity: z.string().trim().min(1, "La quantité est obligatoire.")
    .transform(Number)
    .pipe(z.number({ error: "La quantité doit être un nombre." })
      .int("La quantité doit être un entier.").min(1, "La quantité doit être au moins 1.")),
});
```

`transform` + `pipe` : on transforme le texte en nombre, puis on **valide le nombre**. `"abc"` donne `NaN`, que `z.number()` refuse.

**Validation par champ** (l'énoncé permet « au niveau du formulaire **ou** par champ ») : chaque champ reçoit **son morceau** du schéma, `newCardSchema.shape.price`. J'ai d'abord essayé la validation au niveau du formulaire, mais avec la validation asynchrone du nom (11.3), TanStack Form valide d'abord les champs à la soumission et s'arrête si l'un d'eux échoue : les erreurs des autres champs n'apparaissaient pas. Par champ, toutes les erreurs s'affichent dès la 1ʳᵉ tentative.

Les erreurs ne s'affichent **qu'une fois le champ touché** (on ne crie pas « nom invalide » sur un formulaire encore vide) :

```jsx
function FieldInfo({ field }) {
  const { isTouched, errors, isValidating } = field.state.meta;
  // Erreurs = chaînes (validateur maison) ou « issues » Zod ({ message, path })
  const messages = [...new Set(errors.map((error) => (typeof error === "string" ? error : error?.message)))];
  ...
}
```

À la soumission, TanStack Form marque tous les champs comme touchés : toutes les erreurs apparaissent.

**11.3 Validation asynchrone du nom** :

```jsx
<form.Field
  name="name"
  validators={{
    onChange: newCardSchema.shape.name,      // d'abord la règle synchrone
    onChangeAsyncDebounceMs: 400,            // attendre 400 ms sans frappe
    onChangeAsync: checkNameIsFree,          // puis demander au serveur
  }}
>
```

```js
async function checkNameIsFree({ value, signal }) {
  try {
    const matches = await findCardsByName(value.trim(), { signal });   // GET /cards?name=…
    return matches.length > 0 ? "Cette carte est déjà dans la collection." : undefined;
  } catch {
    return "Impossible de vérifier le nom pour l'instant.";
  }
}
```

- Tant que la règle **synchrone** échoue (nom < 2 caractères), la requête **ne part pas**.
- `signal` : si l'utilisateur retape pendant la requête, TanStack Form **annule** la précédente (`fetch` reçoit le signal).
- Pendant la vérification, « Vérification… » s'affiche (`isValidating`).
- `?name=` est une égalité **exacte et sensible à la casse** côté json-server : « pikachu » en minuscules passerait.

**11.4 Le bouton** est abonné à l'état du formulaire avec `form.Subscribe`, donc seul le bouton se re-rend :

```jsx
<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
  {([canSubmit, isSubmitting]) => (
    <button type="submit" disabled={!canSubmit}>{isSubmitting ? "Ajout…" : "Ajouter la carte"}</button>
  )}
</form.Subscribe>
```

**11.5 / 11.6 La soumission** :

```js
onSubmit: async ({ value, formApi }) => {
  const card = newCardSchema.parse(value);   // { name: "Évoli", price: 3.5, quantity: 1, … }
  try {
    const created = await addCard(card);     // useAddCard().mutateAsync
    setLastAdded(created);                   // message « « Évoli » a été ajoutée. Voir la carte »
    formApi.reset();
    nameRef.current?.focus();                // le curseur revient dans « Nom »
  } catch {
    // erreur déjà affichée par le toast global
  }
},
```

`mutateAsync` (au lieu de `mutate`) renvoie une **promesse** : on peut l'`await`er, et `isSubmitting` reste vrai pendant toute la mutation (d'où « Ajout… »). J'ai choisi de **rester sur la page** avec un message de succès (option autorisée), ce qui rend utile le retour du curseur dans « Nom ».

**Vérification (testée)** : soumission vide → erreurs sous Nom et Prix, bouton désactivé ; « Pikachu » refusé après une courte pause ; « Évoli », prix « 3,5 » → créée côté serveur avec un id généré par json-server (`"52aShVi"`) et `price: 3.5`.

---

## Étape 12 : Favoris et notes persistés sur le serveur

**12.1 Favoris.** Le Context (`FavoritesProvider`, `useFavorites`) est **supprimé** : les favoris sont des données serveur (`/favorites`, objets `{ id, cardId }`), donc ils vivent dans le cache Query (`src/queries/favorites.js`).

```js
export function useToggleFavorite() {
  ...
  return useMutation({
    mutationKey: favoriteKeys.all,
    // favoriteId présent → DELETE ; absent → POST
    mutationFn: ({ cardId, favoriteId }) =>
      favoriteId === undefined ? createFavorite(cardId) : deleteFavorite(favoriteId),
    onMutate: async ({ cardId, favoriteId }) => {
      await queryClient.cancelQueries({ queryKey: favoriteKeys.all });
      const previous = queryClient.getQueryData(favoriteKeys.all);
      queryClient.setQueryData(favoriteKeys.all, (favorites = []) =>
        favoriteId === undefined
          ? [...favorites, { id: optimisticId(cardId), cardId }]   // entrée provisoire
          : favorites.filter((favorite) => favorite.id !== favoriteId)
      );
      return { previous };
    },
    onError: (_e, _v, context) => queryClient.setQueryData(favoriteKeys.all, context?.previous),
    onSuccess: (created, { cardId, favoriteId }) => { /* remplace l'entrée provisoire par la vraie */ },
    onSettled: () => invalidateWhenIdle(queryClient, favoriteKeys.all),
  });
}
```

- Pour supprimer un favori, json-server a besoin de **l'id de l'entrée** (`DELETE /favorites/3`), pas de l'id de la carte. Le bouton cherche donc l'entrée et passe son `id`.
- Pourquoi le bouton décide POST/DELETE, et pas `mutationFn` ? Parce que `onMutate` s'exécute **avant** `mutationFn` et a déjà modifié le cache : la `mutationFn` verrait l'état inversé.
- L'entrée optimiste a un id provisoire (`optimistic-3`). Dès que le serveur répond, `onSuccess` la remplace par la vraie, pour qu'un second clic rapide puisse la supprimer.

**12.2 Dérivation, jamais de stockage.**

```js
function toFavoriteIds(favorites) {            // hors du composant : select mémorisé
  return new Set(favorites.map((favorite) => favorite.cardId));
}
export function useFavoriteIds() {
  const { data } = useQuery({ ...favoritesQueryOptions(), select: toFavoriteIds });
  return data ?? NO_FAVORITES;
}
```

`select` transforme la donnée du cache **pour ce composant** sans la modifier dans le cache. Le `Set` n'est jamais stocké : il est recalculé quand les favoris changent. Stocker une copie, ce serait risquer qu'elle se désynchronise.

La page `/favorites` **croise** deux requêtes déjà en cache, sans aucune requête par carte :

```js
const favoriteCards = data.items.filter((card) => favoriteIds.has(card.id));
```

Son loader charge les deux **en parallèle** : `Promise.all([ensureQueryData(allCards…), ensureQueryData(favorites…)])`.

**12.3 Notes avec sauvegarde automatique** (`src/components/CardNotes.jsx`, `src/queries/notes.js`).

- La note est une query `["notes", cardId]` → `GET /notes?cardId=…` (premier résultat ou `null`). C'est une **query dépendante** : sa clé dépend du `cardId` de la page. Sur la page de détail, le loader la lance **en parallèle** de la carte, ce qui évite la cascade carte → note.
- La `textarea` est contrôlée par un **brouillon local**, et la sauvegarde part **800 ms après la dernière frappe** :

```js
const [draft, setDraft] = useState(null);                       // { cardId, text } | null
const debouncedDraft = useDebouncedValue(draft, AUTOSAVE_DELAY_MS);
const savedText = note?.text ?? "";
const text = draft?.cardId === cardId ? draft.text : savedText;  // brouillon de CETTE carte, sinon le serveur

useEffect(() => {
  if (debouncedDraft === null) return;
  const saved = queryClient.getQueryData(noteKeys.detail(debouncedDraft.cardId));
  if (debouncedDraft.text !== (saved?.text ?? "")) saveNote(debouncedDraft);
}, [debouncedDraft, queryClient, saveNote]);
```

- `useSaveNote` fait un **POST** si la carte n'a pas encore de note, un **PATCH** sinon. Avec `scope: { id: "notes" }`, les sauvegardes s'exécutent **l'une après l'autre** : la 2ᵉ voit la note créée par la 1ʳᵉ et fait un PATCH, au lieu d'un second POST qui créerait un doublon.
- L'indicateur : « Enregistrement… » tant que le texte affiché diffère de celui du serveur, « Enregistré » quand ils sont égaux, « Échec de l'enregistrement » si la mutation échoue.

**Suppression d'une carte** : json-server 0.17 supprime **en cascade** les entrées dont `cardId` pointe vers la carte supprimée (favoris et notes). `useRemoveCard` invalide donc les favoris après une suppression.

**Vérification (testée)** : 2 favoris → rechargement → toujours 2 ; note écrite → « Enregistré » → rechargement → la note est là ; autre carte → sa propre note (vide) ; une seule note créée côté serveur.

---

## Étape 13 : Bonus (2 choisis)

### Bonus 4 : gestion d'erreur globale (`main.jsx`)

```js
queryCache: new QueryCache({
  onError: (error, query) => {
    // Seulement si des données sont déjà affichées (échec d'un rafraîchissement en arrière-plan).
    // Les erreurs de premier chargement sont affichées par la page elle-même.
    if (query.state.data !== undefined) showToast(`Actualisation impossible (${error.message}).`);
  },
}),
mutationCache: new MutationCache({
  onError: (error, _variables, _context, mutation) => {
    showToast(mutation.meta?.errorMessage ?? `Erreur : ${error.message}`);
  },
}),
```

Un **seul** endroit affiche les erreurs ; chaque mutation décrit juste son message dans `meta`. Le toast est un mini-store (`src/hooks/useToasts.js`) lu avec `useSyncExternalStore`. Il est appelable **hors de React** (le `MutationCache` n'est pas un composant), d'où un store externe plutôt qu'un Context.

**`throwOnError` + Error Boundaries.** L'autre moitié de la règle est dans les options par défaut des requêtes :

```js
// main.jsx, defaultOptions.queries
throwOnError: (_error, query) => query.state.data === undefined,
```

C'est exactement le **complément** du `QueryCache.onError` ci-dessus :

| La requête échoue… | Ce qui se passe | Qui l'affiche |
|---|---|---|
| **sans** données à montrer | l'erreur est **lancée** pendant le rendu | l'**Error Boundary** la plus proche |
| **avec** des données déjà affichées | rien n'est lancé, les données restent | le **toast** (`QueryCache.onError`) |

Chaque erreur est donc affichée **une fois, à un seul endroit**. (C'est d'ailleurs la règle que `useSuspenseQuery` applique déjà ; on l'étend à `useQuery`.)

Il faut alors une Error Boundary au-dessus de chaque requête. Il y en a de deux sortes :

- les **`errorComponent` des routes** (`RouteError`), qui sont des Error Boundaries du routeur : ils remplacent la page dans l'`<Outlet />`, l'en-tête et la navigation restent. Toutes les routes en ont un, y compris la racine (dernier filet pour une erreur dans le layout lui-même) et `/add` ;
- une **Error Boundary locale** maison (`src/components/ErrorBoundary.jsx`), pour qu'une partie **secondaire** en panne n'emporte pas toute la page :

```jsx
<ErrorBoundary fallback={NotesError} resetKey={cardId}>
  <NotesEditor cardId={cardId} />
</ErrorBoundary>
```

Une Error Boundary ne peut être qu'une **classe** (`getDerivedStateFromError`) : React n'a pas de hook équivalent. Le `fallback` reçoit `{ error, reset }`, comme un `errorComponent`. Deux détails :

- « Réessayer » appelle aussi le `reset()` de `useQueryErrorResetBoundary()` : sans lui, la requête en erreur relancerait **aussitôt** la même erreur au réaffichage, sans refaire de requête ;
- `resetKey` : quand il change (on passe de `/cards/3` à `/cards/9`, et le routeur **réutilise** le composant), la zone retente d'elle-même au lieu de garder l'erreur de la carte précédente.

Où sont les boundaries locales :

- **en-tête** (`__root.jsx`) : résumé et compteur de favoris. S'ils échouent, l'en-tête affiche « Résumé indisponible » + « Réessayer », la page continue de fonctionner. (Avant, le résumé restait bloqué sur « Calcul du résumé… ».) La requête du résumé a été déplacée dans un petit composant `HeaderSummary` pour être **sous** la boundary : une boundary ne rattrape que les erreurs de ses **enfants**, pas du composant qui la rend ;
- **notes** (`CardNotes.jsx`) : si la note ne se charge pas, seul le panneau « Notes » est en erreur, la carte reste affichée.

Une exception volontaire : `FavoriteButton` met `throwOnError: false`. L'étoile est présente sur **chaque** tuile : si la liste des favoris ne se charge pas, la lancer ferait échouer toute la grille pour un détail. Le bouton reste simplement **désactivé** tant que la liste n'est pas connue (sans elle, on ne sait pas s'il faut un POST ou un DELETE), et l'erreur est déjà signalée par l'en-tête.

Les erreurs de **rendu** (un bug qui lance une exception dans un composant) sont rattrapées par les mêmes boundaries : c'est pourquoi le titre de `RouteError` est devenu « Oups, une erreur est survenue » (et plus seulement « le chargement a échoué »).

**Vérification (testée dans Chrome, API simulée en panne)** : notes en panne → seul le panneau Notes est en erreur, « Réessayer » le rétablit, et revenir à une autre carte le réinitialise (`resetKey`) ; résumé ou favoris en panne → « Résumé indisponible » dans l'en-tête, page de détail intacte, étoile désactivée ; API arrêtée sur `/` → `RouteError`, navigation toujours visible, « Réessayer » ramène les données ; échec d'un « Actualiser » avec données → toast + message, la grille reste ; aucune erreur JavaScript non rattrapée.

### Bonus 8 : accessibilité

- `aria-sort="ascending | descending | none"` sur les en-têtes triables ; le tri se fait avec un vrai `<button>`, donc au clavier (Tab + Entrée).
- Annonce `aria-live` du nombre de résultats (« 4 cartes trouvées, page 1 sur 1 ») pour les lecteurs d'écran (classe `sr-only`).
- `aria-busy` sur la zone de résultats pendant un chargement ; `role="alert"` sur les erreurs et les toasts ; `aria-pressed` sur les boutons favori et Grille/Tableau ; `role="search"` sur la barre de recherche.

---

## Étape 14 : Bilan et architecture

### Qui possède quel état, et qui l'affiche

```
                   ┌──────────────────────────────────────────────┐
                   │  SERVEUR (json-server, db.json)              │  ← vérité
                   │  cards · favorites · notes                   │
                   └───────────────▲──────────────┬───────────────┘
                         mutations │              │ fetch (queryFn)
                  (POST/PATCH/DEL) │              ▼
                   ┌───────────────┴──────────────────────────────┐
                   │  CACHE TANSTACK QUERY (copie locale)         │
                   │  ["cards","list",filtres] ["cards","detail",id]
                   │  ["favorites"]            ["notes",cardId]   │
                   └───────────────▲──────────────────────────────┘
          loaders (ensureQueryData)│   useQuery / useSuspenseQuery
                   ┌───────────────┴──────────────────────────────┐
  URL ────────────►│  ROUTEUR : /, /cards/$cardId, /favorites, /add│
  ?q&rarity&page   │  validateSearch (Zod) → filtres → clés       │
  &view&sort       └──────────────────────────────────────────────┘
  &pageSize
```

| État | Propriétaire | Où il est affiché |
|---|---|---|
| Cartes, favoris, notes | **Serveur** (`db.json`), copie dans le **cache Query** | Résumé de l'en-tête, grille, tableau, détail, page Favoris, `FavoriteButton`, `FavoritesCount`, `CardNotes` |
| Recherche, rareté, page, vue, tri, taille de page | **URL** (search params validés par Zod) | `SearchBar`, pagination, sélecteur Grille/Tableau, tri et pagination de `CardsTable` |
| Carte ouverte | **URL** (paramètre `$cardId`) | Page de détail |
| Saisie du formulaire, champs touchés, erreurs, soumission en cours | **TanStack Form** | `AddCardForm` |
| Texte en cours de frappe (avant debounce), brouillon de note, colonnes masquées, dernière carte ajoutée | **État local** (`useState`) | `SearchBar`, `CardNotes`, `CardsTable`, `AddCardForm` |
| `favoriteIds`, cartes favorites, valeur de la collection, nombre de pages, `sorting` | **Dérivé** (jamais stocké) | Calculé au rendu |
| Notifications | **Store externe** (`useSyncExternalStore`) | `Toaster` |

**La règle à retenir** : chaque information a **un seul** propriétaire ; tout le reste est **dérivé**. Plus aucune copie à synchroniser à la main.

### Vérifications finales

- `npm run lint` : **aucun message** (voir ci-dessous pour la configuration).
- Aucun `console.log` dans `src/`.
- `src/routeTree.gen.ts` est régénéré automatiquement par le plugin (`npm run dev` / `npm run build`) ; il est cohérent avec les 5 fichiers de `src/routes/`.
- `npm run build` passe.
- **Tests de bout en bout** : 49 vérifications automatiques (Chrome piloté par Puppeteer, sur une **copie** de `db.json`), reprenant les « Vérification » de chaque étape. Toutes passent.

**Configuration oxlint** (`.oxlintrc.json`) :

- `react/only-export-components` est désactivé **pour `src/routes/` seulement** : un fichier de route exporte `Route` (un objet) et définit des composants, ce qui déclencherait l'avertissement Fast Refresh. Avec `autoCodeSplitting`, le plugin du routeur sépare lui-même les composants, donc cet avertissement est un faux positif connu.
- `react/exhaustive-deps` est activé (en `warn`) pour attraper les dépendances d'effets oubliées.
- `src/routeTree.gen.ts` est ignoré (fichier généré).
- Une ligne `eslint-disable-next-line react/incompatible-library` dans `CardsTable` : cet avertissement concerne le **React Compiler**, non utilisé dans ce projet.

---

## Réponses aux questions

### Q7.1 : Pourquoi `ensureQueryData` et pas `fetchQuery` ou `prefetchQuery` dans le loader ?

| | Renvoie la donnée ? | Lève l'erreur ? | Donnée en cache mais **périmée** | Donnée en cache et **fraîche** |
|---|---|---|---|---|
| `fetchQuery` | oui | oui | **refait la requête et l'attend** | renvoie le cache |
| `prefetchQuery` | **non** (`void`) | **non** (avalée) | refait la requête et l'attend | ne fait rien |
| `ensureQueryData` | oui | oui | **renvoie le cache tout de suite** | renvoie le cache |

- `ensureQueryData` ne regarde que la **présence** de la donnée, pas sa fraîcheur. Dès qu'une carte est en cache, même périmée, la navigation est **instantanée**. Le composant (`useSuspenseQuery`) la rafraîchira ensuite en arrière-plan, puisqu'elle est périmée : on affiche vite, puis on se met à jour.
- `fetchQuery` bloquerait la navigation (400 ms ici) chaque fois que la donnée a plus de `staleTime`, alors qu'on a déjà quelque chose à montrer.
- `prefetchQuery` ne renvoie rien et **avale les erreurs** : impossible de détecter le 404 pour lever `notFound()`, et une panne n'irait pas vers `errorComponent`.

### Q7.2 : Qu'est-ce que le « render-then-fetch waterfall » ? Comment les loaders le réduisent-ils ?

Sans loader, la séquence est : télécharger le JS de la page → **rendre** le composant → **alors seulement** lancer sa requête (`useQuery`/`useEffect`) → afficher un spinner → la donnée arrive → rendre les enfants → **qui lancent à leur tour** leurs requêtes → nouveau spinner… Chaque étape attend la précédente : c'est une **cascade** (*waterfall*), et les temps s'additionnent.

Les loaders inversent l'ordre (*fetch-then-render*) :

- les requêtes partent **dès le début de la navigation**, voire **dès le survol** du lien (`preload: "intent"`), avant tout rendu ;
- les loaders de toutes les routes imbriquées s'exécutent **en parallèle**, et en parallèle du téléchargement du code de la page (code splitting) ;
- dans un loader, on lance tout en même temps. Ici, la carte **et** sa note partent ensemble sur la page de détail, au lieu de « carte, puis rendu, puis note ».

### Q7.3 : `useSuspenseQuery` vs `useQuery` (`status` / `data`) ?

- Avec `useQuery`, le composant se rend **dans tous les états** : `status` peut valoir `"pending"` (`data` est `undefined`), `"error"` ou `"success"`, et c'est au composant de gérer chaque cas.
- Avec `useSuspenseQuery`, le composant ne se rend **qu'avec des données** :
  - pas encore de donnée → le hook **suspend** (il lance une promesse) : React affiche la limite `<Suspense>` la plus proche, ici le `pendingComponent` du routeur ;
  - erreur sans donnée → le hook **lance l'erreur** : c'est l'Error Boundary la plus proche qui l'affiche, ici l'`errorComponent` de la route ;
  - donc, quand le composant s'exécute, `status` vaut toujours `"success"` et **`data` n'est jamais `undefined`**. Pas de `if (isPending)` ni de `data?.`.
- Un échec de **rafraîchissement en arrière-plan** (des données existent déjà) n'est pas lancé : les anciennes données restent affichées.
- `useSuspenseQuery` n'accepte pas `enabled` ni `placeholderData`. C'est pour ça que la liste (`/`), qui a besoin de `keepPreviousData`, utilise `useQuery`.

### Q7.4 : Que signifie `preload="intent"` ? Quel coût, quand le désactiver ?

« Intent » = **intention de cliquer** : quand la souris survole un `<Link>` (ou qu'il reçoit le focus clavier, ou au début d'un toucher), le routeur exécute **déjà** le loader de la page cible (et télécharge son code), après un court délai (~50 ms). Au clic, tout est prêt : la page s'affiche instantanément (~100 ms mesurés, contre plus de 400 ms sans).

**Coût** : des requêtes **inutiles** quand on survole sans cliquer. Passer la souris sur une grille de 24 cartes peut déclencher 24 requêtes de détail (+ 24 de notes). Le `staleTime` de 30 s limite les doublons, mais la charge serveur augmente.

**Le désactiver** (globalement ou par lien avec `preload={false}`) quand :

- la requête est **coûteuse** (calcul lourd, gros volume, API facturée ou limitée en débit) ;
- il y a énormément de liens survolés en passant (grands tableaux, menus) ;
- l'utilisateur est sur un réseau mobile ou limité ;
- la donnée change si vite que la préchargée serait déjà périmée au clic ;
- le loader a des **effets de bord** (compteur de vues, journalisation…) : un préchargement ne doit rien modifier.

### Q7.5 : Erreur de loader vs erreur de `useQuery` : qui l'affiche et où ?

| Origine | Ce qui se passe | Qui affiche |
|---|---|---|
| **Loader** qui lève une erreur (ex. `ensureQueryData` échoue) | Le routeur l'attrape et ne rend pas le composant de la route | L'**`errorComponent` de la route** (ou du parent le plus proche qui en a un), à la place de la page, dans l'`<Outlet />` : l'en-tête et la navigation restent. Il reçoit `{ error, reset, info }`. |
| **Loader** qui lève `notFound()` | Idem, mais vers le composant « introuvable » | Le **`notFoundComponent`** de la route (sinon celui du parent / de la racine) |
| **`useSuspenseQuery`** en erreur, sans données | L'erreur est lancée pendant le rendu | Le même **`errorComponent`** de la route (c'est une Error Boundary React) |
| **`useQuery`** en erreur, par défaut | **Rien n'est lancé** : l'erreur est rangée dans l'état de la requête (`status: "error"`, `error`) | **Le composant lui-même**, qui doit tester `status` |
| **`useQuery`** en erreur, sans données, avec notre `throwOnError` (bonus 4) | L'erreur est lancée pendant le rendu, comme avec `useSuspenseQuery` | L'Error Boundary la plus proche : l'**`errorComponent`** de la route (page `/`) ou une **`<ErrorBoundary>` locale** (en-tête, notes) |
| Échec d'un **rafraîchissement en arrière-plan** | Les données restent affichées | Le **toast global** (`QueryCache.onError`), plus le message « La dernière actualisation a échoué » sur la page `/` |
| **Mutation** en erreur | Rollback dans le `onError` du hook | Le **toast global** (`MutationCache.onError`) |

« Réessayer » dans l'`errorComponent` appelle `router.invalidate()` (relance les loaders et réinitialise la boundary), après `useQueryErrorResetBoundary().reset()` pour que les `useSuspenseQuery` puissent refaire leur requête.

### Q12.4 : Pourquoi le reset par `key` du Module 1 n'est plus nécessaire sur la page de détail ?

Au Module 1, `CardNotes` gardait le texte dans un `useState("")` **sans lien avec la carte**. En sélectionnant une autre carte, React **réutilisait** le même composant (même place dans l'arbre) : l'ancien texte restait affiché sous le nom de la nouvelle carte. `key={selectedCard.id}` forçait React à détruire et recréer le composant pour vider cet état.

Maintenant :

1. **La note n'est plus un état local** : sa vérité est sur le serveur, et sa copie est dans le cache sous la clé `["notes", cardId]`. Changer de carte, c'est changer de **clé** : `useQuery` renvoie automatiquement la note de la nouvelle carte. Il n'y a plus d'état « orphelin » à remettre à zéro.
2. **Le seul état local, le brouillon en cours de frappe, connaît sa carte** : il est stocké sous la forme `{ cardId, text }`, et un brouillon qui appartient à une autre carte est simplement ignoré (`draft?.cardId === cardId ? draft.text : savedText`). Même si le composant est réutilisé, il ne peut pas afficher le texte d'une autre carte.
3. Le brouillon d'une carte qu'on quitte avant la fin des 800 ms est quand même enregistré **sur la bonne carte** (la sauvegarde utilise `debouncedDraft.cardId`, pas la carte affichée).

Remarque : TanStack Router **ne remonte pas** le composant quand seul le paramètre change (`/cards/1` → `/cards/2`). S'il fallait vraiment repartir de zéro à chaque carte, l'équivalent routeur de `key` serait l'option `remountDeps: ({ params }) => params` sur la route. Ce n'est pas nécessaire ici, grâce aux points 1 et 2.

---

## Récapitulatif des fichiers

| Fichier | Rôle |
|---|---|
| `src/main.jsx` | `QueryClient` (options par défaut, erreurs globales), routeur, providers, devtools |
| `src/api/client.js` | `request()` + `HttpError` : seul point de contact avec le serveur |
| `src/api/cards.js`, `favorites.js`, `notes.js` | Fonctions `fetch` brutes |
| `src/queries/cards.js` | Clés, `queryOptions`, mutations quantité / suppression / ajout (optimistes) |
| `src/queries/favorites.js` | Favoris : query, `useFavoriteIds` (dérivé), `useToggleFavorite` (optimiste) |
| `src/queries/notes.js` | Note d'une carte : query + `useSaveNote` (POST ou PATCH, sérialisé) |
| `src/queries/optimistic.js` | `restoreSnapshot`, `invalidateWhenIdle` |
| `src/routes/__root.jsx` | Layout, en-tête, navigation, toasts, page introuvable |
| `src/routes/index.jsx` | Collection : search params, loader, grille / tableau, pagination |
| `src/routes/cards.$cardId.jsx` | Détail : loader, `notFound`, `useSuspenseQuery`, notes |
| `src/routes/favorites.jsx` | Favoris : croisement cartes × favoris |
| `src/routes/add.jsx` | Page du formulaire |
| `src/components/CardsTable.jsx` | TanStack Table en mode serveur contrôlé |
| `src/components/AddCardForm.jsx` | TanStack Form + Zod + validation asynchrone |
| `src/components/CardNotes.jsx` | Note avec sauvegarde automatique |
| `src/components/SearchBar.jsx` | Recherche avec debounce, synchronisée avec l'URL |
| `src/components/RouteError.jsx`, `NotFound.jsx`, `Skeletons.jsx`, `Toaster.jsx` | Erreur, introuvable, chargement, notifications |
| `src/components/ErrorBoundary.jsx` | Error Boundary locale (en-tête, notes), reliée au reset de TanStack Query |
| `src/hooks/useDebouncedValue.js`, `useToasts.js`, `useDocumentTitle.js` | Hooks |
| `src/domain/card.js` | Constantes, formatage, `newCardSchema` (Zod) |
| **Supprimés** | `App.jsx`, `hooks/useCards.js`, `context/` (favoris en Context) |
