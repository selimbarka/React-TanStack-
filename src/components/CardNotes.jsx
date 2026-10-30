import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { noteKeys, noteQueryOptions, useSaveNote } from "../queries/notes";
import { ErrorBoundary } from "./ErrorBoundary";
import { Panel } from "./Panel";

const AUTOSAVE_DELAY_MS = 800;

// La note est secondaire : si elle ne se charge pas, seul ce panneau affiche l'erreur
// (la carte reste affichée). resetKey : changer de carte retente le chargement.
export function CardNotes({ cardId }) {
  return (
    <ErrorBoundary fallback={NotesError} resetKey={cardId}>
      <NotesEditor cardId={cardId} />
    </ErrorBoundary>
  );
}

function NotesError({ error, reset }) {
  return (
    <Panel title="Notes">
      <p className="error" role="alert">
        Note indisponible ({error.message}).{" "}
        <button type="button" onClick={reset}>Réessayer</button>
      </p>
    </Panel>
  );
}

function NotesEditor({ cardId }) {
  const queryClient = useQueryClient();
  // Erreur sans note en cache : lancée (throwOnError) vers l'ErrorBoundary ci-dessus.
  const { data: note, status } = useQuery(noteQueryOptions(cardId));
  const { mutate: saveNote, status: saveStatus, variables: saving } = useSaveNote();

  // Brouillon local, étiqueté avec la carte à laquelle il appartient : { cardId, text } | null.
  // Un brouillon d'une autre carte est simplement ignoré : pas besoin de `key` pour le remettre à zéro.
  const [draft, setDraft] = useState(null);
  const debouncedDraft = useDebouncedValue(draft, AUTOSAVE_DELAY_MS);

  const savedText = note?.text ?? "";
  const text = draft?.cardId === cardId ? draft.text : savedText;

  // Sauvegarde automatique 800 ms après la dernière frappe.
  // Dépend seulement du brouillon temporisé : la carte cible est celle du brouillon.
  useEffect(() => {
    if (debouncedDraft === null) return;
    const saved = queryClient.getQueryData(noteKeys.detail(debouncedDraft.cardId));
    if (debouncedDraft.text !== (saved?.text ?? "")) {
      saveNote(debouncedDraft);
    }
  }, [debouncedDraft, queryClient, saveNote]);

  const isOwnSave = saving?.cardId === cardId;
  let indicator = note ? "Enregistré" : "Aucune note pour l'instant.";
  if (isOwnSave && saveStatus === "error") indicator = "Échec de l'enregistrement.";
  else if (text !== savedText) indicator = "Enregistrement…";

  return (
    <Panel title="Notes">
      <div className="details">
        <textarea
          aria-label="Note sur la carte"
          value={text}
          disabled={status === "pending"}
          placeholder={status === "pending" ? "Chargement de la note…" : "Écrivez une note…"}
          onChange={(e) => setDraft({ cardId, text: e.target.value })}
        />
        <p className="hint" aria-live="polite">
          {text.length} caractère(s) · {indicator}
        </p>
      </div>
    </Panel>
  );
}
