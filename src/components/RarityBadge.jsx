export function RarityBadge({ rarity, label = rarity }) {
  return <span className={`badge badge-${rarity}`}>{label}</span>;
}