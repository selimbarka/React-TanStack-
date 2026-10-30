import { copyCount, collectionValue, formatPrice } from "../domain/card";

export function Summary({ cards }) {
  return (
    <p className="summary">
      {cards.length} cartes · {copyCount(cards)} exemplaires · {formatPrice(collectionValue(cards))}
    </p>
  );
}