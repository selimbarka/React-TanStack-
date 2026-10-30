import { useForm } from "@tanstack/react-form";
import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { findCardsByName } from "../api/cards";
import { RARITIES, SETS, newCardSchema, parseRarity } from "../domain/card";
import { useAddCard } from "../queries/cards";

const DEFAULT_VALUES = { name: "", set: SETS[0], rarity: "commune", price: "", quantity: "1" };

// Validation asynchrone du nom : refuse un nom déjà présent dans la collection.
// `signal` est annulé par TanStack Form si l'utilisateur retape entre-temps.
async function checkNameIsFree({ value, signal }) {
  try {
    const matches = await findCardsByName(value.trim(), { signal });
    return matches.length > 0 ? "Cette carte est déjà dans la collection." : undefined;
  } catch {
    return "Impossible de vérifier le nom pour l'instant.";
  }
}

// Les erreurs sont des chaînes (validateur maison) ou des « issues » Zod ({ message, path }).
function FieldInfo({ field }) {
  const { isTouched, errors, isValidating } = field.state.meta;
  const messages = [...new Set(errors.map((error) => (typeof error === "string" ? error : error?.message)))];
  return (
    <>
      {isTouched && messages.length > 0 && (
        <span className="field-error" role="alert">{messages.join(" ")}</span>
      )}
      {isValidating && <span className="hint">Vérification…</span>}
    </>
  );
}

export function AddCardForm() {
  const nameRef = useRef(null);
  const [lastAdded, setLastAdded] = useState(null);
  const { mutateAsync: addCard } = useAddCard();

  const form = useForm({
    defaultValues: DEFAULT_VALUES,
    onSubmit: async ({ value, formApi }) => {
      // Le schéma valide ET convertit : prix « 3,5 » → 3.5, quantité « 2 » → 2, nom sans espaces autour.
      const card = newCardSchema.parse(value);
      try {
        const created = await addCard(card);
        setLastAdded(created);
        formApi.reset();
        nameRef.current?.focus();
      } catch {
        // L'erreur est déjà signalée par le toast global (MutationCache.onError).
      }
    },
  });

  function handleSubmit(event) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit();
  }

  return (
    <form className="add-form" noValidate onSubmit={handleSubmit}>
      {/* Validation par champ, avec le morceau correspondant du schéma Zod.
          Tant que la règle synchrone échoue, la vérification asynchrone ne part pas. */}
      <form.Field
        name="name"
        validators={{
          onChange: newCardSchema.shape.name,
          onChangeAsyncDebounceMs: 400,
          onChangeAsync: checkNameIsFree,
        }}
      >
        {(field) => (
          <label>
            Nom
            <input
              ref={nameRef}
              name={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            <FieldInfo field={field} />
          </label>
        )}
      </form.Field>

      <form.Field name="set">
        {(field) => (
          <label>
            Extension
            <select
              name={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            >
              {SETS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        )}
      </form.Field>

      <form.Field name="rarity">
        {(field) => (
          <label>
            Rareté
            <select
              name={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(parseRarity(e.target.value) ?? "commune")}
            >
              {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
        )}
      </form.Field>

      <form.Field name="price" validators={{ onChange: newCardSchema.shape.price }}>
        {(field) => (
          <label>
            Prix
            <input
              name={field.name}
              inputMode="decimal"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            <FieldInfo field={field} />
          </label>
        )}
      </form.Field>

      <form.Field name="quantity" validators={{ onChange: newCardSchema.shape.quantity }}>
        {(field) => (
          <label>
            Quantité
            <input
              name={field.name}
              type="number"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            <FieldInfo field={field} />
          </label>
        )}
      </form.Field>

      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
        {([canSubmit, isSubmitting]) => (
          <button type="submit" disabled={!canSubmit}>
            {isSubmitting ? "Ajout…" : "Ajouter la carte"}
          </button>
        )}
      </form.Subscribe>

      {lastAdded && (
        <p className="success" role="status">
          « {lastAdded.name} » a été ajoutée.{" "}
          <Link to="/cards/$cardId" params={{ cardId: lastAdded.id }}>Voir la carte</Link>
        </p>
      )}
    </form>
  );
}
