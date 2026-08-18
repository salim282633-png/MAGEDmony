/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { ReactNode } from 'react';
import { cn } from '../lib/utils';

interface TableViewProps {
  title: string;
  description?: string;
  headers: string[];
  children: ReactNode;
  mobileCards?: ReactNode;
  action?: ReactNode;
  emptyState?: ReactNode;
  isEmpty?: boolean;
}

export function TableView({ 
  title, 
  description, 
  headers, 
  children, 
  mobileCards, 
  action,
  emptyState,
  isEmpty = false 
}: TableViewProps) {
  if (isEmpty && emptyState) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg sm:text-xl font-black text-slate-800">{title}</h3>
            {description && <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{description}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
        {emptyState}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-5 sm:p-7 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg sm:text-xl font-black text-slate-900">{title}</h3>
          {description && <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      {/* Mobile Card List (if provided) */}
      {mobileCards ? (
        <div className="md:hidden divide-y divide-slate-100">
          {mobileCards}
        </div>
      ) : null}

      {/* Desktop Table View */}
      <div className={cn("overflow-x-auto", mobileCards ? "hidden md:block" : "block")}>
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-100">
              {headers.map((header, i) => (
                <th key={i} className="px-6 py-3.5 text-xs font-bold text-slate-600 tracking-wider">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
            {children}
          </tbody>
        </table>
      </div>
    </div>
  );
}
