function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-[#E8E8E8] rounded-lg ${className}`} />;
}

export function SkeletonPageHeader() {
  return (
    <div className="space-y-1.5">
      <SkeletonBlock className="h-5 w-36" />
      <SkeletonBlock className="h-3.5 w-52" />
    </div>
  );
}

export function SkeletonKpiCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-[#E8E8E8] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <SkeletonBlock className="h-4 w-24" />
            <SkeletonBlock className="h-5 w-16 rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((j) => (
              <div key={j} className="space-y-1">
                <SkeletonBlock className="h-3 w-16" />
                <SkeletonBlock className="h-5 w-20" />
              </div>
            ))}
          </div>
          <SkeletonBlock className="h-1.5 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonRows({ count = 6 }: { count?: number }) {
  return (
    <div className="bg-white border border-[#E8E8E8] rounded-xl divide-y divide-[#E8E8E8]">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <SkeletonBlock className="w-2 h-2 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <SkeletonBlock className="h-3.5 w-1/3" />
            <SkeletonBlock className="h-3 w-2/3" />
          </div>
          <SkeletonBlock className="h-4 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonStatCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-[#E8E8E8] rounded-xl p-4 space-y-2">
          <SkeletonBlock className="h-3 w-20" />
          <SkeletonBlock className="h-7 w-28" />
          <SkeletonBlock className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="bg-white border border-[#E8E8E8] rounded-xl p-4 space-y-3">
      <SkeletonBlock className="h-4 w-32" />
      <SkeletonBlock className="h-40 w-full" />
    </div>
  );
}

export function SkeletonForm({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white border border-[#E8E8E8] rounded-xl p-5 space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="h-10 w-full" />
        </div>
      ))}
      <SkeletonBlock className="h-10 w-full mt-2" />
    </div>
  );
}

export function SkeletonAppointmentCards({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-[#E8E8E8] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <SkeletonBlock className="h-4 w-32" />
            <SkeletonBlock className="h-5 w-20 rounded-full" />
          </div>
          <SkeletonBlock className="h-3 w-48" />
          <SkeletonBlock className="h-3 w-36" />
        </div>
      ))}
    </div>
  );
}
