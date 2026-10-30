const API_URL = "http://localhost:3001";

export class HttpError extends Error {
  constructor(status) {
    super(`HTTP ${status}`);
    this.name = "HttpError";
    this.status = status;
  }
}

// Point d'entrée unique vers le serveur : préfixe l'URL, sérialise le corps
// en JSON et transforme toute réponse non-2xx en erreur.
export async function request(path, { body, ...options } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    throw new HttpError(response.status);
  }
  return response;
}
