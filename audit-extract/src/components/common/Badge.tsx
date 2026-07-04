import React from 'react';

interface BadgeProps {
  label: string;
  color?: string;
  dot?: string;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  color = 'text-slate-600 dark:text-slate-300',
  dot,
  className = '',
}) => {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${color} ${className}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
      {label}
    </span>
  );
};
