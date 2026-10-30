import { useFavoriteIds } from "../queries/favorites";

export function FavoritesCount() {
  const count = useFavoriteIds().size;
  return <p className="summary">★ {count} favori{count > 1 ? "s" : ""}</p>;
}
