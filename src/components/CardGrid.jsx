import { CardTile } from "./CardTile";
import { QuantityControl } from "./QuantityControl";
import { RemoveCardButton } from "./RemoveCardButton";

export function CardGrid({ cards, emptyMessage = "Aucune carte à afficher." }) {
  if (cards.length === 0) {
    return <p className="hint">{emptyMessage}</p>;
  }
  return (
    <div className="grid">
      {cards.map((card) => (
        <CardTile key={card.id} card={card}>
          <QuantityControl card={card} />
          <RemoveCardButton cardId={card.id} />
        </CardTile>
      ))}
    </div>
  );
}
