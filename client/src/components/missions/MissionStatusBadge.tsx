import type { MissionStatus } from '../../types';

export const MISSION_STATUS_STYLES: Record<MissionStatus, string> = {
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300',
  scheduled: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300',
  assigned: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
  aborted: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
};

export const MISSION_STATUS_LABELS: Record<MissionStatus, string> = {
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
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${MISSION_STATUS_STYLES[status]}`}>
      {MISSION_STATUS_LABELS[status]}
    </span>
  );
}
