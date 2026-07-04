import React, { useMemo } from 'react';

export interface BarChartItem {
  label: string;
  value: number;
}

interface BarChartProps {
  data: BarChartItem[];
  height?: number;
  color?: string;
  formatValue?: (val: number) => string;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  height = 160,
  color = 'bg-brand-500',
  formatValue,
}) => {
  const maxValue = useMemo(() => Math.max(...data.map((d) => d.value), 1), [data]);

  return (
    <div className="flex items-end gap-2.5" style={{ height }}>
      {data.map((item, idx) => {
        const barHeight = (item.value / maxValue) * (height - 28);
        return (
          <div key={idx} className="group flex flex-1 flex-col items-center justify-end gap-1.5">
            <div className="relative w-full">
              <div
                className={`w-full rounded-t-md ${color} transition-all duration-300 group-hover:opacity-80`}
                style={{ height: `${Math.max(barHeight, 4)}px` }}
              />
              <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-[10px] font-semibold text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100 dark:bg-slate-700">
                {formatValue ? formatValue(item.value) : item.value}
              </div>
            </div>
            <span className="truncate text-[10px] font-medium text-slate-500 dark:text-slate-400">
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};
