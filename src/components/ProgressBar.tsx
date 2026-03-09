"use client";

interface ProgressBarProps {
  remaining: number;
  total: number;
  round: number;
  totalRounds: number;
}

export default function ProgressBar({
  remaining,
  total,
  round,
  totalRounds,
}: ProgressBarProps) {
  const pct = Math.min(((total - remaining) / total) * 100, 100);

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-gray-400">
          <span className="font-medium text-white">{remaining}</span> BMWs
          remaining
        </span>
        <span className="text-gray-500">
          Round {round}
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className="h-full rounded-full bg-[#1a7fd4] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
