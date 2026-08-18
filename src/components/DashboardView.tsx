/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { updateDoc, doc, collection, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { 
  BudgetItem, 
  DebtItem, 
  SavingsRecord, 
  Expense, 
  UserSettings,
  FinancialGoal,
  SubscriptionBill,
  AccountItem,
  Transaction,
  MonthlyClosure
} from '../types';
import { 
  Wallet, 
  CreditCard, 
  PiggyBank, 
  Target, 
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Coins,
  Sparkles,
  CalendarDays,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  Banknote,
  Receipt,
  RefreshCw
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { SalaryDistributor } from './SalaryDistributor';
import { GeminiExpenseInsightsCard } from './GeminiExpenseInsightsCard';
import { MonthCloseCard } from './MonthCloseCard';
import { getAccountIconComponent, getAccountColorClasses } from './AccountsView';

interface DashboardViewProps {
  settings: UserSettings | null;
  budget: BudgetItem[];
  debts: DebtItem[];
  savings: SavingsRecord[];
  expenses: Expense[];
  tasks?: any[];
  goals?: FinancialGoal[];
  subscriptions?: SubscriptionBill[];
  accounts?: AccountItem[];
  transactions?: Transaction[];
  monthlyClosures?: MonthlyClosure[];
  onQuickAdd?: (type: 'income' | 'bill' | 'savings' | 'expense') => void;
  onNavigateTab?: (tab: string) => void;
}

export function DashboardView({ 
  settings, 
  budget, 
  debts, 
  expenses, 
  goals = [],
  subscriptions = [],
  accounts = [],
  transactions = [],
  monthlyClosures = [],
  onQuickAdd,
  onNavigateTab
}: DashboardViewProps) {
  
  // Extra income routing state
  const [routingExtraIncomeItem, setRoutingExtraIncomeItem] = useState<Expense | null>(null);
  const [showClearCacheModal, setShowClearCacheModal] = useState(false);

  const handleClearCache = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  };
  const [routingDestination, setRoutingDestination] = useState<'debt' | 'emergency' | 'savings'>('debt');
  const [selectedDebtIdForRouting, setSelectedDebtIdForRouting] = useState<string>('');
  const [routingSuccessMsg, setRoutingSuccessMsg] = useState<string | null>(null);
  const [isRoutingSubmitting, setIsRoutingSubmitting] = useState(false);

  const handleExecuteExtraRouting = async () => {
    if (!routingExtraIncomeItem) return;
    setIsRoutingSubmitting(true);
    try {
      const amt = routingExtraIncomeItem.amount;
      if (routingDestination === 'debt') {
        const targetDebt = debts.find(d => d.id === (selectedDebtIdForRouting || debts[0]?.id)) || debts[0];
        if (targetDebt && targetDebt.id) {
          const currentUnpaid = targetDebt.totalAmount - targetDebt.paidAmount;
          const newPaid = Math.min(targetDebt.totalAmount, targetDebt.paidAmount + amt);
          const newStatus = newPaid >= targetDebt.totalAmount ? 'تم' : 'قيد الانتظار';
          await updateDoc(doc(db, 'debts', targetDebt.id), {
            paidAmount: newPaid,
            status: newStatus
          });
          const remainingAfter = targetDebt.totalAmount - newPaid;
          setRoutingSuccessMsg(`🎉 تم سداد الدين بالمكافأة (${formatCurrency(amt)})! انخفضت المديونية من ${formatCurrency(currentUnpaid)} إلى ${formatCurrency(remainingAfter)} ريال!`);
        }
      } else if (routingDestination === 'emergency') {
        const emgAcc = accounts.find(a => a.name.includes('طوارئ') || String(a.type).includes('طوارئ'));
        if (emgAcc && emgAcc.id) {
          await updateDoc(doc(db, 'accounts', emgAcc.id), { balance: (emgAcc.balance || 0) + amt });
        }
        setRoutingSuccessMsg(`🎉 تم توجيه إيداع الـ ${formatCurrency(amt)} لصندوق الطوارئ بنجاح!`);
      } else if (routingDestination === 'savings') {
        const savAcc = accounts.find(a => a.name.includes('ادخار') || String(a.type).includes('ادخار'));
        if (savAcc && savAcc.id) {
          await updateDoc(doc(db, 'accounts', savAcc.id), { balance: (savAcc.balance || 0) + amt });
        }
        setRoutingSuccessMsg(`🎉 تم توجيه إيداع الـ ${formatCurrency(amt)} لصندوق الادخار والاستثمار بنجاح!`);
      }

      setTimeout(() => {
        setRoutingSuccessMsg(null);
        setRoutingExtraIncomeItem(null);
      }, 1500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRoutingSubmitting(false);
    }
  };

  // Date & Month calculations
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthNum = now.getMonth() + 1;
  const currentMonthStr = `${currentYear}-${currentMonthNum.toString().padStart(2, '0')}`;
  const dayOfMonth = now.getDate();
  const totalDaysInMonth = new Date(currentYear, currentMonthNum, 0).getDate();
  const daysRemaining = Math.max(1, totalDaysInMonth - dayOfMonth + 1);

  // 1. الرصيد الفعلي الكلي (Total Actual Liquid Balance including all boxes and bank accounts)
  const actualBalance = useMemo(() => {
    if (accounts.length > 0) {
      return accounts.filter(a => !a.isArchived).reduce((acc, curr) => acc + (curr.balance || 0), 0);
    }
    // Fallback if no accounts configured: Total Income - Total Expense
    const inc = expenses.filter(e => e.type === 'دخل').reduce((sum, e) => sum + (e.amount || 0), 0);
    const exp = expenses.filter(e => e.type === 'مصروف' || !e.type).reduce((sum, e) => sum + (e.amount || 0), 0);
    return Math.max(0, inc - exp);
  }, [accounts, expenses]);

  // Income vs Expense summary for current month
  const currentMonthIncomes = useMemo(() => {
    return expenses
      .filter(e => e.type === 'دخل' && e.date && e.date.startsWith(currentMonthStr))
      .reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [expenses, currentMonthStr]);

  // 💵 الدخل الإضافي (الفائض الإضافي) - مبالغ الدخل خارج الراتب
  const currentMonthExtraIncomeList = useMemo(() => {
    return expenses.filter(e => e.type === 'دخل' && e.category !== 'الراتب' && e.date && e.date.startsWith(currentMonthStr));
  }, [expenses, currentMonthStr]);

  const currentMonthExtraIncome = useMemo(() => {
    return currentMonthExtraIncomeList.reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [currentMonthExtraIncomeList]);

  const currentMonthExpenses = useMemo(() => {
    return expenses
      .filter(e => {
        const isExpense = (e.type === 'مصروف' || !e.type);
        const isCurrentMonth = e.date && e.date.startsWith(currentMonthStr);
        // Exclude internal transfers that might have been accidentally logged as expenses
        const isInternalTransfer = e.category === 'صندوق مخصص' || e.category === 'الراتب' || e.description?.includes('توزيع') || e.description?.includes('تخصيص');
        // Exclude expenses paid from dedicated reserve funds or debt repayments
        const isDebtOrDedicatedFundExpense = 
          e.paymentMethod === 'صندوق سداد الديون' || 
          e.paymentMethod === 'صندوق الادخار والاستثمار' || 
          e.paymentMethod === 'صندوق الطوارئ' ||
          e.category === 'الديون' ||
          e.category === 'سداد دين' ||
          e.description?.includes('سداد دفعة من دين') ||
          e.description?.includes('سداد دين');
        return isExpense && isCurrentMonth && !isInternalTransfer && !isDebtOrDedicatedFundExpense;
      })
      .reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [expenses, currentMonthStr]);

  // Calculate current month in Arabic
  const currentMonthArabic = useMemo(() => {
    const arabicMonthNames = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    return `${arabicMonthNames[now.getMonth()]} ${now.getFullYear()}`;
  }, [now]);

  // Check if already distributed this month
  const hasDistributedThisMonth = useMemo(() => {
    const utcMonthStr = now.toISOString().substring(0, 7);
    const hasSalaryExpense = expenses.some(e => {
      if (!e.date) return false;
      const isThisMonth = e.date.startsWith(currentMonthStr) || e.date.startsWith(utcMonthStr) || (e.description && e.description.includes(currentMonthArabic));
      if (!isThisMonth) return false;

      const isSalaryCat = e.category === 'الراتب';
      const isSalaryType = e.type === 'دخل' && e.category === 'الراتب';
      const isSalaryDesc = e.description && (e.description.includes('راتب') || e.description.includes('توزيع'));

      return isSalaryCat || isSalaryType || isSalaryDesc;
    });

    if (hasSalaryExpense) return true;

    return (transactions || []).some(t => {
      if (!t.date) return false;
      const isThisMonth = t.date.startsWith(currentMonthStr) || t.date.startsWith(utcMonthStr) || (t.notes && t.notes.includes(currentMonthArabic));
      if (!isThisMonth) return false;

      return t.notes && (t.notes.includes('تخصيص تلقائي لراتب') || t.notes.includes('توزيع') || t.notes.includes('راتب'));
    });
  }, [expenses, transactions, currentMonthStr, now, currentMonthArabic]);

  // 2. المخصص للمصاريف التشغيلية (46%) - محسوب بدقة متناهية لمنع الفروقات والنسب اليدوية
  const salary = settings?.salary || 2500;

  // 5. كم بقي من الديون (Remaining Debts)
  const debtFund = accounts.find(a => a.name === 'صندوق سداد الديون' || a.name.includes('الديون'));
  const debtFundBalance = debtFund?.balance || 0;

  const totalDebtsRemaining = useMemo(() => {
    const raw = debts.reduce((sum, d) => sum + Math.max(0, (d.totalAmount || 0) - (d.paidAmount || 0)), 0);
    return Math.max(0, raw - debtFundBalance);
  }, [debts, debtFundBalance]);

  const isDebtFree = debts.length > 0 && totalDebtsRemaining === 0;

  // Check if Emergency Fund is fully funded based on 3 months of basic expenses (46% of salary)
  const basicExpenses = Math.round(salary * 0.46);
  const emergencyTarget = basicExpenses * 3; // 3 months of basic expenses
  const emergencyAccount = useMemo(() => {
    return accounts.find(a => a.name === 'صندوق الطوارئ' && !a.isArchived);
  }, [accounts]);
  const currentEmergencyBalance = emergencyAccount ? (emergencyAccount.balance || 0) : 0;
  const isEmergencyFundComplete = currentEmergencyBalance >= emergencyTarget;

  const savingsAccount = accounts.find(a => a.name.includes('ادخار') || a.name.includes('استثمار'));
  const savingsBalance = savingsAccount ? (savingsAccount.balance || 0) : 0;
  const physicalAccounts = accounts.filter(a => !a.isArchived && a.type !== 'صندوق مخصص' && !a.name.includes('صندوق'));

  // Dynamic cascading allocations according to system rules (الشلال المالي):
  // 1. Debt Pct: 26% if debts exist, otherwise 0% (the 26% cascades to next goal)
  // 2. Emergency Pct:
  //    - If complete: 0% (its 16% + any cascaded 26% from debt goes to savings)
  //    - If NOT complete:
  //       - Base 16%
  //       - Plus 26% from debt if debt-free (cascades from completed debt goal)
  // 3. Savings Pct:
  //    - Base 12%
  //    - Plus 16% from emergency if complete
  //    - Plus 26% from debt if debt-free AND emergency is complete
  let debtPct = 0;
  let emergencyPct = 0;
  let savingsPct = 12;

  if (!isDebtFree) {
    debtPct = 26;
    if (!isEmergencyFundComplete) {
      emergencyPct = 16;
    } else {
      savingsPct += 16;
    }
  } else {
    if (!isEmergencyFundComplete) {
      emergencyPct = 16 + 26; // 42%
    } else {
      savingsPct += 26 + 16; // 54%
    }
  }

  const debtAmount = Math.round(salary * (debtPct / 100));
  const emergencyAmount = Math.round(salary * (emergencyPct / 100));
  const savingsAmount = Math.round(salary * (savingsPct / 100));
  
  // Check for previous month rollover to the same living fund
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthStr = `${prevDate.getFullYear()}-${(prevDate.getMonth() + 1).toString().padStart(2, '0')}`;
  const prevMonthClosure = monthlyClosures.find(c => c.month === prevMonthStr && c.status === 'closed' && c.allocationChoice === 'rollover');
  const rolloverFromPrevMonth = prevMonthClosure ? (prevMonthClosure.allocationAmount || 0) : 0;

  const baseLivingAmount = salary - debtAmount - emergencyAmount - savingsAmount;
  const operationalBudget = baseLivingAmount + rolloverFromPrevMonth + currentMonthExtraIncome;

  // 3. المتبقي أو العجز للمعيشة
  const isLivingOverBudget = currentMonthExpenses > operationalBudget;
  const livingOverBudgetAmount = isLivingOverBudget ? currentMonthExpenses - operationalBudget : 0;
  const remainingToLive = Math.max(0, operationalBudget - currentMonthExpenses);

  // 4. المتاح اليومي للمعيشة
  const dailyAvailableToLive = isLivingOverBudget ? 0 : Math.round(remainingToLive / daysRemaining);

  // Active accounts preview
  const activeAccounts = useMemo(() => accounts.filter(a => !a.isArchived), [accounts]);

  // Pending bills list
  const pendingBills = useMemo(() => subscriptions.filter(s => s.status !== 'مدفوع'), [subscriptions]);

  return (
    <div className="space-y-6 pb-12 dir-rtl text-right font-sans">
      
      {/* Primary Financial Rule Hero Banner */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-white text-slate-900 p-6 sm:p-8 shadow-sm border border-slate-200"
      >
        <div className="absolute top-0 left-0 -mt-10 -ml-10 w-48 h-48 bg-emerald-50 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 -mb-10 -mr-10 w-64 h-64 bg-teal-50 rounded-full blur-3xl pointer-events-none" />

        {/* 6 Core Questions Grid */}
        <div className="relative z-10 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>قاعدة التوزيع التلقائية للراتب (100%)</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
                لوحة التحكم والتحليل المالي الموحد
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  console.log('Opening Clear Cache Modal');
                  setShowClearCacheModal(true);
                }}
                className="p-3 rounded-2xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all flex items-center gap-2 text-xs font-bold border border-slate-200"
                title="مسح الذاكرة المؤقتة"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="inline">مسح الذاكرة</span>
              </button>

              <button
                onClick={() => onQuickAdd?.('income')}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 text-white font-black text-sm shadow-sm hover:bg-emerald-700 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>تسجيل دخل / مصروف</span>
              </button>
            </div>
          </div>

          {/* 6 Answers Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            
            {/* 1. كم راتبي؟ */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
              <span className="text-xs text-slate-500 font-bold block">1️⃣ كم راتبي؟</span>
              <div className="text-2xl font-black text-slate-800">{formatCurrency(settings?.salary || 2500)}</div>
              <span className="text-[11px] text-slate-400 font-medium block">الراتب الشهري الثابت المعتمد</span>
            </div>





            {/* 4. ماذا صرفت؟ */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
              <span className="text-xs text-slate-500 font-bold block">4️⃣ ماذا صرفت هذا الشهر؟</span>
              <div className="text-2xl font-black text-slate-800">{formatCurrency(currentMonthExpenses)}</div>
              <span className="text-[11px] text-slate-400 font-medium block">إجمالي المصروفات المعيشية المسجلة فعلياً</span>
            </div>

            {/* 5. ماذا تبقى للمعيشة؟ */}
            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 space-y-1">
              <span className="text-xs text-emerald-700 font-bold block">5️⃣ المتبقي للمصاريف المعيشية</span>
              <div className="text-2xl font-black text-emerald-800">
                {formatCurrency(remainingToLive)}
              </div>
              <span className="text-[11px] text-emerald-600 font-medium block">المتبقي الصافي = مخصص المصاريف − المصروفات</span>
            </div>



          </div>

          {/* كيف تم توزيعه؟ (Breakdown Bar) */}
          <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600">
              <span>توزيع الراتب التلقائي المعتمد</span>
              <span className="text-emerald-700">الإجمالي = {formatCurrency(salary)} (100%)</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-bold text-center">
              <div className={cn(
                "p-2.5 rounded-xl transition-all border",
                isDebtFree 
                  ? "bg-slate-50 border-slate-200 text-slate-400" 
                  : "bg-white border-slate-200 text-slate-700 shadow-sm"
              )}>
                <span className="block text-[10px] text-slate-500 mb-1">
                  💳 سداد الديون {isDebtFree ? "(مكتمل - 0%)" : "(26%)"}
                </span>
                <span className="text-sm font-black">{formatCurrency(debtAmount)}</span>
              </div>
              <div className={cn(
                "p-2.5 rounded-xl transition-all border",
                isEmergencyFundComplete 
                  ? "bg-slate-50 border-slate-200 text-slate-400" 
                  : "bg-white border-slate-200 text-slate-700 shadow-sm"
              )}>
                <span className="block text-[10px] text-slate-500 mb-1">
                  🚨 صندوق الطوارئ {isEmergencyFundComplete ? "(مكتمل - 0%)" : "(16%)"}
                </span>
                <span className="text-sm font-black">{formatCurrency(emergencyAmount)}</span>
              </div>
              <div className="bg-white border border-slate-200 p-2.5 rounded-xl text-slate-700 shadow-sm">
                <span className="block text-[10px] text-slate-500 mb-1">
                  💰 الادخار والاستثمار ({savingsPct}%)
                  {(isDebtFree || isEmergencyFundComplete) && " 🚀"}
                </span>
                <span className="text-sm font-black">{formatCurrency(savingsAmount)}</span>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl text-emerald-800 shadow-sm flex flex-col gap-1">
                <span className="block text-[10px] text-emerald-600">🏠 المتاح للمعيشة</span>
                <span className="text-sm font-black">{formatCurrency(operationalBudget)}</span>
                <div className="text-[9px] text-emerald-700/80 font-medium flex flex-col gap-0.5 mt-1 pt-1 border-t border-emerald-200/50">
                  <div className="flex justify-between">
                    <span>مخصص الشهر:</span>
                    <span>{formatCurrency(baseLivingAmount)}</span>
                  </div>
                  {rolloverFromPrevMonth > 0 && (
                    <div className="flex justify-between">
                      <span>مرحّل من السابق:</span>
                      <span>+{formatCurrency(rolloverFromPrevMonth)}</span>
                    </div>
                  )}
                  {currentMonthExtraIncome > 0 && (
                    <div className="flex justify-between">
                      <span>دخل إضافي:</span>
                      <span>+{formatCurrency(currentMonthExtraIncome)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      </motion.div>

      {/* Warning banner when living budget runs out ( المتاح للمصاريف = 0 ) */}
      {operationalBudget - currentMonthExpenses <= 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-rose-50 border border-rose-200 rounded-3xl p-5 md:p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center gap-4 text-rose-800"
        >
          <div className="w-10 h-10 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0 font-black text-lg shadow-sm">
            🔴
          </div>
          <div className="space-y-1 flex-1 text-right">
            <h4 className="text-base font-black text-rose-900">انتهى مخصص المعيشة لهذا الشهر</h4>
            <p className="text-xs text-rose-700 font-bold">
              لا يتبقى مبلغ متاح للمصاريف حتى موعد الراتب القادم.
            </p>
            <p className="text-[11px] text-slate-500 font-semibold leading-relaxed mt-1">
              🛡️ <b>سياسة النظام الصارمة:</b> لم يتم سحب أي مبالغ تلقائياً من الطوارئ أو الادخار والاستثمار أو مخصص الديون للحفاظ على خطتك المالية المعتمدة. إذا أردت استخدام أي مبلغ من الطوارئ، فيجب عليك اتخاذ قرار يدوي بسحبه أو تحويله بنفسك.
            </p>
          </div>
        </motion.div>
      )}

      {/* Celebratory banner when all debts are paid off */}
      {debts.length > 0 && totalDebtsRemaining === 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50 border border-emerald-200 rounded-3xl p-5 md:p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center gap-4 text-emerald-800"
        >
          <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 font-black text-lg shadow-sm animate-bounce">
            🎉
          </div>
          <div className="space-y-1 flex-1 text-right">
            <h4 className="text-base font-black text-emerald-900">🎉 تم إغلاق الديون بالكامل!</h4>
            <p className="text-xs text-emerald-700 font-bold">
              لقد حققت الحرية المالية من الديون!
            </p>
            <p className="text-[11px] text-slate-600 font-semibold leading-relaxed mt-1">
              🛡️ <b>شلال إعادة التوجيه التلقائي:</b> تماشياً مع خطتك المالية لعدم تضييع أي مخصص مالي، تم إعادة توجيه الـ <b>26%</b> الخاصة بالديون تلقائياً إلى <b>{isEmergencyFundComplete ? "صندوق الادخار والاستثمار" : "صندوق الطوارئ"}</b> {isEmergencyFundComplete ? "لترتفع حصته الإجمالية إلى 54% لتسريع بناء ثروتك!" : "لتسريع بناء درع الأمان المالي ليرتفع مخصص الطوارئ الإجمالي إلى 42%!"} وكل هذا مع بقاء مخصص معيشتك ثابتاً ومحميّاً بنسبة 46%.
            </p>
          </div>
        </motion.div>
      )}

      {/* Celebratory banner when Emergency Fund is fully funded */}
      {isEmergencyFundComplete && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-purple-50 border border-purple-200 rounded-3xl p-5 md:p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center gap-4 text-purple-800"
        >
          <div className="w-10 h-10 rounded-full bg-purple-500 text-white flex items-center justify-center shrink-0 font-black text-lg shadow-sm animate-bounce">
            🎉
          </div>
          <div className="space-y-1 flex-1 text-right">
            <h4 className="text-base font-black text-purple-900">🎉 اكتمل صندوق الطوارئ بالكامل!</h4>
            <p className="text-xs text-purple-700 font-bold">
              لقد أمنت 3 أشهر من مصاريفك الأساسية بقيمة {formatCurrency(currentEmergencyBalance)}.
            </p>
            <p className="text-[11px] text-slate-600 font-semibold leading-relaxed mt-1">
              🛡️ <b>شلال إعادة التوجيه التلقائي:</b> تم إيقاف اقتطاع الطوارئ (16%) وتوجيه حصتها تلقائياً إلى <b>صندوق الادخار والاستثمار</b> {isDebtFree ? "(بالإضافة للـ 26% السابقة من الديون التي تم سدادها بنجاح)" : ""} لتصبح النسبة المخصصة لبناء ثروتك شهرياً هي <b>{savingsPct}%</b>!
            </p>
          </div>
        </motion.div>
      )}

      {/* Exceeded Living Budget Warning Banner */}
      {isLivingOverBudget && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-rose-50 border-2 border-rose-300 rounded-3xl p-5 md:p-6 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-rose-950"
        >
          <div className="flex items-start md:items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 font-black text-xl shadow-sm">
              🔴
            </div>
            <div className="space-y-1 text-right">
              <h4 className="text-base font-black text-rose-950 flex items-center gap-2">
                <span>تجاوزت مخصص المعيشة بـ {formatCurrency(livingOverBudgetAmount)}</span>
              </h4>
              <p className="text-xs text-rose-800 font-bold">
                المتاح المعيشي (46%): {formatCurrency(operationalBudget)} | المصروف الفعلي: {formatCurrency(currentMonthExpenses)}
              </p>
              <p className="text-[11px] text-rose-700 font-semibold leading-relaxed mt-1">
                🛡️ <b>قاعدة حماية الصناديق:</b> لا يقوم التطبيق إطلاقاً بالسحب تلقائياً من صندوق الطوارئ أو الادخار لحماية أهدافك وأمانك المالي. القرار يعود لك تماماً إذا أردت سحب أو تحويل مبلغ من صندوق آخر.
              </p>
            </div>
          </div>
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('accounts')}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs transition-all shadow-sm shrink-0 active:scale-95 self-end md:self-center"
            >
              قرار يدوي: تحويل من صندوق آخر ←
            </button>
          )}
        </motion.div>
      )}



      {/* Salary Receiving & Auto-Distribution Module */}
      <SalaryDistributor 
        settings={settings} 
        budget={budget} 
        accounts={accounts} 
        expenses={expenses} 
        transactions={transactions} 
        debts={debts}
      />

      {/* 🧠 Gemini AI Expense Insights Card */}
      <GeminiExpenseInsightsCard
        settings={settings}
        expenses={expenses}
        salaryAmount={salary}
        accounts={accounts}
        debts={debts}
      />

      {/* حسبة المتبقي للمصاريف المعيشية */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-6 rounded-3xl border border-emerald-200 shadow-sm relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="space-y-1.5 text-center lg:text-right">
            <h3 className="text-lg font-black text-slate-900 flex items-center justify-center lg:justify-start gap-2">
              <span className="text-emerald-600">📊</span>
              <span>حسبة المتبقي للمصاريف المعيشية</span>
            </h3>
            <p className="text-xs text-slate-500 font-semibold leading-relaxed">
              المعادلة التلقائية لتحديد رصيدك المعيشي المتبقي بعد خصم المصروفات المسجلة من مخصصك المعيشي (46%).
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 font-black text-sm text-slate-700">
            {/* مخصص المصاريف */}
            <div className="text-center px-4 py-2 bg-white rounded-xl shadow-sm border border-slate-200">
              <span className="block text-[10px] text-slate-400 font-bold mb-1">مخصص المصاريف (46%)</span>
              <span className="text-lg text-emerald-600">{formatCurrency(operationalBudget)}</span>
            </div>

            <div className="text-slate-400 text-xl font-bold font-mono">−</div>

            {/* المصروفات المسجلة */}
            <div className="text-center px-4 py-2 bg-white rounded-xl shadow-sm border border-slate-200">
              <span className="block text-[10px] text-slate-400 font-bold mb-1">المصروفات المسجلة</span>
              <span className="text-lg text-rose-500">{formatCurrency(currentMonthExpenses)}</span>
            </div>

            <div className="text-slate-400 text-xl font-bold font-mono">=</div>

            {/* المتبقي أو العجز للمصاريف المعيشية */}
            <div className={`text-center px-5 py-2.5 text-white rounded-xl shadow-md ${isLivingOverBudget ? 'bg-rose-600' : 'bg-emerald-600'}`}>
              <span className="block text-[10px] text-white/80 font-bold mb-1">
                {isLivingOverBudget ? 'تجاوز مخصص المعيشة' : 'المتبقي للمصاريف المعيشية'}
              </span>
              <span className="text-xl font-black">
                {isLivingOverBudget ? `🔴 -${formatCurrency(livingOverBudgetAmount)}` : formatCurrency(remainingToLive)}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Primary Financial Pillars (الأساس المالي للتطبيق) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        


        {/* 2. المتبقي للمعيشة / أو تجاوز المخصص */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`p-5 rounded-2xl border shadow-sm hover:shadow-md transition-shadow ${
            isLivingOverBudget ? 'bg-rose-50/80 border-rose-300' : 'bg-emerald-50/20 border-emerald-200'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className={`text-xs font-bold ${isLivingOverBudget ? 'text-rose-800' : 'text-emerald-700'}`}>
              {isLivingOverBudget ? 'تجاوز مخصص المعيشة' : 'المتبقي للمعيشة هذا الشهر'}
            </span>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              isLivingOverBudget ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
            }`}>
              <Banknote className="w-5 h-5" />
            </div>
          </div>
          <div className={`text-2xl font-black mb-1 ${isLivingOverBudget ? 'text-rose-600' : 'text-emerald-700'}`}>
            {isLivingOverBudget ? `🔴 -${formatCurrency(livingOverBudgetAmount, 'SAR')}` : formatCurrency(remainingToLive, 'SAR')}
          </div>
          <div className={`text-xs font-medium ${isLivingOverBudget ? 'text-rose-700 font-bold' : 'text-emerald-600'}`}>
            {isLivingOverBudget 
              ? `عجز معيشي (لا يُسحب تلقائياً من الطوارئ/الادخار)` 
              : `من أصل الـ 46% التشغيلية (${formatCurrency(operationalBudget, 'SAR')}) بعد خصم مصروفاتك`}
          </div>
        </motion.div>

        {/* 3. المتاح اليومي */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500">المتاح اليومي للمعيشة</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <CalendarDays className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mb-1">
            {formatCurrency(dailyAvailableToLive, 'SAR')}
            <span className="text-xs font-normal text-slate-500 mr-1">/ يوم</span>
          </div>
          <div className="text-xs text-slate-500 font-medium">
            موزع على {daysRemaining} يوماً متبقية من هذا الشهر
          </div>
        </motion.div>



      </div>

      {/* 🗓️ Monthly Close & Surplus Routing Card (إغلاق الشهر المالي) */}
      <MonthCloseCard 
        settings={settings}
        expenses={expenses}
        accounts={accounts}
        debts={debts}
        monthlyClosures={monthlyClosures}
        onNavigateTab={onNavigateTab}
      />

      {/* Main Content Grid: Accounts, Quick Flow, and Pending Commitments */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Column 1 & 2: Account Balances & Recent Transactions */}
        <div className="lg:col-span-2 space-y-6">

          {/* الحسابات الفعلية وتوزيع داخلي للرصيد (أظرف التوزيع) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-emerald-600" />
                <h2 className="text-base font-bold text-slate-900">الحسابات الفعلية والتوزيع الداخلي للرصيد (الأظرف)</h2>
              </div>
              <button
                onClick={() => onNavigateTab?.('accounts')}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 transition-colors"
              >
                إدارة الحسابات ←
              </button>
            </div>

            {/* الحسابات النقدية والبنكية الفعلية */}
            <div>
              <h3 className="text-xs font-black text-slate-500 mb-2.5 uppercase tracking-wider">الحسابات النقدية والبنكية</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {physicalAccounts.length > 0 ? (
                  physicalAccounts.map((acc) => {
                    // For the main bank account, if tracked as total pool, show total liquid balance
                    const displayBalance = acc.name === 'الحساب البنكي الرئيسي' 
                      ? (remainingToLive + debtFundBalance + currentEmergencyBalance + savingsBalance)
                      : (acc.balance || 0);
                    const AccIcon = getAccountIconComponent(acc.icon, acc.type);
                    const colorClass = getAccountColorClasses(acc.color, acc.type);
                    return (
                      <div key={acc.id || acc.name} className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className={cn("p-2 rounded-xl border shrink-0", colorClass)}>
                            <AccIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-sm text-slate-800">{acc.name}</div>
                            <div className="text-[11px] text-slate-500 font-medium">{acc.type} • {acc.currency || 'ريال'}</div>
                          </div>
                        </div>
                        <div className="text-left dir-ltr shrink-0">
                          <div className="font-black text-base text-slate-900">{formatCurrency(displayBalance, 'SAR')}</div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 text-xs text-slate-700 font-bold flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                        <Coins className="w-4 h-4" />
                      </div>
                      <span>الحساب البنكي الرئيسي</span>
                    </div>
                    <span className="font-black">{formatCurrency(remainingToLive + debtFundBalance + currentEmergencyBalance + savingsBalance, 'SAR')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* التوزيع الداخلي (الأظرف) للرصيد الفعلي */}
            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">توزيع داخلي للرصيد الفعلي (أظرف التوزيع)</h3>
                <span className="text-[10px] text-slate-400 font-bold">ليست أموالاً منفصلة؛ بل تقسيمات داخلية للرصيد نفسه</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-rose-50/50 border border-rose-100 flex flex-col justify-between">
                  <div className="text-xs font-bold text-rose-800 flex items-center gap-1.5 mb-1">
                    <span>💳</span> ديون قائمة ({debtPct}%)
                  </div>
                  <div className="text-base font-black text-rose-700 dir-ltr">{formatCurrency(debtFundBalance, 'SAR')}</div>
                  <span className="text-[10px] text-rose-600/80 font-medium mt-1">المخصص المحجوز للسداد</span>
                </div>

                <div className="p-3.5 rounded-xl bg-purple-50/50 border border-purple-100 flex flex-col justify-between">
                  <div className="text-xs font-bold text-purple-800 flex items-center gap-1.5 mb-1">
                    <span>🚨</span> صندوق الطوارئ ({emergencyPct}%)
                  </div>
                  <div className="text-base font-black text-purple-700 dir-ltr">{formatCurrency(currentEmergencyBalance, 'SAR')}</div>
                  <span className="text-[10px] text-purple-600/80 font-medium mt-1">الرصيد التراكمي المحمي</span>
                </div>

                <div className="p-3.5 rounded-xl bg-blue-50/50 border border-blue-100 flex flex-col justify-between">
                  <div className="text-xs font-bold text-blue-800 flex items-center gap-1.5 mb-1">
                    <span>💰</span> ادخار واستثمار ({savingsPct}%)
                  </div>
                  <div className="text-base font-black text-blue-700 dir-ltr">{formatCurrency(savingsBalance, 'SAR')}</div>
                  <span className="text-[10px] text-blue-600/80 font-medium mt-1">المخصص التراكمي للنمو</span>
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200 flex flex-col justify-between">
                  <div className="text-xs font-bold text-emerald-800 flex items-center justify-between mb-1">
                    <span className="flex items-center gap-1"><span>🏠</span> ظرف المعيشة</span>
                    <span className="text-[10px] text-emerald-600 font-bold">المتبقي</span>
                  </div>
                  <div className="text-base font-black text-emerald-700 dir-ltr">{formatCurrency(remainingToLive, 'SAR')}</div>
                  <span className="text-[10px] text-emerald-600/80 font-medium mt-1">
                    من أصل المخصص {formatCurrency(operationalBudget)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 💵 Extra Income / Surplus Module (مسار الدخل الإضافي الفائض) */}
          <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-5 shadow-sm relative overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3 pb-3 border-b border-emerald-200/50">
              <div className="flex items-center gap-2">
                <span className="text-xl">💵</span>
                <div>
                  <h2 className="text-base font-black text-emerald-950">مسار الدخل الإضافي (الفائض الإضافي)</h2>
                  <span className="text-[11px] text-emerald-700 font-semibold block">مسار بسيط حر خارج نسب توزيع الراتب تلقائياً</span>
                </div>
              </div>
              <button
                onClick={() => onQuickAdd?.('income')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all shadow-sm active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>تسجيل دخل إضافي</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/60 p-4 rounded-xl border border-emerald-200/50 mb-3">
              <div>
                <span className="text-xs text-emerald-800 font-bold block">إجمالي الفائض الإضافي هذا الشهر:</span>
                <span className="text-2xl font-black text-emerald-900">{formatCurrency(currentMonthExtraIncome, 'SAR')}</span>
              </div>
              <p className="text-[11px] text-emerald-800 font-medium max-w-sm leading-relaxed">
                أي مبلغ يأتي خارج الراتب (عمل إضافي، عمولة، مكافأة، بيع شيء، مشروع) يُحسب كـ <b>فائض إضافي حر</b> في حسابك دون اقتطاع بنسب 26% / 16% / 12%.
              </p>
            </div>

            {currentMonthExtraIncomeList.length > 0 ? (
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-emerald-800 block">عمليات الدخل الإضافي والمكافآت هذا الشهر:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {currentMonthExtraIncomeList.slice(0, 4).map((inc, idx) => (
                    <div key={inc.id || idx} className="p-3 rounded-xl bg-white border border-emerald-100 flex items-center justify-between text-xs font-bold gap-2 shadow-sm">
                      <div className="truncate min-w-0">
                        <span className="text-emerald-950 font-black block truncate">{inc.description || inc.category}</span>
                        <span className="text-[10px] text-emerald-600 font-medium">{inc.date} • {inc.paymentMethod}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-emerald-700 font-black text-sm dir-ltr">+{formatCurrency(inc.amount)}</span>
                        <button
                          onClick={() => {
                            setRoutingExtraIncomeItem(inc);
                            setRoutingDestination('debt');
                          }}
                          className="px-2 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-black text-[10px] transition-all shadow-sm active:scale-95 border border-emerald-200"
                          title="اختر وجهة هذا المبلغ"
                        >
                          🎯 اختر وجهة المبلغ
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-2 text-xs text-emerald-700 font-medium bg-emerald-100/50 rounded-xl p-3 border border-emerald-200/50">
                💡 لم يتم تسجيل دخل إضافي (عمل إضافي، عمولة، مكافأة...) هذا الشهر. اضغط زر "تسجيل دخل إضافي" لإضافته واختيار وجهته مباشرة.
              </div>
            )}

            {/* Practical Scenario Banners */}
            <div className="mt-3 p-3 rounded-xl bg-emerald-100/50 border border-emerald-200/50 text-xs text-emerald-800 font-medium flex items-start gap-2">
              <span className="text-emerald-600 shrink-0">💡</span>
              <p>
                <b>الدخل الإضافي:</b> دخل خارج الراتب الأساسي، ولا يغير نسب القاعدة الذهبية الثابتة. يمكنك توجيهه للوجهة التي تناسبك.
              </p>
            </div>
          </div>

          {/* Income vs Expenses Summary Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                <h2 className="text-base font-bold text-slate-900">ملخص هذا الشهر ({currentMonthStr})</h2>
              </div>
              <button
                onClick={() => onNavigateTab?.('expenses')}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 transition-colors"
              >
                عرض السجل الكامل ←
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-emerald-700">إجمالي الدخل الوارد</div>
                  <div className="text-xl font-black text-emerald-800 mt-1">{formatCurrency(currentMonthIncomes, 'SAR')}</div>
                  <div className="text-[10px] text-emerald-600/80 mt-1.5 font-semibold space-y-0.5">
                    <div className="flex items-center gap-1">
                      <span>• الراتب الأساسي (يوزع بالنسب):</span>
                      <span className="font-bold">{formatCurrency(salary)}</span>
                    </div>
                    {currentMonthExtraIncome > 0 && (
                      <div className="flex items-center gap-1">
                        <span>• دخل إضافي حر (توجيه يدوي):</span>
                        <span className="font-bold">{formatCurrency(currentMonthExtraIncome)}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full bg-emerald-200/60 text-emerald-800 flex items-center justify-center shrink-0">
                  <ArrowDownLeft className="w-5 h-5" />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-rose-50/60 border border-rose-100 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-rose-700">إجمالي المصروفات</div>
                  <div className="text-xl font-black text-rose-800 mt-1">{formatCurrency(currentMonthExpenses, 'SAR')}</div>
                </div>
                <div className="w-10 h-10 rounded-full bg-rose-200/60 text-rose-800 flex items-center justify-center">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Column 3: Quick Guide & Rules */}
        <div className="space-y-6">

          {/* Golden Simple Rule Box */}
          <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <Sparkles className="w-4 h-4" />
              <span>القاعدة الذهبية في التطبيق</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              كل شيء هنا بسيط ومباشر:
            </p>
            <div className="text-xs space-y-2 bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 text-slate-200">
              <div className="flex justify-between">
                <span>1. استلام الراتب وتوجيهه</span>
                <span className="font-bold text-emerald-400">بدون تدخل يدوي</span>
              </div>
              <div className="flex justify-between mt-2">
                <span>2. الديون والطوارئ والادخار</span>
                <span className="font-bold text-amber-400">الراتب يُوزع تلقائيًا 100%</span>
              </div>
              <div className="flex justify-between mt-2">
                <span>3. الباقي للمصاريف الأساسية</span>
                <span className="font-bold text-white">= الصافي المتاح للعيش</span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Extra Income Destination Routing Modal */}
      <AnimatePresence>
        {routingExtraIncomeItem && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-100 text-right space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">💵</span>
                  <div>
                    <h3 className="text-base font-black text-slate-900">توجيه الدخل الإضافي / المكافأة</h3>
                    <span className="text-xs text-slate-500 font-bold block">{routingExtraIncomeItem.description}</span>
                  </div>
                </div>
                <button 
                  onClick={() => setRoutingExtraIncomeItem(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-black hover:bg-slate-200"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-between text-emerald-950 font-black">
                <span className="text-xs">المبلغ المتاح للتوجيه:</span>
                <span className="text-2xl text-emerald-700 font-mono">+{formatCurrency(routingExtraIncomeItem.amount)}</span>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-800">اختر أين تريد توجيه هذا المبلغ:</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => setRoutingDestination('debt')}
                    className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between ${
                      routingDestination === 'debt'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm font-black'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-xs font-black">💳 سداد الدين</span>
                    <span className={`text-[10px] mt-1 ${routingDestination === 'debt' ? 'text-rose-100' : 'text-slate-500'}`}>تخفيض المديونية</span>
                  </button>

                  <button
                    onClick={() => setRoutingDestination('emergency')}
                    className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between ${
                      routingDestination === 'emergency'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-sm font-black'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-xs font-black">🛡️ صندوق الطوارئ</span>
                    <span className={`text-[10px] mt-1 ${routingDestination === 'emergency' ? 'text-amber-100' : 'text-slate-500'}`}>تعزيز الأمان المالي</span>
                  </button>

                  <button
                    onClick={() => setRoutingDestination('savings')}
                    className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between ${
                      routingDestination === 'savings'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-black'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-xs font-black">📈 الادخار والنمو</span>
                    <span className={`text-[10px] mt-1 ${routingDestination === 'savings' ? 'text-blue-100' : 'text-slate-500'}`}>زيادة الاستثمار</span>
                  </button>
                </div>
              </div>

              {routingDestination === 'debt' && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs space-y-3">
                  {debts.length > 0 ? (
                    <>
                      <label className="block text-xs font-black text-rose-950">حدد الدين المراد خصم المكافأة منه:</label>
                      <select
                        value={selectedDebtIdForRouting || (debts[0]?.id || '')}
                        onChange={(e) => setSelectedDebtIdForRouting(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-rose-200 font-bold text-slate-900 bg-white"
                      >
                        {debts.map(d => (
                          <option key={d.id} value={d.id}>
                            {d.name} (المتبقي حالياً: {formatCurrency(d.totalAmount - d.paidAmount)})
                          </option>
                        ))}
                      </select>
                      {(() => {
                        const targetDebt = debts.find(d => d.id === (selectedDebtIdForRouting || debts[0]?.id)) || debts[0];
                        const currentUnpaid = targetDebt ? (targetDebt.totalAmount - targetDebt.paidAmount) : 0;
                        const amt = routingExtraIncomeItem.amount;
                        const projectedUnpaid = Math.max(0, currentUnpaid - amt);
                        return (
                          <div className="p-3 rounded-xl bg-white border border-rose-200 text-slate-900 font-bold text-xs space-y-1">
                            <div className="flex justify-between items-center text-slate-600">
                              <span>المديونية الحالية:</span>
                              <span className="font-mono font-black text-rose-600">{formatCurrency(currentUnpaid)}</span>
                            </div>
                            <div className="flex justify-between items-center text-emerald-800 font-black text-sm pt-1 border-t border-slate-100">
                              <span>المديونية بعد الخصم:</span>
                              <span className="font-mono">{formatCurrency(projectedUnpaid)} 🎉</span>
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  ) : (
                    <div className="text-center py-2 text-slate-600 font-bold">
                      لا توجد ديون قائمة مسجلة حالياً.
                    </div>
                  )}
                </div>
              )}

              {routingSuccessMsg ? (
                <div className="p-3 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-xs text-center">
                  {routingSuccessMsg}
                </div>
              ) : (
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={handleExecuteExtraRouting}
                    disabled={isRoutingSubmitting}
                    className="flex-1 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition-all shadow-md active:scale-95 disabled:opacity-50"
                  >
                    {isRoutingSubmitting ? 'جاري التوجيه...' : `تأكيد توجيه الـ ${formatCurrency(routingExtraIncomeItem.amount)} الآن`}
                  </button>
                  <button
                    onClick={() => setRoutingExtraIncomeItem(null)}
                    className="py-3 px-4 rounded-2xl bg-slate-100 text-slate-700 font-extrabold text-xs hover:bg-slate-200 transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Clear Cache Confirmation Modal */}
      <AnimatePresence>
        {showClearCacheModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 text-slate-800 shadow-2xl relative space-y-5 text-right"
            >
              <button 
                onClick={() => setShowClearCacheModal(false)}
                className="absolute top-5 left-5 text-slate-400 hover:text-slate-600 p-1 rounded-full bg-slate-100"
              >
                <Plus className="w-5 h-5 rotate-45" />
              </button>

              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100">
                  <RefreshCw className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-900">تأكيد مسح الذاكرة المؤقتة</h4>
                  <p className="text-xs text-slate-500 font-bold">إعادة تعيين الحالة المحلية للتطبيق</p>
                </div>
              </div>

              <div className="bg-amber-50/50 rounded-2xl p-4 border border-amber-100 space-y-3 text-xs font-bold leading-relaxed text-slate-700">
                <p>⚠️ هل أنت متأكد؟ سيتم إجراء الآتي:</p>
                <ul className="list-disc list-inside space-y-1.5 text-slate-600 pr-2">
                  <li>مسح جميع البيانات المخزنة مؤقتاً في المتصفح.</li>
                  <li>إعادة تحميل الصفحة بالكامل.</li>
                  <li>ملاحظة: البيانات المخزنة في السحاب (Firebase) لن تتأثر.</li>
                </ul>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleClearCache}
                  className="flex-1 py-3.5 px-4 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-2xl text-sm shadow-lg shadow-amber-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>تأكيد ومسح الذاكرة</span>
                </button>

                <button
                  onClick={() => setShowClearCacheModal(false)}
                  className="py-3.5 px-6 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl text-sm transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
