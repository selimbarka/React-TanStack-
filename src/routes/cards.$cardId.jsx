import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { HttpError } from "../api/client";
import { CardNotes } from "../components/CardNotes";
import { FavoriteButton } from "../components/FavoriteButton";
import { NotFound } from "../components/NotFound";
import { Panel } from "../components/Panel";
import { QuantityControl } from "../components/QuantityControl";
import { RarityBadge } from "../components/RarityBadge";
import { RemoveCardButton } from "../components/RemoveCardButton";
import { RouteError } from "../components/RouteError";
import { DetailSkeleton } from "../components/Skeletons";
import { formatPrice, isRare } from "../domain/card";
import { cardQueryOptions } from "../queries/cards";
import { noteQueryOptions } from "../queries/notes";

export const Route = createFileRoute("/cards/$cardId")({
  loader: async ({ context: { queryClient }, params: { cardId } }) => {
    // La note part en parallèle (sans l'attendre) : pas de cascade carte → note.
    queryClient.prefetchQuery(noteQueryOptions(cardId));
    try {
      await queryClient.ensureQueryData(cardQueryOptions(cardId));
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) {
        throw notFound();
      }
      throw error;
    }
  },
  pendingComponent: DetailSkeleton,
  errorComponent: RouteError,
  notFoundComponent: () => (
    <NotFound title="Carte introuvable">Cette carte n'existe pas (ou plus) dans la collection.</NotFound>
  ),
  component: CardDetailPage,
});

function CardDetailPage() {
  const { cardId } = Route.useParams();
  const navigate = useNavigate();
  // Déjà en cache grâce au loader : `card` n'est jamais undefined.
  const { data: card } = useSuspenseQuery(cardQueryOptions(cardId));

  return (
    <>
      <Link to="/">← Retour à la collection</Link>

      <Panel title={card.name}>
        <article className={`card-detail rarity-${card.rarity}`}>
          <div className="actions">
            <RarityBadge rarity={card.rarity} />
            {isRare(card) && <span className="highlight">★ Carte rare</span>}
            <FavoriteButton cardId={card.id} />
          </div>
          <dl className="card-facts">
            <dt>Extension</dt>
            <dd>{card.set}</dd>
            <dt>Prix unitaire</dt>
            <dd>{formatPrice(card.price)}</dd>
            <dt>Exemplaires</dt>
            <dd><QuantityControl card={card} /></dd>
            <dt>Valeur</dt>
            <dd>{formatPrice(card.price * card.quantity)}</dd>
          </dl>
          <div className="actions">
            <RemoveCardButton cardId={card.id} onRemove={() => navigate({ to: "/" })} />
          </div>
        </article>
      </Panel>

      <CardNotes cardId={card.id} />
    </>
  );
}
