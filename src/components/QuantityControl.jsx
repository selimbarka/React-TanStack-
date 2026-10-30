import { useChangeQuantity } from "../queries/cards";

export function QuantityControl({ card }) {
  const { mutate, isPending } = useChangeQuantity();

  function change(delta) {
    mutate({ id: card.id, quantity: Math.max(0, card.quantity + delta) });
  }

  return (
    <div className="quantity-control">
      <button
        type="button"
        aria-label="Retirer un exemplaire"
        onClick={() => change(-1)}
        disabled={isPending || card.quantity === 0}
      >
        −
      </button>
      <strong>{card.quantity}</strong>
      <button type="button" aria-label="Ajouter un exemplaire" onClick={() => change(1)} disabled={isPending}>
        +
      </button>
    </div>
  );
}
