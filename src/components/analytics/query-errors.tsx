'use client';

import { useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function QueryErrors() {
  const client = useQueryClient();
  const message = useSyncExternalStore(
    callback => client.getQueryCache().subscribe(callback),
    () => [...new Set(client.getQueryCache().getAll().filter(query => query.isActive() && query.queryKey[0] !== 'warehouse-health' && query.state.error).map(query => query.state.error?.message))].join(' '),
    () => '',
  );
  if (!message) return null;
  return <div role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
    <p className="font-medium">Report data could not be loaded</p>
    <p className="mt-1">{message}</p>
    <button className="mt-2 underline" onClick={() => { void client.refetchQueries({ type: 'active' }); }}>Retry</button>
  </div>;
}
