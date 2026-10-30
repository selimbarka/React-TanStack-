import { useQuery } from "@tanstack/react-query";
import { createRootRouteWithContext, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { FavoritesCount } from "../components/FavoritesCount";
import { NotFound } from "../components/NotFound";
import { RouteError } from "../components/RouteError";
import { Summary } from "../components/Summary";
import { Toaster } from "../components/Toaster";
import { collectionValue, formatPrice } from "../domain/card";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { allCardsQueryOptions } from "../queries/cards";

// Le contexte ({ queryClient }) est fourni par createRouter dans main.jsx
// et transmis à tous les loaders.
export const Route = createRootRouteWithContext()({
  component: RootLayout,
  // Dernier filet : une erreur de rendu dans le layout lui-même.
  errorComponent: RouteError,
  notFoundComponent: () => <NotFound>Cette adresse ne correspond à aucune page.</NotFound>,
});

const activeProps = { className: "active" };

function HeaderSummary() {
  const { data } = useQuery(allCardsQueryOptions());
  const cards = data?.items ?? [];

  useDocumentTitle(`Ma collection (${formatPrice(collectionValue(cards))})`);

  return data ? <Summary cards={cards} /> : <p className="summary">Calcul du résumé…</p>;
}

function HeaderError({ reset }) {
  return (
    <p className="summary error" role="alert">
      Résumé indisponible.{" "}
      <button type="button" onClick={reset}>Réessayer</button>
    </p>
  );
}

function RootLayout() {
  // Une navigation attend un loader : petit indicateur global.
  const isNavigating = useRouterState({ select: (state) => state.isLoading });

  return (
    <main className="app">
      <header className="app-header">
        <h1>Ma collection TCG</h1>
        {/* Si le résumé échoue, seul l'en-tête affiche l'erreur : navigation et page restent utilisables. */}
        <ErrorBoundary fallback={HeaderError}>
          <HeaderSummary />
          <FavoritesCount />
        </ErrorBoundary>
      </header>

      <nav className="nav" aria-label="Navigation principale">
        <Link to="/" activeOptions={{ exact: true, includeSearch: false }} activeProps={activeProps}>
          Collection
        </Link>
        <Link to="/favorites" activeProps={activeProps}>Favoris</Link>
        <Link to="/add" activeProps={activeProps}>Ajouter</Link>
        {isNavigating && <span className="hint" role="status">Chargement…</span>}
      </nav>

      <Outlet />

      <Toaster />
      {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-left" />}
    </main>
  );
}
