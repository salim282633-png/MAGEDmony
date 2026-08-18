/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Expense, AccountItem, TransactionType, IncomeCategory, ExpenseCategory, UserSettings, DebtItem } from '../types';
import { MetricCard } from './MetricCard';
import { TableView } from './TableView';
import { formatCurrency, cn } from '../lib/utils';
import { 
  Plus, 
  Trash2, 
  Search, 
  ArrowDownLeft, 
  ArrowUpRight, 
  MapPin, 
  Tag as TagIcon, 
  Landmark, 
  Filter, 
  X, 
  Eye, 
  Pencil, 
  FileText,
  Calendar,
  Sparkles,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Scale,
  Gauge,
  Wallet,
  TrendingDown,
  TrendingUp,
  Info
} from 'lucide-react';
import { addDoc, collection, deleteDoc, doc, updateDoc, increment } from 'firebase/firestore';
import { useFinanceData } from '../lib/useFinanceData';
import { db, auth } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';

interface ExpenseViewProps {
  expenses: Expense[];
  accounts?: AccountItem[];
  settings?: UserSettings | null;
  debts?: DebtItem[];
  initialTypeFilter?: 'الكل' | TransactionType;
}

export function ExpenseView({ expenses, accounts = [], settings = null, debts = [], initialTypeFilter = 'الكل' }: ExpenseViewProps) {
  const { addTransaction, updateExpenseTransactional, deleteTransaction, clearExpensesTransactional } = useFinanceData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Expense | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'الكل' | TransactionType>(initialTypeFilter);

  useEffect(() => {
    if (initialTypeFilter) {
      setTypeFilter(initialTypeFilter);
    }
  }, [initialTypeFilter]);
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>('الكل');

  // Form State
  const [formData, setFormData] = useState<Partial<Expense>>({
    type: 'مصروف',
    date: new Date().toISOString().split('T')[0],
    category: 'الطعام',
    description: '',
    amount: 0,
    paymentMethod: accounts.length > 0 ? accounts[0].name : 'الحساب البنكي',
    tags: [],
    location: '',
    notes: ''
  });

  const [tagInput, setTagInput] = useState('');

  const incomeCategories: IncomeCategory[] = [
    'الراتب',
    'دخل إضافي',
    'الأرباح',
    'المكافآت',
    'الهدايا',
    'مصادر أخرى'
  ];

  const expenseCategories: ExpenseCategory[] = [
    'الطعام',
    'السكن',
    'المواصلات',
    'الوقود',
    'التسوق',
    'الصحة',
    'التعليم',
    'الترفيه',
    'الفواتير',
    'الاشتراكات',
    'السفر',
    'أخرى'
  ];

  const currentCategories = React.useMemo(() => {
    if (formData.type === 'دخل') {
      if (editingItem && editingItem.category === 'الراتب') {
        return incomeCategories;
      }
      return incomeCategories.filter(cat => cat !== 'الراتب');
    }
    return expenseCategories;
  }, [formData.type, editingItem]);

  // Handle Form Open/Close
  const openAddModal = (type: TransactionType = 'مصروف') => {
    setEditingItem(null);
    setFormData({
      type,
      date: new Date().toISOString().split('T')[0],
      category: type === 'دخل' ? 'الأرباح' : 'الطعام',
      description: '',
      amount: 0,
      paymentMethod: accounts.length > 0 ? accounts[0].name : 'الحساب البنكي',
      tags: [],
      location: '',
      notes: ''
    });
    setTagInput('');
    setIsModalOpen(true);
  };

  const openEditModal = (item: Expense) => {
    setEditingItem(item);
    setFormData({
      type: item.type || 'مصروف',
      date: item.date,
      category: item.category,
      description: item.description,
      amount: item.amount,
      paymentMethod: item.paymentMethod,
      tags: item.tags || [],
      location: item.location || '',
      notes: item.notes || ''
    });
    setTagInput('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  // Tag helper
  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim().replace(/^#/, '');
      if (!formData.tags?.includes(newTag)) {
        setFormData({ ...formData, tags: [...(formData.tags || []), newTag] });
      }
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags?.filter(t => t !== tagToRemove)
    });
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    if (editingItem && editingItem.id) {
      await updateExpenseTransactional(editingItem.id, formData);
    } else {
      await addTransaction(formData as Omit<Expense, 'id' | 'userId'>);
    }

    closeModal();
  };

  // Delete Handler
  const handleDelete = async (id: string) => {
    await deleteTransaction(id);
  };

  // Clear All Expenses Handler
  const handleClearExpenses = async () => {
    if (!auth.currentUser) return;
    setClearing(true);
    try {
      await clearExpensesTransactional();
      setShowClearConfirm(false);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء تفريغ السجل وإعادة الأرصدة.');
    } finally {
      setClearing(false);
    }
  };

  // Filtered list - Shows all real transactions without artificial exclusions
  const filteredList = expenses.filter(item => {
    const itemType = item.type || 'مصروف';
    const matchesType = typeFilter === 'الكل' || itemType === typeFilter;
    const matchesSearch = 
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.location && item.location.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.tags && item.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase())));
    
    const matchesCategory = selectedCategory === 'الكل' || item.category === selectedCategory;
    const matchesAccount = selectedAccountFilter === 'الكل' || item.paymentMethod === selectedAccountFilter;

    return matchesType && matchesSearch && matchesCategory && matchesAccount;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Metrics & Comparison Logic
  const currency = settings?.currency || 'ريال سعودي';
  const salary = settings?.salary || 2500;
  const baseOperationalBudget = Math.round(salary * 0.46);

  const now = new Date();
  const currentMonthStr = now.toISOString().substring(0, 7);

  // Extra income directed to living in current month
  const currentMonthLivingExtra = useMemo(() => {
    return expenses
      .filter(e => e.type === 'دخل' && e.category !== 'الراتب' && e.date && e.date.startsWith(currentMonthStr))
      .reduce((sum, e) => {
        if (e.extraIncomeAllocation === 'living') {
          return sum + (e.amount || 0);
        }
        if (e.extraIncomeAllocation === 'salary_split') {
          return sum + (e.allocatedAmounts?.living ?? Math.round((e.amount || 0) * 0.46));
        }
        return sum;
      }, 0);
  }, [expenses, currentMonthStr]);

  const operationalBudget = baseOperationalBudget + currentMonthLivingExtra;

  // Living/Operational expenses for current month (exclude expenses paid from dedicated reserve funds like debt fund)
  const livingExpenses = useMemo(() => {
    return expenses.filter(e => {
      if (e.type === 'دخل') return false;
      const isCurrentMonth = e.date && e.date.startsWith(currentMonthStr);
      if (!isCurrentMonth) return false;

      // Exclude debt payments and dedicated funds
      const isDebtRelated = 
        e.category === 'الديون' || 
        e.category === 'سداد دين' ||
        e.paymentMethod === 'صندوق سداد الديون' || 
        e.paymentMethod === 'صندوق الادخار والاستثمار' || 
        e.paymentMethod === 'صندوق الطوارئ' ||
        e.description?.includes('سداد دفعة من دين') ||
        e.description?.includes('سداد دين');

      return !isDebtRelated;
    });
  }, [expenses, currentMonthStr]);

  const totalExpense = livingExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const remaining = operationalBudget - totalExpense;
  const spentPct = operationalBudget > 0 ? Math.round((totalExpense / operationalBudget) * 100) : 0;
  const isOverBudget = totalExpense > operationalBudget;
  const isNearBudget = !isOverBudget && spentPct >= 80;
  const overAmount = Math.max(0, totalExpense - operationalBudget);
  const remainingAmount = Math.max(0, remaining);

  return (
    <div className="space-y-8">
      {/* 📊 Visual Indicator & Salary Allocation Comparison Card */}
      <div className={cn(
        "p-6 sm:p-7 rounded-3xl border transition-all shadow-xs",
        isOverBudget 
          ? "bg-rose-50/40 border-rose-200" 
          : isNearBudget 
            ? "bg-amber-50/40 border-amber-200" 
            : "bg-white border-slate-200/80"
      )}>
        {/* Card Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-11 h-11 rounded-2xl flex items-center justify-center shadow-xs",
              isOverBudget ? "bg-rose-600 text-white" : isNearBudget ? "bg-amber-500 text-white" : "bg-emerald-600 text-white"
            )}>
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900">مؤشر المصروفات الفعلية مقابل مخصص الراتب</h3>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                مقارنة المصروفات المسجلة بمخصص المعيشة المعتمد في توزيع الراتب (46% = {formatCurrency(operationalBudget, currency)})
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex items-center self-start sm:self-auto">
            {isOverBudget ? (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300 shadow-xs">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>تجاوز المخصص بنسبة {spentPct}% (+{formatCurrency(overAmount, currency)})</span>
              </span>
            ) : isNearBudget ? (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300 shadow-xs">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>اقتراب من الحد ({spentPct}% مستهلك)</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>ضمن النطاق المخطط ({spentPct}% مستهلك)</span>
              </span>
            )}
          </div>
        </div>

        {/* ⚠️ Simple Alert Banner if Exceeded or Near Limit */}
        {isOverBudget && (
          <div className="mt-5 p-4 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-900 flex items-start gap-3 shadow-xs">
            <div className="p-1 bg-rose-100 rounded-lg text-rose-600 shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1 text-xs">
              <p className="font-black text-rose-950 text-sm mb-1">
                تنبيه: تجاوزت المصروفات الحد المخطط له في توزيع الراتب!
              </p>
              <p className="text-rose-800 font-medium leading-relaxed">
                لقد بلغت مصروفاتك الفعلية <span className="font-bold">{formatCurrency(totalExpense, currency)}</span> متجاوزة الحد المعتمد في الراتب (<span className="font-bold">{formatCurrency(operationalBudget, currency)}</span>) بمقدار <span className="font-black text-rose-900 bg-rose-100/80 px-1.5 py-0.5 rounded">{formatCurrency(overAmount, currency)}</span> ({spentPct}%). يُنصح بضبط الإنفاق حتى موعد نزول الراتب لتجنب السحب من صناديق الطوارئ والادخار.
              </p>
            </div>
          </div>
        )}

        {isNearBudget && (
          <div className="mt-5 p-4 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-900 flex items-start gap-3 shadow-xs">
            <div className="p-1 bg-amber-100 rounded-lg text-amber-600 shrink-0 mt-0.5">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="flex-1 text-xs">
              <p className="font-black text-amber-950 text-sm mb-1">
                تنبيه اقتراب من الحد الأقصى للمصروفات
              </p>
              <p className="text-amber-800 font-medium leading-relaxed">
                استهلكت حتى الآن <span className="font-bold">{spentPct}%</span> من مخصص المعيشة. المبلغ المتبقي المتاح للصرف هو <span className="font-black text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded">{formatCurrency(remainingAmount, currency)}</span> فقط.
              </p>
            </div>
          </div>
        )}

        {/* Visual Progress Bar Component */}
        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <div className="flex items-center gap-2">
              <span className="text-slate-700">المصروف الفعلي:</span>
              <span className={cn("font-black", isOverBudget ? "text-rose-600" : isNearBudget ? "text-amber-600" : "text-emerald-700")}>
                {formatCurrency(totalExpense, currency)} ({spentPct}%)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">الحد المخصص (46%):</span>
              <span className="font-black text-slate-800">{formatCurrency(operationalBudget, currency)}</span>
            </div>
          </div>

          {/* Progress Track */}
          <div className="h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200/70 p-0.5 relative">
            <div 
              className={cn(
                "h-full rounded-full transition-all duration-500",
                isOverBudget 
                  ? "bg-rose-500" 
                  : isNearBudget 
                    ? "bg-amber-500" 
                    : "bg-emerald-500"
              )}
              style={{ width: `${Math.min(spentPct, 100)}%` }}
            />
          </div>

          {/* Scale Labels */}
          <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 pt-0.5 px-0.5">
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span className={cn("font-black", isOverBudget ? "text-rose-600" : "text-slate-600")}>100% (الحد المخطط)</span>
            {isOverBudget && (
              <span className="text-rose-600 font-black">+{spentPct - 100}% تجاوز</span>
            )}
          </div>
        </div>

        {/* 3 Comparison Mini Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-5 border-t border-slate-100">
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">المخصص من الراتب</span>
              <Wallet className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-base font-black text-slate-900 mt-1">
              {formatCurrency(operationalBudget, currency)}
            </p>
            <p className="text-[10px] text-slate-400 font-medium">مخصص المعيشة (46%)</p>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">المصروف الفعلي</span>
              <ArrowUpRight className="w-4 h-4 text-rose-500" />
            </div>
            <p className="text-base font-black text-slate-900 mt-1">
              {formatCurrency(totalExpense, currency)}
            </p>
            <p className="text-[10px] text-slate-400 font-medium">تم استهلاك {spentPct}%</p>
          </div>

          <div className={cn(
            "p-3.5 rounded-2xl border",
            isOverBudget ? "bg-rose-50/60 border-rose-100" : "bg-emerald-50/60 border-emerald-100"
          )}>
            <div className="flex items-center justify-between">
              <span className={cn("text-xs font-bold", isOverBudget ? "text-rose-700" : "text-emerald-700")}>
                {isOverBudget ? "مقدار التجاوز" : "المتبقي المتاح"}
              </span>
              {isOverBudget ? (
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              ) : (
                <Sparkles className="w-4 h-4 text-emerald-600" />
              )}
            </div>
            <p className={cn("text-base font-black mt-1", isOverBudget ? "text-rose-700" : "text-emerald-800")}>
              {formatCurrency(isOverBudget ? overAmount : remainingAmount, currency)}
            </p>
            <p className={cn("text-[10px] font-medium", isOverBudget ? "text-rose-600" : "text-emerald-600")}>
              {isOverBudget ? "تجاوز عن سقف الميزانية" : "متبقي بأمان للمصروفات"}
            </p>
          </div>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="مخصص المعيشة"
          value={operationalBudget}
          icon={ArrowDownLeft}
          color="emerald"
          subtext="الصافي المتاح للمعيشة بعد الاستقطاعات"
        />
        <MetricCard
          title="المصروف"
          value={totalExpense}
          icon={ArrowUpRight}
          color="red"
          subtext="إجمالي المصروفات المسجلة"
        />
        <MetricCard
          title="المتبقي"
          value={remaining}
          icon={Sparkles}
          color={remaining >= 0 ? "blue" : "amber"}
          subtext={remaining >= 0 ? "المبلغ المتبقي للمعيشة" : "تجاوز المخصص المعيشي"}
        />
      </div>

      {/* Action Bar */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
        <div>
          <h3 className="text-base font-black text-slate-900">سجل المصروفات اليومية</h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">تسجيل سريع وبسيط للمصروفات مع الفئة</p>
        </div>
        <button
          onClick={() => openAddModal('مصروف')}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 px-6 rounded-2xl shadow-sm transition-all text-sm flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          <span>+ تسجيل مصروف</span>
        </button>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          
          {/* Tabs: All / Income / Expense */}
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl w-fit">
            <button
              onClick={() => setTypeFilter('الكل')}
              className={cn(
                "px-5 py-2 rounded-xl text-xs font-bold transition-all",
                typeFilter === 'الكل' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
              )}
            >
              الكل ({expenses.length})
            </button>
            <button
              onClick={() => setTypeFilter('دخل')}
              className={cn(
                "px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                typeFilter === 'دخل' ? "bg-emerald-600 text-white shadow-md shadow-emerald-200" : "text-emerald-700 hover:bg-emerald-50"
              )}
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>الدخل</span>
            </button>
            <button
              onClick={() => setTypeFilter('مصروف')}
              className={cn(
                "px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                typeFilter === 'مصروف' ? "bg-rose-600 text-white shadow-md shadow-rose-200" : "text-rose-700 hover:bg-rose-50"
              )}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>المصروفات</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="بحث بالحجم، الفئة، الوصف، الوسم، أو الموقع..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-1.5 border border-rose-200 text-rose-600 bg-rose-50/50 hover:bg-rose-100 hover:text-rose-700 px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-sm"
              title="تفريغ سجل المصروفات بالكامل للبدء من جديد"
            >
              <Trash2 className="w-4 h-4" />
              <span>تفريغ سجل المصروفات</span>
            </button>
            <button
              onClick={() => openAddModal('دخل')}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-emerald-100 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>تسجيل دخل</span>
            </button>
            <button
              onClick={() => openAddModal('مصروف')}
              className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-rose-100 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>تسجيل مصروف</span>
            </button>
          </div>
        </div>

        {/* Secondary Category & Account Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span>فلترة إضافية:</span>
          </div>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50"
          >
            <option value="الكل">جميع الفئات</option>
            <optgroup label="فئات الدخل">
              {incomeCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </optgroup>
            <optgroup label="فئات المصروفات">
              {expenseCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </optgroup>
          </select>

          {/* Account Dropdown */}
          {accounts.length > 0 && (
            <select
              value={selectedAccountFilter}
              onChange={e => setSelectedAccountFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50"
            >
              <option value="الكل">جميع الحسابات</option>
              {accounts.map(acc => (
                <option key={acc.id || acc.name} value={acc.name}>
                  {acc.name} ({acc.type})
                </option>
              ))}
            </select>
          )}

          {(selectedCategory !== 'الكل' || selectedAccountFilter !== 'الكل') && (
            <button
              onClick={() => {
                setSelectedCategory('الكل');
                setSelectedAccountFilter('الكل');
              }}
              className="text-xs font-bold text-blue-600 hover:underline px-2"
            >
              إعادة ضبط الفلاتر
            </button>
          )}
        </div>
      </div>

      {/* Transactions Table */}
      <TableView
        title="جدول المعاملات المالية"
        headers={['نوع العملية', 'التاريخ', 'الوصف', 'الفئة', 'الحساب', 'المبلغ', 'الوسوم', 'إجراءات']}
      >
        {filteredList.length === 0 ? (
          <tr>
            <td colSpan={8} className="text-center py-12 text-slate-400 font-bold text-xs">
              لا توجد معاملات مطابقة للبحث أو الفلترة المحددة.
            </td>
          </tr>
        ) : (
          filteredList.map((item) => {
            const isIncome = item.type === 'دخل';
            return (
              <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                {/* Type */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={cn(
                    "inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border",
                    isIncome 
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                      : "bg-rose-50 text-rose-700 border-rose-200"
                  )}>
                    {isIncome ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                    <span>{isIncome ? "دخل" : "مصروف"}</span>
                  </span>
                </td>

                {/* Date */}
                <td className="px-6 py-4 text-slate-500 text-xs font-bold whitespace-nowrap">
                  {item.date}
                </td>

                {/* Description & Location */}
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5 flex-wrap">
                    <span>{item.description}</span>
                    {isIncome && item.category !== 'الراتب' && item.extraIncomeAllocation && (
                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full font-black border",
                        item.extraIncomeAllocation === 'living' && "bg-emerald-50 text-emerald-700 border-emerald-200",
                        item.extraIncomeAllocation === 'salary_split' && "bg-teal-50 text-teal-700 border-teal-200",
                        item.extraIncomeAllocation === 'debt' && "bg-rose-50 text-rose-700 border-rose-200",
                        item.extraIncomeAllocation === 'emergency' && "bg-purple-50 text-purple-700 border-purple-200",
                        item.extraIncomeAllocation === 'savings' && "bg-blue-50 text-blue-700 border-blue-200",
                        item.extraIncomeAllocation === 'unallocated' && "bg-amber-50 text-amber-700 border-amber-200"
                      )}>
                        {item.extraIncomeAllocation === 'living' && '🛒 مخصص للمعيشة'}
                        {item.extraIncomeAllocation === 'salary_split' && '⚖️ موزع بنسب الراتب'}
                        {item.extraIncomeAllocation === 'debt' && '💳 سداد ديون'}
                        {item.extraIncomeAllocation === 'emergency' && '🛡️ صندوق الطوارئ'}
                        {item.extraIncomeAllocation === 'savings' && '📈 ادخار واستثمار'}
                        {item.extraIncomeAllocation === 'unallocated' && '🏦 غير مخصص (بالبنك)'}
                      </span>
                    )}
                  </div>
                  {item.location && (
                    <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium mt-0.5">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span>{item.location}</span>
                    </div>
                  )}
                </td>

                {/* Category */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-xl text-xs font-bold border border-slate-200">
                    {item.category}
                  </span>
                </td>

                {/* Account */}
                <td className="px-6 py-4 text-slate-600 text-xs font-bold whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5 text-slate-400" />
                    <span>{item.paymentMethod}</span>
                  </div>
                </td>

                {/* Amount */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={cn(
                    "font-black text-sm dir-ltr block",
                    isIncome ? "text-emerald-600" : "text-rose-600"
                  )}>
                    {isIncome ? `+${item.amount.toLocaleString('en-US')}` : `-${item.amount.toLocaleString('en-US')}`} ريال
                  </span>
                </td>

                {/* Tags */}
                <td className="px-6 py-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {item.tags && item.tags.length > 0 ? (
                      item.tags.map((tag, idx) => (
                        <span key={idx} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-[10px] font-bold border border-slate-200">
                          #{tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-300 text-[11px]">-</span>
                    )}
                  </div>
                </td>

                {/* Actions */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(item)}
                      title="تعديل العملية"
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id!)}
                      title="حذف العملية"
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })
        )}
      </TableView>

      {/* Add / Edit Transaction Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl border border-slate-100 relative my-8"
            >
              <button
                onClick={closeModal}
                className="absolute top-6 left-6 p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-all"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-6">
                <span className="text-xs font-bold px-3 py-1 rounded-full mb-2 inline-block border bg-rose-50 text-rose-700 border-rose-200">
                  تسجيل مصروف جديد
                </span>
                <h3 className="text-xl font-black text-slate-800">
                  {editingItem ? "تعديل المصروف" : "تسجيل مصروف"}
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-1">
                  أدخل المبلغ والفئة فقط للحفظ السريع.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Amount */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">المبلغ (ريال)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="0.00"
                    className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-base font-black text-slate-800"
                    value={formData.amount || ''}
                    onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0, type: 'مصروف', description: formData.category || 'طعام' })}
                  />
                </div>

                {/* Category */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">الفئة</label>
                  <select
                    required
                    className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold text-slate-800"
                    value={formData.category || 'الطعام'}
                    onChange={e => setFormData({ ...formData, category: e.target.value, description: e.target.value, type: 'مصروف' })}
                  >
                    {expenseCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="pt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-5 py-3 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-all"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-200 transition-all"
                  >
                    حفظ
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Clear Confirmation Modal */}
      <AnimatePresence>
        {showClearConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-3 bg-rose-50 rounded-full text-rose-600">
                  <Trash2 className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-slate-900">هل أنت متأكد من تفريغ المصروفات؟</h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    سيتم حذف كافة المصروفات المسجلة نهائياً لتتمكن من إدخالها يدوياً من الصفر. لا يمكن التراجع عن هذا الإجراء.
                  </p>
                </div>
                <div className="flex gap-3 w-full pt-2">
                  <button
                    onClick={handleClearExpenses}
                    disabled={clearing}
                    className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white font-bold py-3 rounded-xl text-xs shadow-lg shadow-rose-100 transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {clearing ? 'جاري الحذف...' : 'نعم، تفريغ السجل بالكامل'}
                  </button>
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    disabled={clearing}
                    className="px-6 py-3 bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50 font-bold rounded-xl text-xs transition-all cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
