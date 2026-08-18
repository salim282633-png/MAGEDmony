/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LucideIcon } from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';
import { motion } from 'motion/react';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  subtext?: string;
  trend?: {
    value: number;
    label: string;
    positive?: boolean;
  };
  color?: 'blue' | 'green' | 'red' | 'orange' | 'purple' | 'indigo' | 'emerald' | 'amber';
  isCurrency?: boolean;
}

export function MetricCard({ title, value, icon: Icon, subtext, trend, color = 'blue', isCurrency = true }: MetricCardProps) {
  const iconColors = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    red: 'bg-red-100 text-red-600',
    orange: 'bg-orange-100 text-orange-600',
    purple: 'bg-purple-100 text-purple-600',
    indigo: 'bg-indigo-100 text-indigo-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    amber: 'bg-amber-100 text-amber-600',
  };

  return (
    <motion.div 
      whileHover={{ y: -4 }}
      className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm transition-shadow hover:shadow-md flex flex-col justify-between"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={cn("p-3 rounded-xl", iconColors[color] || iconColors.blue)}>
          <Icon className="w-6 h-6" />
        </div>
        {trend && (
          <div className={cn(
            "px-2 py-1 rounded-lg text-xs font-bold",
            trend.positive ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
          )}>
            {trend.positive ? '+' : '-'}{trend.value}% {trend.label}
          </div>
        )}
      </div>
      <div>
        <p className="text-xs font-bold text-slate-400 mb-1">{title}</p>
        <h3 className="text-2xl font-black text-slate-800 tracking-tight">
          {typeof value === 'number' && isCurrency ? formatCurrency(value) : value}
        </h3>
        {subtext && (
          <p className="text-xs font-medium text-slate-500 mt-1.5">{subtext}</p>
        )}
      </div>
    </motion.div>
  );
}
