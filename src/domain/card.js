import { z } from "zod";

export const RARITIES = Object.freeze(["commune", "peu-commune", "rare", "ultra-rare"]);
export const SETS = Object.freeze(["Set de Base", "Jungle", "Fossile"]);

const priceFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export function parseRarity(value) {
  return RARITIES.find((rarity) => rarity === value);
}

export function isRare(card) {
  return card.rarity === "rare" || card.rarity === "ultra-rare";
}

export function formatPrice(price) {
  return priceFormatter.format(price);
}

export function copyCount(cards) {
  return cards.reduce((sum, card) => sum + card.quantity, 0);
}

export function collectionValue(cards) {
  return cards.reduce((sum, card) => sum + card.price * card.quantity, 0);
}

export function parsePrice(text) {
  return Number(text.trim().replace(",", "."));
}

// Valide les valeurs (texte) du formulaire d'ajout ET les convertit :
// newCardSchema.parse(values) renvoie { name, set, rarity, price: number, quantity: number }.
export const newCardSchema = z.object({
  name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères (hors espaces)."),
  set: z.enum(SETS),
  rarity: z.enum(RARITIES),
  price: z
    .string()
    .trim()
    .min(1, "Le prix est obligatoire.")
    .transform(parsePrice)
    .pipe(
      z
        .number({ error: "Le prix doit être un nombre." })
        .min(0, "Le prix doit être positif ou nul.")
    ),
  quantity: z
    .string()
    .trim()
    .min(1, "La quantité est obligatoire.")
    .transform(Number)
    .pipe(
      z
        .number({ error: "La quantité doit être un nombre." })
        .int("La quantité doit être un entier.")
        .min(1, "La quantité doit être au moins 1.")
    ),
});
