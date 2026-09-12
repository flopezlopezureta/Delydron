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
    <div className="absolute left-3 top-3 z-[1000] flex gap-2 rounded-lg bg-white/95 p-2 text-xs shadow-lg">
      {GROUPS.map((g) => {
        const count = missions.filter((m) => g.statuses.includes(m.status)).length;
        return (
          <div key={g.label} className="flex items-center gap-1.5 rounded px-2 py-1">
            <span className={`h-2 w-2 rounded-full ${g.dot}`} />
            <span className="font-semibold text-slate-800">{count}</span>
            <span className="text-slate-500">{g.label}</span>
          </div>
        );
      })}
    </div>
  );
}
