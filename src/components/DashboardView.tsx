/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
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
  ChevronLeft,
  ChevronDown,
  Info,
  CheckCircle,
  ExternalLink,
  Flame,
  Activity
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { SalaryDistributor } from './SalaryDistributor';
import { GeminiExpenseInsightsCard } from './GeminiExpenseInsightsCard';
import { useToast } from '../lib/toast';

interface DashboardViewProps {
  settings: UserSettings | null;
  budget: BudgetItem[];
  debts: DebtItem[];
  savings: SavingsRecord[];
  expenses: Expense[];
  goals?: FinancialGoal[];
  subscriptions?: SubscriptionBill[];
  accounts?: AccountItem[];
  transactions?: Transaction[];
  monthlyClosures?: MonthlyClosure[];
  onQuickAdd?: (type: 'income' | 'expense') => void;
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
  const toast = useToast();
  const [showSalaryDetailsModal, setShowSalaryDetailsModal] = useState(false);
  const [showSecondaryAlerts, setShowSecondaryAlerts] = useState(false);

  // Extra income routing state
  const [routingExtraIncomeItem, setRoutingExtraIncomeItem] = useState<Expense | null>(null);
  const [routingDestination, setRoutingDestination] = useState<'debt' | 'emergency' | 'savings'>('debt');
  const [selectedDebtIdForRouting, setSelectedDebtIdForRouting] = useState<string>('');
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
          toast.success(
            'تم توجيه الدخل الإضافي لسداد الدين بنجاح',
            `انخفضت المديونية من ${formatCurrency(currentUnpaid)} إلى ${formatCurrency(remainingAfter)} ريال!`
          );
        }
      } else if (routingDestination === 'emergency') {
        const emgAcc = accounts.find(a => a.name.includes('طوارئ') || String(a.type).includes('طوارئ'));
        if (emgAcc && emgAcc.id) {
          await updateDoc(doc(db, 'accounts', emgAcc.id), { balance: (emgAcc.balance || 0) + amt });
        }
        toast.success('تم التوجيه بنجاح', `تم إيداع ${formatCurrency(amt)} في صندوق الطوارئ!`);
      } else if (routingDestination === 'savings') {
        const savAcc = accounts.find(a => a.name.includes('ادخار') || String(a.type).includes('ادخار'));
        if (savAcc && savAcc.id) {
          await updateDoc(doc(db, 'accounts', savAcc.id), { balance: (savAcc.balance || 0) + amt });
        }
        toast.success('تم التوجيه بنجاح', `تم إيداع ${formatCurrency(amt)} في صندوق الادخار والاستثمار!`);
      }

      setRoutingExtraIncomeItem(null);
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء توجيه الدخل الإضافي');
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

  const arabicMonthNames = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];
  const currentMonthArabic = `${arabicMonthNames[now.getMonth()]} ${now.getFullYear()}`;

  // 1. Total Actual Liquid Balance
  const totalLiquidBalance = useMemo(() => {
    if (accounts.length > 0) {
      return accounts.filter(a => !a.isArchived).reduce((acc, curr) => acc + (curr.balance || 0), 0);
    }
    const inc = expenses.filter(e => e.type === 'دخل').reduce((sum, e) => sum + (e.amount || 0), 0);
    const exp = expenses.filter(e => e.type === 'مصروف' || !e.type).reduce((sum, e) => sum + (e.amount || 0), 0);
    return Math.max(0, inc - exp);
  }, [accounts, expenses]);

  // Current Month Extra Incomes
  const currentMonthExtraIncomeList = useMemo(() => {
    return expenses.filter(e => e.type === 'دخل' && e.category !== 'الراتب' && e.date && e.date.startsWith(currentMonthStr));
  }, [expenses, currentMonthStr]);

  const currentMonthExtraIncome = useMemo(() => {
    return currentMonthExtraIncomeList.reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [currentMonthExtraIncomeList]);

  // Current Month Operating Expenses
  const currentMonthExpenses = useMemo(() => {
    return expenses
      .filter(e => {
        const isExpense = (e.type === 'مصروف' || !e.type);
        const isCurrentMonth = e.date && e.date.startsWith(currentMonthStr);
        const isInternalTransfer = e.category === 'صندوق مخصص' || e.category === 'الراتب' || e.description?.includes('توزيع') || e.description?.includes('تخصيص');
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

  // Check if salary is distributed for current month
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

  const salary = settings?.salary || 2500;

  // Debts status
  const debtFund = accounts.find(a => a.name === 'صندوق سداد الديون' || a.name.includes('الديون'));
  const debtFundBalance = debtFund?.balance || 0;

  const totalDebtsRemaining = useMemo(() => {
    const raw = debts.reduce((sum, d) => sum + Math.max(0, (d.totalAmount || 0) - (d.paidAmount || 0)), 0);
    return Math.max(0, raw - debtFundBalance);
  }, [debts, debtFundBalance]);

  const isDebtFree = debts.length > 0 && totalDebtsRemaining === 0;

  // Emergency Fund target & status
  const basicExpenses = Math.round(salary * 0.46);
  const emergencyTarget = basicExpenses * 3;
  const emergencyAccount = useMemo(() => {
    return accounts.find(a => a.name === 'صندوق الطوارئ' && !a.isArchived);
  }, [accounts]);
  const currentEmergencyBalance = emergencyAccount ? (emergencyAccount.balance || 0) : 0;
  const isEmergencyFundComplete = currentEmergencyBalance >= emergencyTarget;

  const savingsAccount = accounts.find(a => a.name.includes('ادخار') || a.name.includes('استثمار'));
  const savingsBalance = savingsAccount ? (savingsAccount.balance || 0) : 0;

  // Cascading Smart Redirect Percentages
  let debtPct = 0;
  let emergencyPct = 0;
  let savingsPct = 12;
  const livingPct = 46;

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

  // Rollover check
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthStr = `${prevDate.getFullYear()}-${(prevDate.getMonth() + 1).toString().padStart(2, '0')}`;
  const prevMonthClosure = monthlyClosures.find(c => c.month === prevMonthStr && c.status === 'closed' && c.allocationChoice === 'rollover');
  const rolloverFromPrevMonth = prevMonthClosure ? (prevMonthClosure.allocationAmount || 0) : 0;

  const baseLivingAmount = Math.round(salary * (livingPct / 100));
  const operationalBudget = baseLivingAmount + rolloverFromPrevMonth + currentMonthExtraIncome;

  // Living calculations
  const isLivingOverBudget = currentMonthExpenses > operationalBudget;
  const livingOverBudgetAmount = isLivingOverBudget ? currentMonthExpenses - operationalBudget : 0;
  const remainingToLive = Math.max(0, operationalBudget - currentMonthExpenses);

  // Daily Allowance (Primary Question)
  const dailyAvailableToLive = isLivingOverBudget ? 0 : Math.round(remainingToLive / daysRemaining);

  // Recent 5 transactions
  const recentTransactions = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      category: string;
      amount: number;
      date: string;
      type: 'income' | 'expense' | 'transfer';
      account: string;
    }> = [];

    expenses.forEach(e => {
      list.push({
        id: e.id || Math.random().toString(),
        title: e.description || e.category,
        category: e.category,
        amount: e.amount,
        date: e.date || '',
        type: e.type === 'دخل' ? 'income' : 'expense',
        account: e.paymentMethod || 'الحساب البنكي'
      });
    });

    (transactions || []).forEach(t => {
      list.push({
        id: t.id || Math.random().toString(),
        title: t.notes || 'تحويل داخلي',
        category: 'تحويل',
        amount: t.amount,
        date: t.date || '',
        type: 'transfer',
        account: `${t.fromAccount} ← ${t.toAccount}`
      });
    });

    return list.sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 5);
  }, [expenses, transactions]);

  // Determine the Single Primary Alert
  const primaryAlert = useMemo(() => {
    if (isLivingOverBudget) {
      return {
        id: 'over_budget',
        type: 'danger',
        title: `تجاوزت مخصص المعيشة بـ ${formatCurrency(livingOverBudgetAmount)} ريال`,
        description: 'لحماية خطتك المالية، لا يقوم النظام بالسحب التلقائي من صناديق الطوارئ أو الادخار.',
        actionText: 'عرض الحسابات والصناديق',
        onAction: () => onNavigateTab?.('accounts')
      };
    }

    if (!hasDistributedThisMonth) {
      return {
        id: 'salary_unallocated',
        type: 'info',
        title: `راتب شهر ${currentMonthArabic} جاهز للتوزيع`,
        description: 'اضغط على زر التوزيع لتخصيص النسب تلقائياً وفق خطتك المالية المعتمدة.',
        actionText: 'توزيع الراتب الآن',
        onAction: () => onNavigateTab?.('salary')
      };
    }

    if (currentMonthExtraIncomeList.length > 0 && debts.length > 0 && !isDebtFree) {
      return {
        id: 'extra_income_available',
        type: 'success',
        title: `لديك دخل إضافي متاح (${formatCurrency(currentMonthExtraIncome)} ريال)`,
        description: 'يمكنك توجيهه لتسريع سداد الديون أو تعزيز مدخراتك.',
        actionText: 'توجيه الفائض',
        onAction: () => setRoutingExtraIncomeItem(currentMonthExtraIncomeList[0])
      };
    }

    if (isDebtFree && debts.length > 0) {
      return {
        id: 'debt_freedom',
        type: 'success',
        title: '🎉 تهانينا! أنت حر مالياً من الديون بالكامل',
        description: `تم إعادة توجيه مخصص الديون تلقائياً بنسبة 100% إلى ${isEmergencyFundComplete ? 'صندوق الادخار' : 'صندوق الطوارئ'}.`,
        actionText: 'عرض رحلتي المالية',
        onAction: () => onNavigateTab?.('journey')
      };
    }

    return null;
  }, [
    isLivingOverBudget, 
    livingOverBudgetAmount, 
    hasDistributedThisMonth, 
    currentMonthArabic, 
    currentMonthExtraIncomeList, 
    debts.length, 
    isDebtFree, 
    currentMonthExtraIncome, 
    isEmergencyFundComplete,
    onNavigateTab
  ]);

  return (
    <div className="space-y-6 pb-12 dir-rtl text-right font-sans">
      
      {/* 1. HERO CARD: كم أستطيع أن أصرف اليوم؟ */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-white text-slate-900 p-6 sm:p-8 shadow-sm border border-slate-200"
      >
        <div className="absolute top-0 left-0 -mt-12 -ml-12 w-56 h-56 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 -mb-12 -mr-12 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>الميزانية اليومية الذكية</span>
              </span>
              <h1 className="text-sm sm:text-base font-bold text-slate-500">
                كم أستطيع أن أصرف اليوم؟
              </h1>
            </div>

            {/* Quick Action Button */}
            <button
              onClick={() => onQuickAdd?.('expense')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-sm shadow-md shadow-emerald-200 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>تسجيل مصروف سريع</span>
            </button>
          </div>

          {/* Massive Display Number */}
          <div className="flex flex-wrap items-baseline gap-3">
            <span className={cn(
              "text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight",
              isLivingOverBudget ? "text-rose-600" : "text-slate-900"
            )}>
              {formatCurrency(dailyAvailableToLive)}
            </span>
            <span className="text-sm sm:text-base font-bold text-slate-400">
              / لليوم الواحد
            </span>
            {isLivingOverBudget && (
              <span className="text-xs font-bold px-2.5 py-1 bg-rose-100 text-rose-700 rounded-lg">
                تم استنفاد مخصص المعيشة
              </span>
            )}
          </div>

          {/* 3 Key Indicators Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 border-t border-slate-100">
            {/* Indicator 1: المتبقي للمعيشة */}
            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 flex flex-col justify-between">
              <span className="text-xs font-bold text-emerald-700">المتبقي للمعيشة</span>
              <div className="text-xl sm:text-2xl font-black text-emerald-950 mt-1">
                {formatCurrency(remainingToLive)}
              </div>
              <span className="text-[11px] text-emerald-600/80 font-medium mt-0.5">
                من إجمالي مخصص {formatCurrency(operationalBudget)}
              </span>
            </div>

            {/* Indicator 2: المصروف هذا الشهر */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-500">المصروف هذا الشهر</span>
              <div className="text-xl sm:text-2xl font-black text-slate-800 mt-1">
                {formatCurrency(currentMonthExpenses)}
              </div>
              <span className="text-[11px] text-slate-400 font-medium mt-0.5">
                مصروفات معيشية مسجلة
              </span>
            </div>

            {/* Indicator 3: الأيام المتبقية */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-500">الأيام المتبقية</span>
              <div className="text-xl sm:text-2xl font-black text-slate-800 mt-1">
                {daysRemaining} يوم
              </div>
              <span className="text-[11px] text-slate-400 font-medium mt-0.5">
                حتى نهاية شهر {currentMonthArabic}
              </span>
            </div>
          </div>

          {/* Subdued Net Liquid Balance Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-4 border-t border-slate-100 text-xs font-medium text-slate-500">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-slate-400" />
              <span>إجمالي السيولة النقدية بجميع الحسابات والصناديق:</span>
              <span className="font-black text-slate-800 text-sm">{formatCurrency(totalLiquidBalance)}</span>
            </div>
            <button
              onClick={() => onNavigateTab?.('accounts')}
              className="text-emerald-700 hover:text-emerald-800 font-bold inline-flex items-center gap-1 text-xs"
            >
              <span>تفاصيل الحسابات</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* 2. SINGLE PRIMARY FINANCIAL ALERT (أهم تنبيه مالي) */}
      {primaryAlert && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "p-5 sm:p-6 rounded-3xl border shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4",
            primaryAlert.type === 'danger' && "bg-rose-50 border-rose-200 text-rose-950",
            primaryAlert.type === 'success' && "bg-emerald-50 border-emerald-200 text-emerald-950",
            primaryAlert.type === 'info' && "bg-blue-50 border-blue-200 text-blue-950"
          )}
        >
          <div className="flex items-start gap-3.5">
            <div className={cn(
              "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 font-bold",
              primaryAlert.type === 'danger' && "bg-rose-600 text-white",
              primaryAlert.type === 'success' && "bg-emerald-600 text-white",
              primaryAlert.type === 'info' && "bg-blue-600 text-white"
            )}>
              {primaryAlert.type === 'danger' && <AlertCircle className="w-5 h-5" />}
              {primaryAlert.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
              {primaryAlert.type === 'info' && <Info className="w-5 h-5" />}
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-black">{primaryAlert.title}</h4>
              <p className="text-xs opacity-80 mt-0.5 font-medium leading-relaxed">
                {primaryAlert.description}
              </p>
            </div>
          </div>

          <button
            onClick={primaryAlert.onAction}
            className={cn(
              "px-5 py-2.5 rounded-xl font-black text-xs transition-all shadow-xs shrink-0 self-end md:self-center cursor-pointer",
              primaryAlert.type === 'danger' && "bg-rose-600 hover:bg-rose-700 text-white",
              primaryAlert.type === 'success' && "bg-emerald-600 hover:bg-emerald-700 text-white",
              primaryAlert.type === 'info' && "bg-blue-600 hover:bg-blue-700 text-white"
            )}
          >
            {primaryAlert.actionText} ←
          </button>
        </motion.div>
      )}

      {/* 3. SIMPLIFIED SALARY DISTRIBUTION (4 CARDS / SUMMARY STRIP) */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <span>توزيع الراتب الشهري</span>
              <span className="text-xs font-bold text-slate-400">({formatCurrency(salary)})</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              النسب الفعلية المعتمدة وفق قاعدة الشلال المالي (100%)
            </p>
          </div>

          <button
            onClick={() => onNavigateTab?.('salary')}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 p-2 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer"
          >
            <span>عرض التفاصيل والتخصيص</span>
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: المعيشة */}
          <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800">المعيشة</span>
              <span className="text-[11px] font-black px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md">
                {livingPct}%
              </span>
            </div>
            <div className="text-lg sm:text-xl font-black text-emerald-950 mt-2">
              {formatCurrency(baseLivingAmount)}
            </div>
            <span className="text-[11px] text-emerald-700 font-medium mt-1">
              المصاريف والاحتياجات الأساسية
            </span>
          </div>

          {/* Card 2: الديون */}
          <div className={cn(
            "p-4 rounded-2xl border flex flex-col justify-between transition-all",
            isDebtFree 
              ? "bg-slate-50/60 border-slate-200 text-slate-400" 
              : "bg-amber-50/50 border-amber-100 text-amber-950"
          )}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">الديون</span>
              <span className={cn(
                "text-[11px] font-black px-2 py-0.5 rounded-md",
                isDebtFree ? "bg-slate-200 text-slate-600" : "bg-amber-100 text-amber-800"
              )}>
                {debtPct}% {isDebtFree && "✓"}
              </span>
            </div>
            <div className="text-lg sm:text-xl font-black mt-2">
              {formatCurrency(debtAmount)}
            </div>
            <span className="text-[11px] text-slate-500 font-medium mt-1">
              {isDebtFree ? "مكتمل (موجّه للطوارئ/الادخار)" : "سداد الالتزامات والأقساط"}
            </span>
          </div>

          {/* Card 3: الطوارئ */}
          <div className={cn(
            "p-4 rounded-2xl border flex flex-col justify-between transition-all",
            isEmergencyFundComplete 
              ? "bg-slate-50/60 border-slate-200 text-slate-400" 
              : "bg-blue-50/50 border-blue-100 text-blue-950"
          )}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">الطوارئ</span>
              <span className={cn(
                "text-[11px] font-black px-2 py-0.5 rounded-md",
                isEmergencyFundComplete ? "bg-slate-200 text-slate-600" : "bg-blue-100 text-blue-800"
              )}>
                {emergencyPct}% {isEmergencyFundComplete && "✓"}
              </span>
            </div>
            <div className="text-lg sm:text-xl font-black mt-2">
              {formatCurrency(emergencyAmount)}
            </div>
            <span className="text-[11px] text-slate-500 font-medium mt-1">
              {isEmergencyFundComplete ? "مكتمل (موجّه للادخار)" : "درع الأمان (3 أشهر)"}
            </span>
          </div>

          {/* Card 4: الادخار */}
          <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 text-purple-950 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-800">الادخار</span>
              <span className="text-[11px] font-black px-2 py-0.5 bg-purple-100 text-purple-800 rounded-md">
                {savingsPct}%
              </span>
            </div>
            <div className="text-lg sm:text-xl font-black text-purple-950 mt-2">
              {formatCurrency(savingsAmount)}
            </div>
            <span className="text-[11px] text-purple-700 font-medium mt-1">
              الاستثمار وتنمية الثروة
            </span>
          </div>
        </div>
      </div>

      {/* 4. RECENT TRANSACTIONS (آخر الحركات) */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900">آخر الحركات المالية</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">أحدث المصروفات والدخول والتحويلات</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onQuickAdd?.('income')}
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة دخل</span>
            </button>
            <button
              onClick={() => onNavigateTab?.('expenses')}
              className="text-xs font-bold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 p-1.5 cursor-pointer"
            >
              <span>عرض الكل</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs font-medium">
            لا توجد حركات مالية مسجلة بعد. اضغط على زر الإضافة لتسجيل أول حركة.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentTransactions.map(item => {
              const isIncome = item.type === 'income';
              const isTransfer = item.type === 'transfer';

              return (
                <div key={item.id} className="py-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                      isIncome && "bg-emerald-100 text-emerald-700",
                      !isIncome && !isTransfer && "bg-rose-100 text-rose-700",
                      isTransfer && "bg-blue-100 text-blue-700"
                    )}>
                      {isIncome && <ArrowDownLeft className="w-4 h-4" />}
                      {!isIncome && !isTransfer && <ArrowUpRight className="w-4 h-4" />}
                      {isTransfer && <ArrowLeftRight className="w-4 h-4" />}
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">
                        {item.category} • {item.account}
                      </p>
                    </div>
                  </div>

                  <div className="text-left shrink-0">
                    <span className={cn(
                      "text-xs sm:text-sm font-black dir-ltr block",
                      isIncome && "text-emerald-600",
                      !isIncome && !isTransfer && "text-rose-600",
                      isTransfer && "text-blue-600"
                    )}>
                      {isIncome ? `+${item.amount.toLocaleString()}` : isTransfer ? `${item.amount.toLocaleString()}` : `-${item.amount.toLocaleString()}`} ر.س
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium block">
                      {item.date}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. SECONDARY OVERVIEWS (الديون / الصناديق / الذكاء المالي) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gemini AI Expense Insights */}
        <GeminiExpenseInsightsCard
          settings={settings}
          expenses={expenses}
          salaryAmount={salary}
          accounts={accounts}
          debts={debts}
        />

        {/* Debts & Progress Snapshot */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-amber-600" />
                <span>موجز الديون القائمة</span>
              </h3>
              <button
                onClick={() => onNavigateTab?.('debt')}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 cursor-pointer"
              >
                <span>إدارة الديون</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              متابعة السداد والوصول للحرية المالية
            </p>
          </div>

          {debts.length === 0 ? (
            <div className="text-center py-6 bg-emerald-50/50 rounded-2xl border border-emerald-100">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
              <p className="text-xs font-black text-emerald-950">لا توجد ديون مسجلة! أنت حر مالياً</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                <span>المتبقي من إجمالي المديونية:</span>
                <span className="text-base font-black text-amber-700">{formatCurrency(totalDebtsRemaining)}</span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.round((debts.reduce((acc, d) => acc + (d.paidAmount || 0), 0) / Math.max(1, debts.reduce((acc, d) => acc + (d.totalAmount || 0), 0))) * 100))}%`
                  }}
                />
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>صندوق مخصص سداد الديون:</span>
            <span className="font-bold text-slate-800">{formatCurrency(debtFundBalance)}</span>
          </div>
        </div>
      </div>

      {/* Extra Income Routing Modal */}
      <AnimatePresence>
        {routingExtraIncomeItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100"
            >
              <h3 className="text-lg font-black text-slate-900 mb-2">توجيه الدخل الإضافي</h3>
              <p className="text-xs text-slate-500 font-medium mb-6">
                اختر الوجهة المناسبة لتوجيه مبلغ {formatCurrency(routingExtraIncomeItem.amount)}:
              </p>

              <div className="space-y-3 mb-6">
                <label className={cn(
                  "p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all",
                  routingDestination === 'debt' ? "border-emerald-500 bg-emerald-50/50" : "border-slate-200 hover:bg-slate-50"
                )}>
                  <div className="flex items-center gap-3">
                    <input 
                      type="radio" 
                      name="routing" 
                      checked={routingDestination === 'debt'} 
                      onChange={() => setRoutingDestination('debt')}
                      className="accent-emerald-600" 
                    />
                    <span className="text-xs font-bold text-slate-800">سداد الديون القائمة</span>
                  </div>
                  <CreditCard className="w-4 h-4 text-slate-400" />
                </label>

                <label className={cn(
                  "p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all",
                  routingDestination === 'emergency' ? "border-emerald-500 bg-emerald-50/50" : "border-slate-200 hover:bg-slate-50"
                )}>
                  <div className="flex items-center gap-3">
                    <input 
                      type="radio" 
                      name="routing" 
                      checked={routingDestination === 'emergency'} 
                      onChange={() => setRoutingDestination('emergency')}
                      className="accent-emerald-600" 
                    />
                    <span className="text-xs font-bold text-slate-800">صندوق الطوارئ</span>
                  </div>
                  <ShieldAlert className="w-4 h-4 text-slate-400" />
                </label>

                <label className={cn(
                  "p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all",
                  routingDestination === 'savings' ? "border-emerald-500 bg-emerald-50/50" : "border-slate-200 hover:bg-slate-50"
                )}>
                  <div className="flex items-center gap-3">
                    <input 
                      type="radio" 
                      name="routing" 
                      checked={routingDestination === 'savings'} 
                      onChange={() => setRoutingDestination('savings')}
                      className="accent-emerald-600" 
                    />
                    <span className="text-xs font-bold text-slate-800">صندوق الادخار والاستثمار</span>
                  </div>
                  <PiggyBank className="w-4 h-4 text-slate-400" />
                </label>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleExecuteExtraRouting}
                  disabled={isRoutingSubmitting}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  {isRoutingSubmitting ? 'جاري التنفيذ...' : 'تأكيد التوجيه'}
                </button>
                <button
                  onClick={() => setRoutingExtraIncomeItem(null)}
                  disabled={isRoutingSubmitting}
                  className="px-5 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
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
