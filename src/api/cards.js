import { request } from "./client";

// filters : { q, rarity, page, limit, sort } (tous optionnels).
// Sans `page`, le serveur renvoie toutes les cartes.
export async function fetchCards({ q, rarity, page, limit, sort } = {}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (rarity && rarity !== "toutes") params.set("rarity", rarity);
  if (sort) {
    const [field, order] = sort.split(".");
    params.set("_sort", field);
    params.set("_order", order);
  }
  if (page) {
    params.set("_page", String(page));
    params.set("_limit", String(limit));
  }
  const response = await request(`/cards?${params}`);
  const items = await response.json();
  // json-server ne renvoie X-Total-Count que lorsqu'on pagine.
  const total = Number(response.headers.get("X-Total-Count") ?? items.length);
  return { items, total };
}

export async function fetchCard(id) {
  const response = await request(`/cards/${encodeURIComponent(id)}`);
  return response.json();
}

export async function findCardsByName(name, { signal } = {}) {
  const response = await request(`/cards?name=${encodeURIComponent(name)}`, { signal });
  return response.json();
}

// Pas d'`id` : c'est json-server qui le génère.
export async function createCard(card) {
  const response = await request("/cards", { method: "POST", body: card });
  return response.json();
}

export async function patchCard(id, patch) {
  const response = await request(`/cards/${encodeURIComponent(id)}`, { method: "PATCH", body: patch });
  return response.json();
}

export async function deleteCard(id) {
  await request(`/cards/${encodeURIComponent(id)}`, { method: "DELETE" });
}
