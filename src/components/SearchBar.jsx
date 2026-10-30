import { useEffect, useEffectEvent, useRef, useState } from "react";
import { RARITIES, parseRarity } from "../domain/card";
import { useDebouncedValue } from "../hooks/useDebouncedValue";

const SEARCH_DEBOUNCE_MS = 300;

// `query` vient de l'URL ; le champ garde sa propre valeur pendant la frappe
// et ne publie la recherche (onQueryChange) qu'après 300 ms sans frappe.
export function SearchBar({ query, onQueryChange, rarity, onRarityChange }) {
  const inputRef = useRef(null);
  const [text, setText] = useState(query);
  const [previousQuery, setPreviousQuery] = useState(query);
  const debouncedText = useDebouncedValue(text, SEARCH_DEBOUNCE_MS);

  // L'URL a changé sans passer par la frappe (bouton « précédent », lien partagé…) :
  // on aligne le champ dessus, pendant le rendu (pas d'effet nécessaire).
  if (query !== previousQuery) {
    setPreviousQuery(query);
    setText(query);
  }

  // useEffectEvent : lit la DERNIÈRE valeur de `query` sans faire de `query` une dépendance.
  // Seul un changement du texte temporisé doit publier ; un changement d'URL
  // (bouton « précédent ») ne doit pas renvoyer l'ancien texte vers l'URL.
  const publish = useEffectEvent((value) => {
    if (value !== query) onQueryChange(value);
  });

  useEffect(() => {
    publish(debouncedText);
  }, [debouncedText]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setText("");
        onQueryChange("");
      } else if (event.key === "/" && document.activeElement !== inputRef.current) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onQueryChange]);

  function handleClear() {
    setText("");
    onQueryChange("");
    inputRef.current?.focus();
  }

  return (
    <div className="toolbar" role="search">
      <label>
        Recherche
        <input ref={inputRef} type="search" value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <button type="button" onClick={handleClear} disabled={text === ""}>
        Effacer
      </button>
      <label>
        Rareté
        <select
          value={rarity}
          onChange={(e) => onRarityChange(parseRarity(e.target.value) ?? "toutes")}
        >
          <option value="toutes">Toutes</option>
          {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </label>
    </div>
  );
}
