import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getDeliveryPoint, confirmDeliveryPoint } from '../api/deliveryPoint';
import { DeliveryPointMap } from '../components/deliveryPoint/DeliveryPointMap';
import type { DeliveryPointInfo } from '../types';

// Public, unauthenticated page — the PEC (punto de entrega cliente) flow.
// Reached straight from the per-destination link shared with that one
// recipient (see the "Copiar link PEC" button in WaypointList); the token
// scopes this to a single destination inside a mission, never the whole
// mission or any other recipient's point.
export function DeliveryPointPage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<DeliveryPointInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [draftPoint, setDraftPoint] = useState<{ lat: number; lon: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    getDeliveryPoint(token)
      .then((data) => {
        setInfo(data);
        setDraftPoint({ lat: data.lat, lon: data.lon });
      })
      .catch(() => setNotFound(true));
  }, [token]);

  function handleMove(lat: number, lon: number) {
    setError(null);
    setDraftPoint({ lat, lon });
  }

  async function handleConfirm() {
    if (!token || !draftPoint) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await confirmDeliveryPoint(token, draftPoint.lat, draftPoint.lon);
      setInfo(updated);
      setDraftPoint({ lat: updated.lat, lon: updated.lon });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el punto.');
    } finally {
      setSaving(false);
    }
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="max-w-sm text-center">
          <h1 className="mb-2 text-lg font-semibold text-slate-800">Delydrone</h1>
          <p className="text-sm text-slate-500">No encontramos este punto de entrega. Verifica que el link esté completo.</p>
        </div>
      </div>
    );
  }

  if (!info || !draftPoint) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <p className="text-sm text-slate-500">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-lg">
        <header className="mb-4 text-center">
          <h1 className="text-lg font-semibold text-slate-800">Delydrone</h1>
          <p className="text-xs text-slate-400">
            Confirma dónde quieres recibir tu envío{info.missionCode ? ` — ${info.missionCode}` : ''}
          </p>
        </header>

        <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
          {info.packageDesc && <p className="text-sm font-medium text-slate-700">{info.packageDesc}</p>}
          {info.address && <p className="text-xs text-slate-500">{info.address}</p>}
          {info.confirmedAt && (
            <p className="mt-1 text-xs text-emerald-600">
              Punto confirmado el {new Date(info.confirmedAt).toLocaleString('es-CL')}
            </p>
          )}
          {!info.editable && (
            <p className="mt-2 rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-700">
              Este envío ya está en camino o fue completado — el punto de entrega ya no se puede modificar.
            </p>
          )}
        </div>

        <div className="mb-3 overflow-hidden rounded-lg border border-slate-200" style={{ height: 320 }}>
          <DeliveryPointMap
            originalPoint={{ lat: info.lat, lon: info.lon }}
            currentPoint={draftPoint}
            maxAdjustM={info.maxAdjustM}
            editable={info.editable}
            onMove={handleMove}
          />
        </div>

        {info.editable && (
          <>
            <p className="mb-3 text-xs text-slate-500">
              Arrastra el pin o toca el mapa para ajustar el punto exacto de entrega, dentro del área marcada
              (hasta {info.maxAdjustM} m del punto original).
            </p>
            {error && <p className="mb-3 rounded bg-red-50 px-2 py-1.5 text-xs text-red-700">{error}</p>}
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="w-full rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Confirmar este punto'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
