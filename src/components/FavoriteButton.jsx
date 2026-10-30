import { useQuery } from "@tanstack/react-query";
import { favoritesQueryOptions, useToggleFavorite } from "../queries/favorites";

export function FavoriteButton({ cardId }) {
  // Le favori est secondaire : si la liste ne se charge pas, on ne fait pas échouer
  // toute la page (throwOnError: false) ; le bouton reste désactivé et l'erreur
  // est signalée par l'en-tête (FavoritesCount).
  const { data: favorites } = useQuery({ ...favoritesQueryOptions(), throwOnError: false });
  const { mutate, isPending } = useToggleFavorite();
  const favorite = favorites?.find((entry) => entry.cardId === cardId);
  const isFavorite = favorite !== undefined;

  return (
    <button
      type="button"
      className={`favorite${isFavorite ? " is-on" : ""}`}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
      // Tant que la liste n'est pas chargée, on ne sait pas s'il faut un POST ou un DELETE.
      disabled={isPending || favorites === undefined}
      onClick={() => mutate({ cardId, favoriteId: favorite?.id })}
    >
      {isFavorite ? "★" : "☆"}
    </button>
  );
}
