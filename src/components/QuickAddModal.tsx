/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Receipt, 
  Target, 
  Plus, 
  Check, 
  AlertCircle, 
  Landmark, 
  Sparkles,
  CreditCard,
  ShieldAlert,
  PiggyBank,
  Coffee,
  ShoppingBag,
  Car,
  Home,
  Utensils
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useFinanceData } from '../lib/useFinanceData';
import { auth } from '../lib/firebase';
import { formatCurrency, cn } from '../lib/utils';
import { useToast } from '../lib/toast';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: 'income' | 'expense';
}

const COMMON_EXPENSE_CATEGORIES = [
  { name: 'الطعام', icon: Utensils },
  { name: 'المواصلات', icon: Car },
  { name: 'التسوق', icon: ShoppingBag },
  { name: 'السكن', icon: Home },
  { name: 'القهوة والترفيه', icon: Coffee },
];

export function QuickAddModal({ isOpen, onClose, initialType = 'expense' }: QuickAddModalProps) {
  const toast = useToast();
  const { 
    distributeSalaryTransactional,
    quickAddExpenseTransactional,
    quickAddIncomeLivingTransactional,
    quickAddIncomeEmergencyTransactional,
    quickAddIncomeSavingsTransactional,
    quickAddIncomeDebtTransactional,
    quickAddIncomeSalarySplitTransactional,
    quickAddIncomeUnallocatedTransactional,
    accounts,
    expenses,
    transactions = [],
    settings,
    debts
  } = useFinanceData();

  const [activeType, setActiveType] = useState<'income' | 'expense'>(initialType);
  const [incomeType, setIncomeType] = useState<'extra' | 'salary'>('extra');
  const [amount, setAmount] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [category, setCategory] = useState<string>('الطعام');
  const [accountName, setAccountName] = useState<string>('الحساب البنكي الرئيسي');
  
  // Extra income routing
  const [extraAllocationChoice, setExtraAllocationChoice] = useState<'specific' | 'salary_split' | 'unallocated'>('specific');
  const [specificFund, setSpecificFund] = useState<'living' | 'debt' | 'emergency' | 'savings'>('living');
  const [selectedDebtId, setSelectedDebtId] = useState<string>('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const salaryAmount = settings?.salary || 2500;
  const now = new Date();
  const currentMonthStr = now.toISOString().substring(0, 7);
  const localYear = now.getFullYear();
  const localMonth = String(now.getMonth() + 1).padStart(2, '0');
  const localMonthStr = `${localYear}-${localMonth}`;

  const arabicMonthNames = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];
  const currentMonthArabic = `${arabicMonthNames[now.getMonth()]} ${now.getFullYear()}`;

  // Check if salary is already distributed this month
  const hasDistributedThisMonth = useMemo(() => {
    const hasSalaryExpense = expenses.some(e => {
      if (!e.date) return false;
      const isThisMonth = e.date.startsWith(currentMonthStr) || e.date.startsWith(localMonthStr) || (e.description && e.description.includes(currentMonthArabic));
      if (!isThisMonth) return false;

      const isSalaryCat = e.category === 'الراتب';
      const isSalaryType = e.type === 'دخل' && e.category === 'الراتب';
      const isSalaryDesc = e.description && (e.description.includes('راتب') || e.description.includes('توزيع'));

      return isSalaryCat || isSalaryType || isSalaryDesc;
    });

    if (hasSalaryExpense) return true;

    return (transactions || []).some(t => {
      if (!t.date) return false;
      const isThisMonth = t.date.startsWith(currentMonthStr) || t.date.startsWith(localMonthStr) || (t.notes && t.notes.includes(currentMonthArabic));
      if (!isThisMonth) return false;

      return t.notes && (t.notes.includes('تخصيص تلقائي لراتب') || t.notes.includes('توزيع') || t.notes.includes('راتب'));
    });
  }, [expenses, transactions, currentMonthStr, localMonthStr, currentMonthArabic]);

  // Adjust defaults on tab toggle
  useEffect(() => {
    if (activeType === 'income' && incomeType === 'salary') {
      setAmount(salaryAmount.toString());
      setName(`إيداع وتوزيع راتب ${currentMonthArabic}`);
      setAccountName('الحساب البنكي الرئيسي');
    } else {
      setAmount('');
      setName('');
      if (accounts.length > 0) {
        const mainAcc = accounts.find(a => a.name === 'الحساب البنكي الرئيسي') || accounts[0];
        setAccountName(mainAcc.name);
      }
    }
  }, [activeType, incomeType, salaryAmount, currentMonthArabic, accounts]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.warning('يرجى إدخال مبلغ صحيح أكبر من الصفر');
      return;
    }

    setIsSubmitting(true);
    const todayStr = new Date().toISOString().split('T')[0];

    try {
      if (activeType === 'income' && incomeType === 'salary') {
        if (hasDistributedThisMonth) {
          toast.warning(
            `توزيع راتب شهر ${currentMonthArabic} تم تنفيذه بالفعل`,
            'لمنع التكرار، يمكنك مراجعة شاشة الراتب لإلغاء أو إعادة التوزيع.'
          );
          setIsSubmitting(false);
          return;
        }

        // Emergency fund calculations
        const basicExpenses = Math.round(parsedAmount * 0.46);
        const emergencyTarget = basicExpenses * 3;
        const emergencyAccount = accounts.find(a => a.name === 'صندوق الطوارئ' && !a.isArchived);
        const currentEmergencyBalance = emergencyAccount ? (emergencyAccount.balance || 0) : 0;
        const isEmergencyFundComplete = currentEmergencyBalance >= emergencyTarget;

        let debtPct = 26;
        let emergencyPct = isEmergencyFundComplete ? 0 : 16;
        let savingsPct = 12;

        if (debts.length > 0) {
          const debtFund = accounts.find(a => a.name === 'صندوق سداد الديون' || a.name.includes('الديون'));
          const debtFundBalance = debtFund?.balance || 0;
          const rawRemaining = debts.reduce((sum, d) => sum + Math.max(0, (d.totalAmount || 0) - (d.paidAmount || 0)), 0);
          const totalRemaining = Math.max(0, rawRemaining - debtFundBalance);
          if (totalRemaining === 0) {
            if (isEmergencyFundComplete) {
              debtPct = 0;
              emergencyPct = 0;
              savingsPct = 54;
            } else {
              debtPct = 0;
              emergencyPct = 16 + 26;
              savingsPct = 12;
            }
          } else if (isEmergencyFundComplete) {
            debtPct = 26;
            emergencyPct = 0;
            savingsPct = 12 + 16;
          }
        } else if (isEmergencyFundComplete) {
          debtPct = 0;
          emergencyPct = 0;
          savingsPct = 54;
        }

        const debtAmount = Math.round(parsedAmount * (debtPct / 100));
        const emergencyAmount = Math.round(parsedAmount * (emergencyPct / 100));
        const savingsAmount = Math.round(parsedAmount * (savingsPct / 100));
        const operationalAmount = parsedAmount - debtAmount - emergencyAmount - savingsAmount;
        const operationalPct = Math.round((operationalAmount / parsedAmount) * 100);

        await distributeSalaryTransactional(
          parsedAmount,
          {
            debtAmount,
            debtPct,
            emergencyAmount,
            emergencyPct,
            savingsAmount,
            savingsPct,
            operationalAmount,
            operationalPct
          },
          currentMonthStr,
          currentMonthArabic
        );

        toast.success(`تم استلام وتوزيع راتب ${currentMonthArabic} بنجاح!`);
        onClose();
        return;
      }

      if (activeType === 'income' && incomeType === 'extra') {
        if (extraAllocationChoice === 'specific') {
          if (specificFund === 'living') {
            await quickAddIncomeLivingTransactional(parsedAmount, name || 'دخل إضافي (معيشة)', todayStr);
            toast.success(`تم توجيه ${formatCurrency(parsedAmount)} لميزانية المعيشة بنجاح!`);
          } else if (specificFund === 'debt') {
            const targetDebt = debts.find(d => d.id === (selectedDebtId || debts[0]?.id)) || debts[0];
            await quickAddIncomeDebtTransactional(parsedAmount, name || 'دخل إضافي (ديون)', targetDebt?.id, todayStr);
            toast.success(`تم توجيه ${formatCurrency(parsedAmount)} لسداد الدين بنجاح!`);
          } else if (specificFund === 'emergency') {
            await quickAddIncomeEmergencyTransactional(parsedAmount, name || 'دخل إضافي (طوارئ)', todayStr);
            toast.success(`تم إيداع ${formatCurrency(parsedAmount)} في صندوق الطوارئ!`);
          } else if (specificFund === 'savings') {
            await quickAddIncomeSavingsTransactional(parsedAmount, name || 'دخل إضافي (ادخار)', todayStr);
            toast.success(`تم إيداع ${formatCurrency(parsedAmount)} في صندوق الادخار والاستثمار!`);
          }
        } else if (extraAllocationChoice === 'salary_split') {
          await quickAddIncomeSalarySplitTransactional(parsedAmount, name || 'دخل إضافي موزع بالنسبة', todayStr);
          toast.success(`تم توزيع الدخل الإضافي (${formatCurrency(parsedAmount)}) بنسب الراتب بنجاح!`);
        } else if (extraAllocationChoice === 'unallocated') {
          await quickAddIncomeUnallocatedTransactional(parsedAmount, name || 'دخل إضافي غير مخصص', todayStr);
          toast.success(`تم حفظ ${formatCurrency(parsedAmount)} كفائض غير مخصص في الحساب.`);
        }

        onClose();
        return;
      }

      if (activeType === 'expense') {
        await quickAddExpenseTransactional(parsedAmount, name || category, accountName, category, todayStr);
        toast.success(`تم تسجيل مصروف ${formatCurrency(parsedAmount)} بنجاح!`);
        onClose();
      }

    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء حفظ الحركة المالية: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs dir-rtl text-right">
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-100 space-y-5 max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <span>تسجيل حركة مالية</span>
            </h3>
            <button 
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Step 1: Main Type Selector (Expense vs Income) */}
          <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveType('expense')}
              className={cn(
                "flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer",
                activeType === 'expense' 
                  ? "bg-rose-600 text-white shadow-md shadow-rose-200" 
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>مصروف (-صادر)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveType('income');
                setIncomeType('extra');
              }}
              className={cn(
                "flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer",
                activeType === 'income' 
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-200" 
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>دخل (+وارد)</span>
            </button>
          </div>

          {/* Income Sub-Type (Extra vs Salary) */}
          {activeType === 'income' && (
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-50 border border-slate-200 rounded-xl">
              <button
                type="button"
                onClick={() => setIncomeType('extra')}
                className={cn(
                  "py-2 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  incomeType === 'extra' 
                    ? "bg-white text-emerald-700 shadow-sm border border-emerald-100 font-black" 
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                دخل إضافي / مكافأة
              </button>

              <button
                type="button"
                onClick={() => setIncomeType('salary')}
                className={cn(
                  "py-2 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  incomeType === 'salary' 
                    ? "bg-emerald-600 text-white shadow-sm font-black" 
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                الراتب الشهري ({formatCurrency(salaryAmount)})
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Step 2: Big Amount Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">المبلغ المطلوب تسجيله (ريال)</label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  required
                  autoFocus
                  placeholder="0.00"
                  className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-2xl font-black text-slate-900 text-center tracking-tight"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  ريال
                </span>
              </div>
            </div>

            {/* Expense: Category Selector */}
            {activeType === 'expense' && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">الفئة</label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {COMMON_EXPENSE_CATEGORIES.map(cat => {
                    const Icon = cat.icon;
                    const isSelected = category === cat.name;
                    return (
                      <button
                        key={cat.name}
                        type="button"
                        onClick={() => {
                          setCategory(cat.name);
                          if (!name) setName(cat.name);
                        }}
                        className={cn(
                          "p-2.5 rounded-xl border flex flex-col items-center gap-1 text-[11px] font-bold transition-all cursor-pointer",
                          isSelected 
                            ? "border-emerald-500 bg-emerald-50 text-emerald-800 font-black shadow-xs" 
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="truncate max-w-full">{cat.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 3: Account Selector */}
            {accounts.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  {activeType === 'expense' ? 'يُخصم من حساب' : 'يُودع في حساب'}
                </label>
                <select
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-bold text-slate-800 bg-white"
                  value={accountName}
                  onChange={e => setAccountName(e.target.value)}
                >
                  {accounts.filter(a => !a.isArchived).map(acc => (
                    <option key={acc.id || acc.name} value={acc.name}>
                      {acc.name} ({formatCurrency(acc.balance || 0)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Extra Income: Progressive Allocation Options */}
            {activeType === 'income' && incomeType === 'extra' && (
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <label className="text-xs font-bold text-slate-700 block">وجهة تخصيص الدخل الإضافي</label>
                <div className="grid grid-cols-3 gap-2 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => { setExtraAllocationChoice('specific'); setSpecificFund('living'); }}
                    className={cn(
                      "p-2 rounded-xl border text-center transition-all cursor-pointer",
                      extraAllocationChoice === 'specific' && specificFund === 'living' 
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs" 
                        : "bg-white border-slate-200 text-slate-700"
                    )}
                  >
                    للمعيشة
                  </button>

                  <button
                    type="button"
                    onClick={() => { setExtraAllocationChoice('specific'); setSpecificFund('debt'); }}
                    className={cn(
                      "p-2 rounded-xl border text-center transition-all cursor-pointer",
                      extraAllocationChoice === 'specific' && specificFund === 'debt' 
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs" 
                        : "bg-white border-slate-200 text-slate-700"
                    )}
                  >
                    لسداد دين
                  </button>

                  <button
                    type="button"
                    onClick={() => { setExtraAllocationChoice('specific'); setSpecificFund('savings'); }}
                    className={cn(
                      "p-2 rounded-xl border text-center transition-all cursor-pointer",
                      extraAllocationChoice === 'specific' && specificFund === 'savings' 
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs" 
                        : "bg-white border-slate-200 text-slate-700"
                    )}
                  >
                    للادخار
                  </button>
                </div>
              </div>
            )}

            {/* Description (Optional) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">ملاحظات / وصف (اختياري)</label>
              <input
                type="text"
                placeholder={activeType === 'expense' ? 'مثال: مشتريات البقالة' : 'مثال: مكافأة الأداء'}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-medium text-slate-800"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:bg-emerald-400 text-white font-black text-sm shadow-md shadow-emerald-200 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>{isSubmitting ? 'جاري الحفظ...' : 'تأكيد الحفظ'}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-5 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
