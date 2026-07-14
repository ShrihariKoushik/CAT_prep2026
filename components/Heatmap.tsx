import type { HeatmapCell } from "@/lib/home";

const INTENSITY = [
  "bg-cream-200 dark:bg-night-800",
  "bg-terra-200 dark:bg-terra-600/40",
  "bg-terra-500/70 dark:bg-terra-500/70",
  "bg-terra-600 dark:bg-terra-500",
];

export default function Heatmap({ cells }: { cells: HeatmapCell[] }) {
  // columns of 7 (weeks), oldest → newest, ~13 columns for 90 days
  const columns: HeatmapCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) columns.push(cells.slice(i, i + 7));

  return (
    <div className="flex gap-1 overflow-x-auto pb-1">
      {columns.map((col, ci) => (
        <div key={ci} className="flex flex-col gap-1">
          {col.map((c) => (
            <div
              key={c.day}
              title={`${c.day}: ${c.count}/3 sessions${c.freezeUsed ? " (freeze)" : ""}`}
              className={`h-3.5 w-3.5 rounded-[4px] ${
                c.freezeUsed ? "bg-sage-200 dark:bg-sage-600" : INTENSITY[Math.min(3, c.count)]
              }`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
