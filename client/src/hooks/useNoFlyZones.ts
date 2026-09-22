import { useCallback, useEffect, useState } from 'react';
import { listNoFlyZones } from '../api/noFlyZones';
import type { NoFlyZone } from '../types';

export function useNoFlyZones() {
  const [zones, setZones] = useState<NoFlyZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    return listNoFlyZones()
      .then(setZones)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    refetch().finally(() => setLoading(false));
  }, [refetch]);

  return { zones, loading, error, refetch };
}
