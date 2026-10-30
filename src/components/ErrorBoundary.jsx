import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { Component } from "react";

// Une Error Boundary ne peut être qu'une classe : React n'a pas de hook équivalent.
class Boundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(previousProps) {
    // Le contenu a changé (ex. autre carte) : on retente au lieu de garder l'ancienne erreur.
    if (this.state.error !== null && previousProps.resetKey !== this.props.resetKey) {
      this.reset();
    }
  }

  reset = () => {
    this.props.onReset();
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    const Fallback = this.props.fallback;
    return error === null ? this.props.children : <Fallback error={error} reset={this.reset} />;
  }
}

// Error Boundary locale : seule la zone qu'elle entoure est remplacée par `fallback`
// (qui reçoit { error, reset }, comme un errorComponent du routeur).
// Elle rattrape les erreurs de rendu ET les erreurs de requête lancées par throwOnError.
export function ErrorBoundary({ fallback, resetKey, children }) {
  // reset() autorise les requêtes en erreur à repartir quand la zone est réaffichée ;
  // sans lui, elles relanceraient aussitôt la même erreur, sans nouvelle requête.
  const { reset } = useQueryErrorResetBoundary();
  return (
    <Boundary fallback={fallback} resetKey={resetKey} onReset={reset}>
      {children}
    </Boundary>
  );
}
