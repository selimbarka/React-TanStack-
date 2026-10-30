import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HttpError } from "./api/client";
import { showToast } from "./hooks/useToasts";
import { routeTree } from "./routeTree.gen";
import "./index.css";

// Inutile de réessayer une erreur 4xx (carte inexistante…) : la réponse ne changera pas.
function shouldRetry(failureCount, error) {
  if (error instanceof HttpError && error.status >= 400 && error.status < 500) {
    return false;
  }
  return failureCount < 3;
}

// Créé une seule fois, hors de tout composant : c'est LE cache de l'application.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: shouldRetry,
      // Erreur sans données à montrer : elle est lancée vers l'Error Boundary la plus proche
      // (errorComponent de la route ou <ErrorBoundary> locale). Avec des données déjà
      // affichées, on les garde et c'est le toast du QueryCache qui prévient.
      throwOnError: (_error, query) => query.state.data === undefined,
    },
  },
  // Gestion d'erreur globale : un seul endroit affiche les toasts.
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Échec d'un rafraîchissement en arrière-plan : les anciennes données restent affichées.
      if (query.state.data !== undefined) {
        showToast(`Actualisation impossible (${error.message}).`);
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      showToast(mutation.meta?.errorMessage ?? `Erreur : ${error.message}`);
    },
  }),
});

const router = createRouter({
  routeTree,
  context: { queryClient },
  // Survol (ou focus) d'un lien : on lance ses loaders avant le clic.
  defaultPreload: "intent",
  // La fraîcheur est gérée par TanStack Query : le routeur rappelle toujours le loader.
  defaultPreloadStaleTime: 0,
  // Squelette affiché si un loader dépasse 200 ms (au lieu de 1 s par défaut).
  defaultPendingMs: 200,
  scrollRestoration: true,
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      {import.meta.env.DEV && <ReactQueryDevtools buttonPosition="bottom-right" />}
    </QueryClientProvider>
  </StrictMode>
);
