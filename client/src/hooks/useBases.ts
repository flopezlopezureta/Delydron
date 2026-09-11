import { useCallback, useEffect, useState } from 'react';
import { listBases } from '../api/bases';
import type { Base } from '../types';

export function useBases() {
  const [bases, setBases] = useState<Base[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    return listBases()
      .then(setBases)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    refetch().finally(() => setLoading(false));
  }, [refetch]);

  return { bases, loading, error, refetch };
}
