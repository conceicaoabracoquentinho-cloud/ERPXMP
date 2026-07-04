import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

type IconType = React.ComponentType<{ className?: string }>;

interface StatCardProps {
  icon: IconType;
  title: string;
  value: string;
  variation?: number;
  trend?: 'alta' | 'baixa' | 'estavel';
  status?: 'success' | 'warning' | 'danger' | 'neutral';
  onClick?: () => void;
  className?: string;
}

const STATUS_STYLES = {
  success: 'text-success-600 dark:text-success-400 bg-success-50 dark:bg-success-950',
  warning: 'text-warning-600 dark:text-warning-400 bg-warning-50 dark:bg-warning-950',
  danger: 'text-danger-600 dark:text-danger-400 bg-danger-50 dark:bg-danger-950',
  neutral: 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950',
};

export const StatCard: React.FC<StatCardProps> = ({
  icon: Icon,
  title,
  value,
  variation,
  trend = 'estavel',
  status = 'neutral',
  onClick,
  className = '',
}) => {
  const TrendIcon = trend === 'alta' ? ArrowUpRight : trend === 'baixa' ? ArrowDownRight : Minus;
  const trendColor =
    trend === 'alta'
      ? 'text-success-600 dark:text-success-400'
      : trend === 'baixa'
      ? 'text-danger-600 dark:text-danger-400'
      : 'text-slate-400';

  return (
    <div
      onClick={onClick}
      className={`card card-hover p-5 ${onClick ? 'cursor-pointer hover:border-brand-400 dark:hover:border-brand-600 hover:shadow-md transition-all' : ''} ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${STATUS_STYLES[status]}`}>
          <Icon className="h-5 w-5" />
        </div>
        {variation !== undefined && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${trendColor}`}>
            <TrendIcon className="h-3.5 w-3.5" />
            {Math.abs(variation).toFixed(1).replace('.', ',')}%
          </span>
        )}
      </div>
      <p className="mt-4 text-2xl font-bold text-slate-900 dark:text-slate-50">{value}</p>
      <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{title}</p>
    </div>
  );
};
