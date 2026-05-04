function SkeletonCard({ className = "" }: { className?: string }) {
  return <div className={`finance-panel finance-shimmer min-h-[160px] ${className}`} />;
}

export default function FinanceLoading() {
  return (
    <div className="finance-page">
      <section className="finance-page-header">
        <div className="grid gap-4">
          <div className="finance-shimmer h-3 w-32 rounded-full" />
          <div className="finance-shimmer h-12 w-80 rounded-2xl" />
          <div className="finance-shimmer h-5 w-[36rem] max-w-full rounded-2xl" />
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <SkeletonCard className="min-h-[360px]" />
        <SkeletonCard className="min-h-[360px]" />
      </section>

      <SkeletonCard className="min-h-[420px]" />
    </div>
  );
}
