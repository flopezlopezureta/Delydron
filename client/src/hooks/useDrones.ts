import { useCallback, useEffect, useState } from 'react';
import { listDrones } from '../api/drones';
import type { Drone } from '../types';

export function useDrones() {
  const [drones, setDrones] = useState<Drone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    return listDrones()
      .then(setDrones)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    refetch().finally(() => setLoading(false));
  }, [refetch]);

  return { drones, loading, error, refetch };
}
