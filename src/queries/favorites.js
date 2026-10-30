import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFavorite, deleteFavorite, fetchFavorites } from "../api/favorites";
import { invalidateWhenIdle } from "./optimistic";

export const favoriteKeys = {
  all: ["favorites"],
};

// Liste brute du serveur : [{ id, cardId }].
export function favoritesQueryOptions() {
  return queryOptions({
    queryKey: favoriteKeys.all,
    queryFn: fetchFavorites,
  });
}

// Défini hors du composant : `select` n'est recalculé que si les données changent.
function toFavoriteIds(favorites) {
  return new Set(favorites.map((favorite) => favorite.cardId));
}

const NO_FAVORITES = new Set();

// Dérivé des données du serveur, jamais stocké.
export function useFavoriteIds() {
  const { data } = useQuery({ ...favoritesQueryOptions(), select: toFavoriteIds });
  return data ?? NO_FAVORITES;
}

function optimisticId(cardId) {
  return `optimistic-${cardId}`;
}

// Variables : { cardId, favoriteId }. favoriteId = id de l'entrée existante
// (on la supprime) ou undefined (on en crée une).
export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: favoriteKeys.all,
    mutationFn: ({ cardId, favoriteId }) =>
      favoriteId === undefined ? createFavorite(cardId) : deleteFavorite(favoriteId),
    meta: { errorMessage: "Le favori n'a pas pu être modifié." },
    onMutate: async ({ cardId, favoriteId }) => {
      await queryClient.cancelQueries({ queryKey: favoriteKeys.all });
      const previous = queryClient.getQueryData(favoriteKeys.all);
      queryClient.setQueryData(favoriteKeys.all, (favorites = []) =>
        favoriteId === undefined
          ? [...favorites, { id: optimisticId(cardId), cardId }]
          : favorites.filter((favorite) => favorite.id !== favoriteId)
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(favoriteKeys.all, context?.previous);
    },
    onSuccess: (created, { cardId, favoriteId }) => {
      // Remplace l'entrée provisoire par la vraie (avec l'id du serveur),
      // pour qu'un second clic puisse la supprimer sans attendre le refetch.
      if (favoriteId === undefined) {
        queryClient.setQueryData(favoriteKeys.all, (favorites = []) =>
          favorites.map((favorite) => (favorite.id === optimisticId(cardId) ? created : favorite))
        );
      }
    },
    onSettled: () => invalidateWhenIdle(queryClient, favoriteKeys.all),
  });
}
