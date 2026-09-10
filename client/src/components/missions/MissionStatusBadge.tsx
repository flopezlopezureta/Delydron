import type { MissionStatus } from '../../types';

const STYLES: Record<MissionStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  scheduled: 'bg-sky-100 text-sky-700',
  assigned: 'bg-indigo-100 text-indigo-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  aborted: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700',
};

const LABELS: Record<MissionStatus, string> = {
  draft: 'Borrador',
  scheduled: 'Programada',
  assigned: 'Asignada',
  in_progress: 'En vuelo',
  completed: 'Completada',
  aborted: 'Abortada',
  failed: 'Fallida',
};

export function MissionStatusBadge({ status }: { status: MissionStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
