import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CardGrid } from "../components/CardGrid";
import { Panel } from "../components/Panel";
import { RouteError } from "../components/RouteError";
import { CardsSkeleton } from "../components/Skeletons";
import { allCardsQueryOptions } from "../queries/cards";
import { favoritesQueryOptions, useFavoriteIds } from "../queries/favorites";

export const Route = createFileRoute("/favorites")({
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(allCardsQueryOptions()),
      queryClient.ensureQueryData(favoritesQueryOptions()),
    ]),
  pendingComponent: CardsSkeleton,
  errorComponent: RouteError,
  component: FavoritesPage,
});

function FavoritesPage() {
  const { data } = useSuspenseQuery(allCardsQueryOptions());
  const favoriteIds = useFavoriteIds();
  // Croisement en mémoire de deux requêtes déjà en cache : aucune requête par carte.
  const favoriteCards = data.items.filter((card) => favoriteIds.has(card.id));

  return (
    <Panel title={`Mes favoris (${favoriteCards.length})`}>
      <CardGrid cards={favoriteCards} emptyMessage="Aucun favori pour l'instant : cliquez sur ☆ sur une carte." />
    </Panel>
  );
}
