import { useEffect, useState } from 'react';
import { getWeather, type Weather } from '../../api/weather';
import type { Base } from '../../types';

interface WeatherStripProps {
  bases: Base[];
  maxWindKmh: number;
  maxPrecipitationMm: number;
}

// Ambient awareness so an operator sees conditions before trying to
// dispatch, not just after the gate rejects it — one read per base on
// mount/whenever the base list changes, weather doesn't move fast enough
// here to justify polling.
export function WeatherStrip({ bases, maxWindKmh, maxPrecipitationMm }: WeatherStripProps) {
  const [weatherByBase, setWeatherByBase] = useState<Record<string, Weather | 'error'>>({});

  useEffect(() => {
    let cancelled = false;
    for (const base of bases) {
      getWeather(base.lat, base.lon)
        .then((w) => {
          if (!cancelled) setWeatherByBase((prev) => ({ ...prev, [base.id]: w }));
        })
        .catch(() => {
          if (!cancelled) setWeatherByBase((prev) => ({ ...prev, [base.id]: 'error' }));
        });
    }
    return () => {
      cancelled = true;
    };
  }, [bases]);

  if (bases.length === 0) return null;

  return (
    <div className="absolute left-3 top-16 z-[1000] flex flex-wrap gap-2">
      {bases.map((base) => {
        const w = weatherByBase[base.id];
        if (!w || w === 'error') return null;
        const risky = w.windKmh > maxWindKmh || w.precipitationMm > maxPrecipitationMm;
        return (
          <div
            key={base.id}
            className={`rounded-lg px-2.5 py-1.5 text-xs shadow ${
              risky
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/70 dark:text-amber-200'
                : 'bg-white/95 text-slate-600 dark:bg-slate-900/95 dark:text-slate-300'
            }`}
            title={risky ? `${base.name}: fuera de los límites para despachar` : base.name}
          >
            <span className="font-medium">{base.name}:</span> {w.windKmh.toFixed(0)} km/h viento
            {w.precipitationMm > 0 && ` · ${w.precipitationMm.toFixed(1)} mm`}
          </div>
        );
      })}
    </div>
  );
}
