import { clsx } from 'clsx';

// Skeleton de carga — sustituye a los "Cargando…" de texto plano.
export const Skeleton = ({ className }: { className?: string }) => (
  <div className={clsx('animate-pulse bg-gray-200/70 rounded-lg', className)} />
);

export const SkeletonStatRow = ({ count = 4 }: { count?: number }) => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bg-white border border-gray-200 rounded-card p-5 space-y-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-28" />
      </div>
    ))}
  </div>
);

export const SkeletonTableRows = ({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) => (
  <>
    {Array.from({ length: rows }).map((_, r) => (
      <tr key={r}>
        {Array.from({ length: cols }).map((__, c) => (
          <td key={c} className="px-4 py-3"><Skeleton className="h-4 w-full max-w-[140px]" /></td>
        ))}
      </tr>
    ))}
  </>
);
