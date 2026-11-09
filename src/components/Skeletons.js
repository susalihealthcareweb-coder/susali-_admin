export function PageSkeleton({ cards = 4, rows = 6 }) {
  return (
    <div className="animate-fade-in space-y-5" aria-busy="true" aria-label="Loading">
      <div className="space-y-2"><div className="skeleton h-7 w-56" /><div className="skeleton h-4 w-80 max-w-full" /></div>
      {cards > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: cards }).map((_, i) => <div key={i} className="card card-pad space-y-2"><div className="skeleton h-3 w-20" /><div className="skeleton h-7 w-12" /></div>)}
        </div>
      )}
      <div className="card card-pad space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3"><div className="skeleton h-9 w-9 shrink-0 rounded-full" /><div className="flex-1 space-y-1.5"><div className="skeleton h-3.5 w-2/3" /><div className="skeleton h-3 w-1/3" /></div><div className="skeleton h-6 w-20 rounded-full" /></div>
        ))}
      </div>
    </div>
  );
}
