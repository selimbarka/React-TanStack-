import { dismissToast, useToasts } from "../hooks/useToasts";

export function Toaster() {
  const toasts = useToasts();
  return (
    <div className="toaster">
      {toasts.map((toast) => (
        <p key={toast.id} className="toast" role="alert">
          {toast.message}
          <button type="button" aria-label="Fermer" onClick={() => dismissToast(toast.id)}>×</button>
        </p>
      ))}
    </div>
  );
}
