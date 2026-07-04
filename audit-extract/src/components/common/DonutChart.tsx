import React from 'react';

interface DonutChartProps {
  percent: number;
  label?: string;
  centerText?: string;
  size?: number;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  percent,
  label = 'conciliado',
  centerText,
  size = 140,
}) => {
  const safePercent = Math.min(100, Math.max(0, percent));
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (safePercent / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg className="-rotate-90" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            className="stroke-slate-200 dark:stroke-slate-800"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className="stroke-success-500 transition-all duration-700"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
          />
        </svg>
        <div className="absolute text-center">
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {centerText ?? `${safePercent.toFixed(1).replace('.', ',')}%`}
          </p>
          {label && <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>}
        </div>
      </div>
    </div>
  );
};
