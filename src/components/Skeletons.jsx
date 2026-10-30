// Squelettes de chargement (pendingComponent des routes).

export function CardsSkeleton() {
  return (
    <section className="panel" aria-busy="true" aria-label="Chargement des cartes">
      <div className="grid">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="card-tile skeleton" />
        ))}
      </div>
    </section>
  );
}

export function DetailSkeleton() {
  return (
    <section className="panel" aria-busy="true" aria-label="Chargement de la carte">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-text" />
      <div className="skeleton skeleton-text" />
    </section>
  );
}
