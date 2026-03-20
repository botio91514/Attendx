const SkeletonCard = () => (
  <div className="stat-card shimmer h-24" />
);

const SkeletonTable = ({ rows = 5 }: { rows?: number }) => (
  <div className="glass-card overflow-hidden">
    <div className="shimmer h-10 bg-secondary/30" />
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="shimmer h-14 border-t border-glass-border" />
    ))}
  </div>
);

const SkeletonChart = () => (
  <div className="glass-card shimmer h-64" />
);

export { SkeletonCard, SkeletonTable, SkeletonChart };
