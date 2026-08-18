/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  actionIcon?: LucideIcon;
  secondaryAction?: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'info';
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionText,
  onAction,
  actionIcon: ActionIcon,
  secondaryAction,
  variant = 'default',
  className
}: EmptyStateProps) {
  const isSuccess = variant === 'success';
  const isWarning = variant === 'warning';
  const isInfo = variant === 'info';

  return (
    <div className={cn(
      "p-8 sm:p-12 text-center rounded-3xl border flex flex-col items-center justify-center max-w-md mx-auto my-6 transition-all",
      isSuccess && "bg-emerald-50/50 border-emerald-100 text-emerald-950",
      isWarning && "bg-amber-50/50 border-amber-100 text-amber-950",
      isInfo && "bg-blue-50/50 border-blue-100 text-blue-950",
      !isSuccess && !isWarning && !isInfo && "bg-slate-50/60 border-slate-200/80 text-slate-800",
      className
    )}>
      <div className={cn(
        "w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-sm",
        isSuccess && "bg-emerald-100 text-emerald-700",
        isWarning && "bg-amber-100 text-amber-700",
        isInfo && "bg-blue-100 text-blue-700",
        !isSuccess && !isWarning && !isInfo && "bg-white text-slate-400 border border-slate-200"
      )}>
        <Icon className="w-8 h-8" />
      </div>

      <h4 className="text-base sm:text-lg font-black mb-1.5">{title}</h4>
      <p className="text-xs sm:text-sm text-slate-500 max-w-xs leading-relaxed mb-6 font-medium">
        {description}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3 w-full">
        {actionText && onAction && (
          <button
            onClick={onAction}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-200 transition-all cursor-pointer"
          >
            {ActionIcon && <ActionIcon className="w-4 h-4" />}
            <span>{actionText}</span>
          </button>
        )}
        {secondaryAction}
      </div>
    </div>
  );
}
