import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { createNote, fetchNote, patchNote } from "../api/notes";

export const noteKeys = {
  detail: (cardId) => ["notes", cardId],
};

// La note d'une carte ({ id, cardId, text }) ou null.
export function noteQueryOptions(cardId) {
  return queryOptions({
    queryKey: noteKeys.detail(cardId),
    queryFn: () => fetchNote(cardId),
  });
}

// Variables : { cardId, text }. Crée la note si elle n'existe pas encore, sinon la modifie.
export function useSaveNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, text }) => {
      const note = queryClient.getQueryData(noteKeys.detail(cardId));
      return note ? patchNote(note.id, text) : createNote(cardId, text);
    },
    // Les sauvegardes passent l'une après l'autre : la seconde voit la note créée
    // par la première (PATCH), au lieu de lancer un second POST en parallèle.
    scope: { id: "notes" },
    meta: { errorMessage: "La note n'a pas pu être enregistrée." },
    onSuccess: (note, { cardId }) => {
      queryClient.setQueryData(noteKeys.detail(cardId), note);
    },
  });
}
