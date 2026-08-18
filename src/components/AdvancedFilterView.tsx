/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Expense, AccountItem, TransactionType } from '../types';
import { TableView } from './TableView';
import { MetricCard } from './MetricCard';
import { 
  Filter, 
  Search, 
  Calendar, 
  Tag, 
  CreditCard, 
  DollarSign, 
  Layers, 
  X, 
  Download, 
  RotateCcw, 
  ArrowUpRight, 
  ArrowDownRight, 
  Hash, 
  CheckCircle2, 
  SlidersHorizontal
} from 'lucide-react';
import { cn } from '../lib/utils';

interface AdvancedFilterViewProps {
  expenses: Expense[];
  accounts: AccountItem[];
}

export function AdvancedFilterView({ expenses, accounts }: AdvancedFilterViewProps) {
  // Filter States
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'الكل'>('الكل');
  const [categoryFilter, setCategoryFilter] = useState<string>('الكل');
  const [accountFilter, setAccountFilter] = useState<string>('الكل');
  const [tagFilter, setTagFilter] = useState<string>('الكل');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');

  // Extract all unique categories and tags
  const allCategories = useMemo(() => {
    const set = new Set<string>();
    expenses.forEach(e => {
      if (e.category) set.add(e.category);
    });
    return Array.from(set);
  }, [expenses]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    expenses.forEach(e => {
      if (e.tags) {
        e.tags.forEach(t => set.add(t));
      }
    });
    return Array.from(set);
  }, [expenses]);

  // Execute Filtering
  const filteredExpenses = useMemo(() => {
    return expenses.filter(item => {
      // 1. Search term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesDesc = item.description.toLowerCase().includes(term);
        const matchesCat = item.category.toLowerCase().includes(term);
        const matchesAccount = item.paymentMethod.toLowerCase().includes(term);
        const matchesNotes = item.notes ? item.notes.toLowerCase().includes(term) : false;
        if (!matchesDesc && !matchesCat && !matchesAccount && !matchesNotes) return false;
      }

      // 2. Type filter
      if (typeFilter !== 'الكل') {
        const itemType = item.type || 'مصروف';
        if (itemType !== typeFilter) return false;
      }

      // 3. Category filter
      if (categoryFilter !== 'الكل') {
        if (item.category !== categoryFilter) return false;
      }

      // 4. Account filter
      if (accountFilter !== 'الكل') {
        if (item.paymentMethod !== accountFilter) return false;
      }

      // 5. Tag filter
      if (tagFilter !== 'الكل') {
        if (!item.tags || !item.tags.includes(tagFilter)) return false;
      }

      // 6. Date Range
      if (startDate && item.date < startDate) return false;
      if (endDate && item.date > endDate) return false;

      // 7. Amount Range
      const min = parseFloat(minAmount);
      const max = parseFloat(maxAmount);
      if (!isNaN(min) && item.amount < min) return false;
      if (!isNaN(max) && item.amount > max) return false;

      return true;
    });
  }, [expenses, searchTerm, typeFilter, categoryFilter, accountFilter, tagFilter, startDate, endDate, minAmount, maxAmount]);

  // Statistics on filtered data
  const totalFilteredIncome = useMemo(() => {
    return filteredExpenses.filter(e => e.type === 'دخل').reduce((acc, curr) => acc + (curr.amount || 0), 0);
  }, [filteredExpenses]);

  const totalFilteredExpense = useMemo(() => {
    return filteredExpenses.filter(e => e.type === 'مصروف' || !e.type).reduce((acc, curr) => acc + (curr.amount || 0), 0);
  }, [filteredExpenses]);

  const averageTransactionAmount = useMemo(() => {
    if (filteredExpenses.length === 0) return 0;
    const total = filteredExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    return Math.round(total / filteredExpenses.length);
  }, [filteredExpenses]);

  // Reset Filters
  const handleResetFilters = () => {
    setSearchTerm('');
    setTypeFilter('الكل');
    setCategoryFilter('الكل');
    setAccountFilter('الكل');
    setTagFilter('الكل');
    setStartDate('');
    setEndDate('');
    setMinAmount('');
    setMaxAmount('');
  };

  return (
    <div className="space-y-8">
      {/* Top Metrics on Filtered Data */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="عدد المعاملات المفلترة"
          value={filteredExpenses.length}
          icon={SlidersHorizontal}
          color="indigo"
          isCurrency={false}
          subtext={`من أصل (${expenses.length}) معاملة مسجلة`}
        />
        <MetricCard
          title="إجمالي الدخل المفلتر"
          value={totalFilteredIncome}
          icon={ArrowUpRight}
          color="emerald"
          subtext="المبالغ المكتسبة المفلترة"
        />
        <MetricCard
          title="إجمالي المصروفات المفلترة"
          value={totalFilteredExpense}
          icon={ArrowDownRight}
          color="red"
          subtext="المبالغ المنفقة المفلترة"
        />
        <MetricCard
          title="متوسط قيمة المعاملة"
          value={averageTransactionAmount}
          icon={DollarSign}
          color="purple"
          subtext="المعدل المتوسط لكل معاملة"
        />
      </div>

      {/* Advanced Search & Multi-Criteria Filter Panel */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100">
              <Filter className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">محرك البحث والفلترة المتقدمة</h2>
              <p className="text-xs text-slate-400 font-medium">تصفية شاملة بحسب التاريخ، الفئة، الحساب، الوسوم، النطاق المالي، والحالة.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              <span>إعادة ضبط الفلاتر</span>
            </button>
          </div>
        </div>

        {/* Search Bar & Primary Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Keyword Search */}
          <div className="space-y-1.5 md:col-span-1">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span>البحث بالنص أو الوصف</span>
            </label>
            <input
              type="text"
              placeholder="ابحث بالاسم، الوصف، أو الملاحظات..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold"
            />
          </div>

          {/* Type Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              <span>نوع المعاملة</span>
            </label>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as any)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold"
            >
              <option value="الكل">الكل (دخل ومصروفات)</option>
              <option value="دخل">دخل فقط</option>
              <option value="مصروف">مصروفات فقط</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-slate-400" />
              <span>الفئة المالية</span>
            </label>
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold"
            >
              <option value="الكل">جميع الفئات</option>
              {allCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Secondary Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 border-t border-slate-100 pt-4">
          {/* Account Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-slate-400" />
              <span>الحساب البنكي / وسيلة الدفع</span>
            </label>
            <select
              value={accountFilter}
              onChange={e => setAccountFilter(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold"
            >
              <option value="الكل">جميع الحسابات</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.name}>{acc.name}</option>
              ))}
            </select>
          </div>

          {/* Tag Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-slate-400" />
              <span>الوسوم (#Tags)</span>
            </label>
            <select
              value={tagFilter}
              onChange={e => setTagFilter(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold"
            >
              <option value="الكل">جميع الوسوم</option>
              {allTags.map(tag => (
                <option key={tag} value={tag}>#{tag}</option>
              ))}
            </select>
          </div>

          {/* Date Range Start & End */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>من تاريخ</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold dir-ltr"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>إلى تاريخ</span>
            </label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold dir-ltr"
            />
          </div>
        </div>

        {/* Amount Range Min & Max */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-slate-400" />
              <span>الحد الأدنى للمبلغ</span>
            </label>
            <input
              type="number"
              placeholder="مثلاً: 100"
              value={minAmount}
              onChange={e => setMinAmount(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-slate-400" />
              <span>الحد الأقصى للمبلغ</span>
            </label>
            <input
              type="number"
              placeholder="مثلاً: 5000"
              value={maxAmount}
              onChange={e => setMaxAmount(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold"
            />
          </div>
        </div>
      </div>

      {/* Filtered Results Table */}
      <TableView
        title={`نتائج البحث والفلترة (${filteredExpenses.length} معاملة)`}
        headers={['التاريخ', 'النوع', 'الوصف', 'الفئة', 'الحساب', 'الوسوم', 'المبلغ']}
      >
        {filteredExpenses.length === 0 ? (
          <tr>
            <td colSpan={7} className="text-center py-10 text-slate-400 font-bold text-xs">
              لا توجد نتائج تطابق خيارات الفلترة المحددة. جرّب توسيع نطاق البحث أو إعادة ضبط المعايير.
            </td>
          </tr>
        ) : (
          filteredExpenses.map((exp) => (
            <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-600 dir-ltr">
                {exp.date}
              </td>

              <td className="px-6 py-4 whitespace-nowrap">
                <span className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-bold border",
                  exp.type === 'دخل' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                )}>
                  {exp.type || 'مصروف'}
                </span>
              </td>

              <td className="px-6 py-4">
                <div className="font-bold text-slate-800 text-xs">{exp.description}</div>
                {exp.notes && <div className="text-[10px] text-slate-400 font-medium">{exp.notes}</div>}
              </td>

              <td className="px-6 py-4 whitespace-nowrap">
                <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-bold">
                  {exp.category}
                </span>
              </td>

              <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-600">
                {exp.paymentMethod}
              </td>

              <td className="px-6 py-4 whitespace-nowrap">
                {exp.tags && exp.tags.length > 0 ? (
                  <div className="flex items-center gap-1 flex-wrap">
                    {exp.tags.map(t => (
                      <span key={t} className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                        #{t}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-300 text-xs">-</span>
                )}
              </td>

              <td className="px-6 py-4 whitespace-nowrap dir-ltr">
                <span className={cn(
                  "font-black text-xs",
                  exp.type === 'دخل' ? "text-emerald-600" : "text-rose-600"
                )}>
                  {exp.type === 'دخل' ? '+' : '-'}{exp.amount.toLocaleString('en-US')} ريال
                </span>
              </td>
            </tr>
          ))
        )}
      </TableView>
    </div>
  );
}
