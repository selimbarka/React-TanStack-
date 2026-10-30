// Outils communs aux mises à jour optimistes.

// Remet en cache les données sauvegardées par getQueriesData dans onMutate.
export function restoreSnapshot(queryClient, snapshot = []) {
  for (const [queryKey, data] of snapshot) {
    queryClient.setQueryData(queryKey, data);
  }
}

// Plusieurs mutations peuvent se chevaucher (clics rapides sur plusieurs cartes).
// On ne resynchronise qu'à la fin de la dernière : sinon le refetch déclenché par
// la première écraserait la mise à jour optimiste des suivantes, encore en vol.
export function invalidateWhenIdle(queryClient, key) {
  if (queryClient.isMutating({ mutationKey: key }) === 1) {
    queryClient.invalidateQueries({ queryKey: key });
  }
}
