import { useEffect, useState } from 'react';
import { listDrones } from '../api/drones';
import type { Drone } from '../types';

export function useDrones() {
  const [drones, setDrones] = useState<Drone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listDrones()
      .then(setDrones)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { drones, loading, error };
}
