import { useCallback, useEffect, useState } from 'react';
import { listMissions } from '../api/missions';
import type { Mission } from '../types';

export function useMissions() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    return listMissions()
      .then(setMissions)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    refetch().finally(() => setLoading(false));
  }, [refetch]);

  return { missions, loading, error, refetch };
}
