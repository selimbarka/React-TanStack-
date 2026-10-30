import { request } from "./client";

// Une carte a au plus une note : { id, cardId, text }. `null` si aucune.
export async function fetchNote(cardId) {
  const response = await request(`/notes?cardId=${encodeURIComponent(cardId)}`);
  const notes = await response.json();
  return notes[0] ?? null;
}

export async function createNote(cardId, text) {
  const response = await request("/notes", { method: "POST", body: { cardId, text } });
  return response.json();
}

export async function patchNote(id, text) {
  const response = await request(`/notes/${encodeURIComponent(id)}`, { method: "PATCH", body: { text } });
  return response.json();
}
