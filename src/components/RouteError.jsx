import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

// errorComponent des routes : reçoit l'erreur levée par le loader, par une requête
// (useSuspenseQuery, ou useQuery via throwOnError) ou par un bug de rendu.
export function RouteError({ error }) {
  const router = useRouter();
  const queryErrorResetBoundary = useQueryErrorResetBoundary();

  useEffect(() => {
    // Autorise les useSuspenseQuery en erreur à refaire leur requête au prochain rendu.
    queryErrorResetBoundary.reset();
  }, [queryErrorResetBoundary]);

  return (
    <section className="panel" role="alert">
      <h2>Oups, une erreur est survenue</h2>
      <p className="error">Erreur : {error.message}</p>
      {/* invalidate() relance les loaders et réinitialise les error boundaries du routeur. */}
      <button type="button" onClick={() => router.invalidate()}>Réessayer</button>
    </section>
  );
}
