import React from 'react';

interface CardProps {
  title?: React.ReactNode;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export const Card: React.FC<CardProps> = ({
  title,
  description,
  actions,
  children,
  className = '',
  hover = false,
}) => {
  return (
    <div className={`card ${hover ? 'card-hover' : ''} ${className}`}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            {title && <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h3>}
            {description && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
};
