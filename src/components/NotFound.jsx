import { Link } from "@tanstack/react-router";

export function NotFound({ title = "Page introuvable", children }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {children && <p className="hint">{children}</p>}
      <Link to="/">← Retour à la collection</Link>
    </section>
  );
}
