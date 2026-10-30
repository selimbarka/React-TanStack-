import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { createCard, deleteCard, fetchCard, fetchCards, patchCard } from "../api/cards";
import { favoriteKeys } from "./favorites";
import { noteKeys } from "./notes";
import { invalidateWhenIdle, restoreSnapshot } from "./optimistic";

export const cardKeys = {
  all: ["cards"],
  lists: () => [...cardKeys.all, "list"],
  list: (filters) => [...cardKeys.lists(), filters],
  detail: (id) => [...cardKeys.all, "detail", id],
};

// Une page de cartes : { items, total }.
export function cardsQueryOptions(filters) {
  return queryOptions({
    queryKey: cardKeys.list(filters),
    queryFn: () => fetchCards(filters),
  });
}

// Toute la collection (résumé de l'en-tête, page des favoris).
export function allCardsQueryOptions() {
  return cardsQueryOptions({});
}

export function cardQueryOptions(id) {
  return queryOptions({
    queryKey: cardKeys.detail(id),
    queryFn: () => fetchCard(id),
  });
}

// Applique `update` à la carte `id` partout où elle est en cache (listes et détail),
// en immuable : on ne modifie jamais un objet du cache, on le remplace.
function updateCachedCard(queryClient, id, update) {
  queryClient.setQueriesData({ queryKey: cardKeys.lists() }, (data) =>
    data && { ...data, items: data.items.map((card) => (card.id === id ? update(card) : card)) }
  );
  queryClient.setQueryData(cardKeys.detail(id), (card) => card && update(card));
}

function removeFromList(data, id) {
  const items = data.items.filter((card) => card.id !== id);
  return items.length === data.items.length ? data : { items, total: data.total - 1 };
}

export function useChangeQuantity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: cardKeys.all,
    mutationFn: ({ id, quantity }) => patchCard(id, { quantity }),
    meta: { errorMessage: "La quantité n'a pas pu être modifiée." },
    onMutate: async ({ id, quantity }) => {
      // Un refetch en cours écraserait notre modification optimiste à son retour.
      await queryClient.cancelQueries({ queryKey: cardKeys.all });
      const previous = queryClient.getQueriesData({ queryKey: cardKeys.all });
      updateCachedCard(queryClient, id, (card) => ({ ...card, quantity }));
      return { previous };
    },
    onError: (_error, _variables, context) => restoreSnapshot(queryClient, context?.previous),
    onSettled: () => invalidateWhenIdle(queryClient, cardKeys.all),
  });
}

export function useRemoveCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: cardKeys.all,
    mutationFn: (id) => deleteCard(id),
    meta: { errorMessage: "La carte n'a pas pu être retirée." },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: cardKeys.lists() });
      const previous = queryClient.getQueriesData({ queryKey: cardKeys.lists() });
      queryClient.setQueriesData({ queryKey: cardKeys.lists() }, (data) => data && removeFromList(data, id));
      return { previous };
    },
    onError: (_error, _id, context) => restoreSnapshot(queryClient, context?.previous),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: cardKeys.detail(id) });
      queryClient.removeQueries({ queryKey: noteKeys.detail(id) });
      // json-server supprime en cascade les favoris et notes qui pointent vers la carte (cardId).
      queryClient.invalidateQueries({ queryKey: favoriteKeys.all });
    },
    onSettled: () => invalidateWhenIdle(queryClient, cardKeys.all),
  });
}

export function useAddCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (card) => createCard(card),
    meta: { errorMessage: "La carte n'a pas pu être ajoutée." },
    onSuccess: (card) => {
      queryClient.setQueryData(cardKeys.detail(card.id), card);
      // Renvoyer la promesse : la mutation reste « en cours » jusqu'au rafraîchissement des listes.
      return queryClient.invalidateQueries({ queryKey: cardKeys.lists() });
    },
  });
}
