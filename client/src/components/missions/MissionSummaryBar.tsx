import type { Mission } from '../../types';

interface MissionSummaryBarProps {
  missions: Mission[];
}

const GROUPS: { label: string; statuses: Mission['status'][]; dot: string }[] = [
  { label: 'Pendientes', statuses: ['draft', 'scheduled', 'assigned'], dot: 'bg-amber-500' },
  { label: 'En vuelo', statuses: ['in_progress'], dot: 'bg-blue-600' },
  { label: 'Completadas', statuses: ['completed'], dot: 'bg-emerald-600' },
  { label: 'Canceladas', statuses: ['aborted'], dot: 'bg-slate-400' },
  { label: 'Fallidas', statuses: ['failed'], dot: 'bg-red-600' },
];

// First thing a dispatcher wants on opening the app: how many orders need
// attention right now, without having to go count rows in the Misiones tab.
export function MissionSummaryBar({ missions }: MissionSummaryBarProps) {
  return (
    <div className="pointer-events-auto flex max-w-[calc(100vw-1.5rem)] flex-nowrap gap-2 overflow-x-auto rounded-lg bg-white/95 p-2 text-xs shadow-lg [-ms-overflow-style:none] [scrollbar-width:none] dark:bg-slate-900/95 [&::-webkit-scrollbar]:hidden">
      {GROUPS.map((g) => {
        const count = missions.filter((m) => g.statuses.includes(m.status)).length;
        return (
          <div key={g.label} className="flex shrink-0 items-center gap-1.5 rounded px-2 py-1">
            <span className={`h-2 w-2 rounded-full ${g.dot}`} />
            <span className="font-semibold text-slate-800 dark:text-slate-100">{count}</span>
            <span className="text-slate-500 dark:text-slate-400">{g.label}</span>
          </div>
        );
      })}
    </div>
  );
}
