import { useState } from 'react';
import { ABORT_REASON_LABELS, type AbortReasonCode } from '../../types';

// Codes an operator can plausibly pick by hand — the others
// (low_battery_diversion, battery_depleted, emergency_stop,
// return_to_home_manual) are outcomes the system or a dedicated button
// records on its own, not something to choose from a cancel dialog.
const OPERATOR_SELECTABLE_CODES: AbortReasonCode[] = [
  'operator_abort',
  'weather',
  'hardware_fault',
  'payload_fault',
  'airspace_conflict',
  'other',
];

interface AbortMissionDialogProps {
  missionCode: string | null;
  onConfirm: (reasonCode: AbortReasonCode, reason: string) => void;
  onCancel: () => void;
}

export function AbortMissionDialog({ missionCode, onConfirm, onCancel }: AbortMissionDialogProps) {
  const [reasonCode, setReasonCode] = useState<AbortReasonCode>('operator_abort');
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-4 shadow-xl">
        <h2 className="mb-1 text-sm font-semibold text-slate-800">
          Cancelar misión{missionCode ? ` ${missionCode}` : ''}
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          El motivo queda registrado en el historial de la misión y en la auditoría.
        </p>

        <label className="mb-1 block text-xs text-slate-600">Motivo</label>
        <select
          value={reasonCode}
          onChange={(e) => setReasonCode(e.target.value as AbortReasonCode)}
          className="mb-3 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        >
          {OPERATOR_SELECTABLE_CODES.map((code) => (
            <option key={code} value={code}>
              {ABORT_REASON_LABELS[code]}
            </option>
          ))}
        </select>

        <label className="mb-1 block text-xs text-slate-600">Detalle (opcional)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          className="mb-4 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          placeholder="Ej: cliente pidió reprogramar"
        />

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Volver
          </button>
          <button
            onClick={() => onConfirm(reasonCode, reason)}
            className="rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-500"
          >
            Confirmar cancelación
          </button>
        </div>
      </div>
    </div>
  );
}
