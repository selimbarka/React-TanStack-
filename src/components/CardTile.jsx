import { Link } from "@tanstack/react-router";
import { formatPrice, isRare } from "../domain/card";
import { RarityBadge } from "./RarityBadge";
import { FavoriteButton } from "./FavoriteButton";

export function CardTile({ card, children }) {
  return (
    <article className={`card-tile rarity-${card.rarity}`}>
      <div className="actions">
        <h3>
          <Link to="/cards/$cardId" params={{ cardId: card.id }}>{card.name}</Link>
        </h3>
        <FavoriteButton cardId={card.id} />
      </div>
      <RarityBadge rarity={card.rarity} />
      <p className="meta">{card.set}</p>
      <p className="price">{formatPrice(card.price)}</p>
      {isRare(card) && <p className="highlight">★ Carte rare</p>}
      {card.quantity === 0 && <p className="sold-out">Plus aucun exemplaire</p>}
      {children && <div className="actions">{children}</div>}
    </article>
  );
}
