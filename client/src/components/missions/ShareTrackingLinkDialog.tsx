import { useRef, useState } from 'react';

interface ShareTrackingLinkDialogProps {
  missionCode: string | null;
  url: string;
  onClose: () => void;
}

// The link itself is always visible and selectable — that's the real
// fallback, not navigator.clipboard (which can be denied by browser
// permissions or an embedding context) and not window.prompt (unavailable
// in some embedded/automated browsers). The "Copiar" button is a
// convenience on top, never the only way to get the link.
export function ShareTrackingLinkDialog({ missionCode, url, onClose }: ShareTrackingLinkDialogProps) {
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      inputRef.current?.select();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-4 shadow-xl">
        <h2 className="mb-1 text-sm font-semibold text-slate-800">
          Link de seguimiento{missionCode ? ` — ${missionCode}` : ''}
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          Cualquiera con este link puede ver el estado del envío, sin necesidad de cuenta.
        </p>

        <input
          ref={inputRef}
          readOnly
          value={url}
          onFocus={(e) => e.target.select()}
          className="mb-3 w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-xs text-slate-700"
        />

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cerrar
          </button>
          <button
            onClick={handleCopy}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            {copied ? '¡Copiado!' : 'Copiar'}
          </button>
        </div>
      </div>
    </div>
  );
}
