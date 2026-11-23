'use client';

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';

export function ConnectionStatus() {
  const { data, error, isPending } = useQuery({ queryKey: ['warehouse-health'], queryFn: () => apiGet<{ status: string; checkedAt: string }>('health'), refetchInterval: 60000, retry: false });
  return <div className="text-[11px]" role="status">
    <span className={error ? 'text-amber-600' : data ? 'text-teal-600' : 'text-slate-500'}>
      {isPending ? 'Checking warehouse…' : error ? 'Warehouse needs attention' : 'Warehouse connected'}
    </span>
    {error ? <p className="mt-1 max-w-xl text-xs text-amber-700">{error.message}</p> : null}
  </div>;
}
