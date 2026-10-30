import { useRemoveCard } from "../queries/cards";

// onRemove : appelé tout de suite (la suppression est optimiste), ex. pour quitter la page de détail.
export function RemoveCardButton({ cardId, onRemove }) {
  const { mutate, isPending } = useRemoveCard();

  function handleClick() {
    mutate(cardId);
    onRemove?.();
  }

  return (
    <button type="button" onClick={handleClick} disabled={isPending}>
      Retirer
    </button>
  );
}
