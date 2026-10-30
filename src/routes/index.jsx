import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, stripSearchParams } from "@tanstack/react-router";
import { z } from "zod";
import { CardGrid } from "../components/CardGrid";
import { CardsTable } from "../components/CardsTable";
import { Panel } from "../components/Panel";
import { RouteError } from "../components/RouteError";
import { SearchBar } from "../components/SearchBar";
import { CardsSkeleton } from "../components/Skeletons";
import { RARITIES } from "../domain/card";
import { cardsQueryOptions } from "../queries/cards";

const GRID_PAGE_SIZE = 8;
const TABLE_PAGE_SIZE = 10;
const SORTABLE_FIELDS = ["name", "set", "rarity", "price", "quantity"];
const SORT_PATTERN = new RegExp(`^(${SORTABLE_FIELDS.join("|")})\\.(asc|desc)$`);

// Toute valeur absente ou invalide dans l'URL est remplacée par sa valeur par défaut (.catch).
const searchSchema = z.object({
  q: z.string().catch(""),
  rarity: z.enum([...RARITIES, "toutes"]).catch("toutes"),
  page: z.number().int().min(1).catch(1),
  view: z.enum(["grid", "table"]).catch("grid"),
  sort: z.string().regex(SORT_PATTERN).optional().catch(undefined), // ex. "price.desc"
  pageSize: z.number().int().min(1).max(50).optional().catch(undefined),
});

// Valeurs retirées de l'URL quand elles valent la valeur par défaut : /?page=1&view=grid → /
const defaultSearch = { q: "", rarity: "toutes", page: 1, view: "grid" };

// Ce que le serveur doit renvoyer pour ces paramètres d'URL (c'est aussi la clé de cache).
function toCardFilters({ q, rarity, page, view, sort, pageSize }) {
  const limit = pageSize ?? (view === "table" ? TABLE_PAGE_SIZE : GRID_PAGE_SIZE);
  return { q, rarity, page, limit, sort };
}

// "price.desc" ⇄ [{ id: "price", desc: true }] (format de TanStack Table)
function toSorting(sort) {
  if (!sort) return [];
  const [id, order] = sort.split(".");
  return [{ id, desc: order === "desc" }];
}

function toSortParam(sorting) {
  const [first] = sorting;
  return first ? `${first.id}.${first.desc ? "desc" : "asc"}` : undefined;
}

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  search: { middlewares: [stripSearchParams(defaultSearch)] },
  loaderDeps: ({ search }) => toCardFilters(search),
  loader: async ({ context: { queryClient }, deps, cause }) => {
    if (cause === "stay") {
      // Filtre, tri ou page changé alors qu'on est déjà sur la page : on n'attend pas.
      // La page s'affiche tout de suite avec les anciennes données (keepPreviousData) sous un voile.
      queryClient.prefetchQuery(cardsQueryOptions(deps));
      return;
    }
    // Arrivée sur la page (ou préchargement au survol) : données prêtes avant l'affichage.
    await queryClient.ensureQueryData(cardsQueryOptions(deps));
  },
  pendingComponent: CardsSkeleton,
  errorComponent: RouteError,
  component: CollectionPage,
});

function CollectionPage() {
  const search = Route.useSearch();
  const filters = Route.useLoaderDeps();
  const navigate = Route.useNavigate();
  const { data, status, error, isFetching, refetch } = useQuery({
    ...cardsQueryOptions(filters),
    placeholderData: keepPreviousData,
  });

  function updateSearch(patch) {
    navigate({ search: (previous) => ({ ...previous, ...patch }) });
  }

  // Pas encore de données. Une erreur sans données n'arrive pas jusqu'ici :
  // throwOnError la lance vers l'errorComponent de la route (RouteError).
  if (data === undefined) {
    return <CardsSkeleton />;
  }

  const { items, total } = data;
  const pageCount = Math.max(1, Math.ceil(total / filters.limit));
  const pagination = { pageIndex: search.page - 1, pageSize: filters.limit };
  const sorting = toSorting(search.sort);

  function handleSortingChange(updater) {
    const next = typeof updater === "function" ? updater(sorting) : updater;
    updateSearch({ sort: toSortParam(next), page: 1 });
  }

  function handlePaginationChange(updater) {
    const next = typeof updater === "function" ? updater(pagination) : updater;
    updateSearch({ page: next.pageIndex + 1, pageSize: next.pageSize });
  }

  return (
    <Panel title={`Mes cartes (${total})`}>
      <SearchBar
        query={search.q}
        onQueryChange={(q) => updateSearch({ q, page: 1 })}
        rarity={search.rarity}
        onRarityChange={(rarity) => updateSearch({ rarity, page: 1 })}
      />

      <div className="toolbar list-toolbar">
        <div className="view-switch" role="group" aria-label="Affichage">
          {[["grid", "Grille"], ["table", "Tableau"]].map(([view, label]) => (
            <button
              key={view}
              type="button"
              aria-pressed={search.view === view}
              onClick={() => updateSearch({ view, page: 1, pageSize: undefined })}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => refetch()} disabled={isFetching}>Actualiser</button>
        {isFetching && <span className="hint">Actualisation…</span>}
      </div>

      {status === "error" && (
        <p className="error" role="alert">
          La dernière actualisation a échoué ({error.message}).{" "}
          <button type="button" onClick={() => refetch()}>Réessayer</button>
        </p>
      )}

      <p className="sr-only" aria-live="polite">
        {total} carte{total > 1 ? "s" : ""} trouvée{total > 1 ? "s" : ""}, page {search.page} sur {pageCount}.
      </p>

      <div className={`results${isFetching ? " is-fetching" : ""}`} aria-busy={isFetching}>
        {search.view === "table" ? (
          <CardsTable
            cards={items}
            rowCount={total}
            sorting={sorting}
            onSortingChange={handleSortingChange}
            pagination={pagination}
            onPaginationChange={handlePaginationChange}
          />
        ) : (
          <>
            <CardGrid cards={items} />
            <nav className="pagination" aria-label="Pagination">
              <Link
                from={Route.fullPath}
                search={(previous) => ({ ...previous, page: previous.page - 1 })}
                disabled={search.page <= 1}
              >
                ← Précédent
              </Link>
              <span>Page {search.page} / {pageCount}</span>
              <Link
                from={Route.fullPath}
                search={(previous) => ({ ...previous, page: previous.page + 1 })}
                disabled={search.page >= pageCount}
              >
                Suivant →
              </Link>
            </nav>
          </>
        )}
      </div>
    </Panel>
  );
}
