import type { Drone, DroneStatus } from '../../types';

const GROUPS: { label: string; statuses: DroneStatus[]; dot: string }[] = [
  { label: 'Libres', statuses: ['idle'], dot: 'bg-emerald-600' },
  { label: 'En vuelo', statuses: ['in_flight', 'unloading', 'returning', 'armed'], dot: 'bg-blue-600' },
  { label: 'Cargando', statuses: ['charging'], dot: 'bg-amber-500' },
  { label: 'Mantención', statuses: ['maintenance'], dot: 'bg-orange-600' },
  { label: 'Fuera de línea', statuses: ['offline', 'error'], dot: 'bg-red-600' },
];

interface FleetCapacityBarProps {
  drones: Drone[];
}

// Answers "can today's mission queue actually be served right now?" at a
// glance — each drone's own status already lives in Configuración, but
// nothing aggregated it into one fleet-wide read before.
export function FleetCapacityBar({ drones }: FleetCapacityBarProps) {
  return (
    <div className="absolute bottom-3 right-3 z-[1000] flex max-w-[calc(100vw-1.5rem)] flex-nowrap gap-2 overflow-x-auto rounded-lg bg-white/95 p-2 text-xs shadow-lg [-ms-overflow-style:none] [scrollbar-width:none] dark:bg-slate-900/95 [&::-webkit-scrollbar]:hidden">
      {GROUPS.map((g) => {
        const count = drones.filter((d) => g.statuses.includes(d.status)).length;
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
