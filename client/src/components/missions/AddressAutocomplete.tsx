import { useEffect, useRef, useState } from 'react';
import { searchAddresses, type AddressSuggestion } from '../../api/geocoding';

const DEBOUNCE_MS = 400;
const MIN_CHARS = 4;

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: AddressSuggestion) => void;
  placeholder?: string;
}

// Search-as-you-type with visible candidates, instead of a single blind
// geocode behind a "Marcar" button — the whole point is letting the operator
// SEE what was actually matched (does the result include the house number?
// the right comuna?) before it becomes a flight destination, since a wrong
// silent match is worse than an obvious failure.
export function AddressAutocomplete({ value, onChange, onSelect, placeholder }: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (value.trim().length < MIN_CHARS) {
      setSuggestions([]);
      setError(null);
      setLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchAddresses(value);
        if (requestIdRef.current !== requestId) return; // a newer keystroke already superseded this
        setSuggestions(results);
        setOpen(true);
        setError(
          results.length === 0
            ? 'No encontramos esa dirección. Prueba con menos detalle o marca el punto directo en el mapa.'
            : null
        );
      } catch (err) {
        if (requestIdRef.current !== requestId) return;
        setSuggestions([]);
        setError(err instanceof Error ? err.message : 'No se pudo buscar la dirección.');
      } finally {
        if (requestIdRef.current === requestId) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [value]);

  function handleSelect(s: AddressSuggestion) {
    setOpen(false);
    setSuggestions([]);
    onSelect(s);
  }

  // If the operator typed a house number but none of the matches echo it
  // back, MapTiler almost certainly only found the street — Chile's OSM
  // address coverage drops off fast outside the well-mapped comunas, so
  // this is common, not a bug. Better a visible nudge than a silently wrong pin.
  const queryDigits = value.match(/\d+/)?.[0];
  const numberLikelyMissing =
    !!queryDigits && suggestions.length > 0 && !suggestions.some((s) => s.placeName.includes(queryDigits));

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && suggestions[0]) {
            e.preventDefault();
            handleSelect(suggestions[0]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />

      {loading && <p className="mt-1 text-xs text-slate-400">Buscando...</p>}
      {!loading && error && <p className="mt-1 text-xs text-amber-600">{error}</p>}
      {!loading && !error && numberLikelyMissing && (
        <p className="mt-1 text-xs text-amber-600">
          Puede que no hayamos encontrado el número exacto — revisa el pin en el mapa y ajústalo si hace falta.
        </p>
      )}

      {open && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded border border-slate-200 bg-white shadow-lg">
          {suggestions.map((s, i) => (
            <li key={`${s.lat},${s.lon},${i}`}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()} // keeps the input's onBlur from closing this before the click registers
                onClick={() => handleSelect(s)}
                className="block w-full px-2 py-1.5 text-left text-sm hover:bg-slate-50"
              >
                {s.placeName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
