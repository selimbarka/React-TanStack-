import { request } from "./client";

export async function fetchFavorites() {
  const response = await request("/favorites");
  return response.json();
}

export async function createFavorite(cardId) {
  const response = await request("/favorites", { method: "POST", body: { cardId } });
  return response.json();
}

export async function deleteFavorite(id) {
  await request(`/favorites/${encodeURIComponent(id)}`, { method: "DELETE" });
}
