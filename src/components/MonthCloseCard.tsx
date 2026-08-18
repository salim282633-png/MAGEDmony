/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  CalendarCheck, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert, 
  PiggyBank, 
  CreditCard, 
  RefreshCcw, 
  Sparkles,
  Lock,
  Unlock,
  ChevronRight,
  Info
} from 'lucide-react';
import { 
  UserSettings, 
  Expense, 
  AccountItem, 
  DebtItem, 
  MonthlyClosure, 
  SurplusAllocationChoice 
} from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { doc, addDoc, collection, updateDoc, increment, deleteDoc, getDocs, query, where } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';

interface MonthCloseCardProps {
  settings: UserSettings | null;
  expenses: Expense[];
  accounts?: AccountItem[];
  debts?: DebtItem[];
  monthlyClosures?: MonthlyClosure[];
  onNavigateTab?: (tab: string) => void;
}

export function MonthCloseCard({
  settings,
  expenses,
  accounts = [],
  debts = [],
  monthlyClosures = [],
  onNavigateTab
}: MonthCloseCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReopenConfirm, setShowReopenConfirm] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const currentMonthStr = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  
  // Format Month in Arabic (e.g. "أغسطس 2026")
  const formatMonthName = (ym: string) => {
    try {
      const [y, m] = ym.split('-');
      const date = new Date(parseInt(y), parseInt(m) - 1, 1);
      return date.toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' });
    } catch {
      return ym;
    }
  };

  const currentMonthName = formatMonthName(currentMonthStr);

  // Check if current month is already closed
  const existingClosure = monthlyClosures.find(c => c.month === currentMonthStr && c.status === 'closed');
  const isClosed = Boolean(existingClosure);

  // Salary & Living Budget (46% base + extra income allocated to living + previous month rollover)
  const salary = settings?.salary || 2500;
  const currency = settings?.currency || 'ريال سعودي';
  const baseLivingBudget = Math.round(salary * 0.46); // 1,150 SAR

  // Check for previous month rollover to the same living fund
  const now = new Date();
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthStr = `${prevDate.getFullYear()}-${(prevDate.getMonth() + 1).toString().padStart(2, '0')}`;
  const prevMonthClosure = monthlyClosures.find(c => c.month === prevMonthStr && c.status === 'closed' && c.allocationChoice === 'rollover');
  const rolloverFromPrevMonth = prevMonthClosure ? (prevMonthClosure.allocationAmount || 0) : 0;

  // Extra income totals for current month
  const extraIncomeLiving = expenses
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

  const extraIncomeTotal = expenses
    .filter(e => e.type === 'دخل' && e.category !== 'الراتب' && e.date && e.date.startsWith(currentMonthStr))
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const operationalBudget = existingClosure 
    ? existingClosure.livingBudget 
    : (baseLivingBudget + extraIncomeLiving + rolloverFromPrevMonth);

  // Actual living expenses for the month (excluding debt fund / dedicated fund expenses / debt repayments)
  const livingExpenses = expenses.filter(e => {
    const isExpense = e.type === 'مصروف' || !e.type;
    const isCurrentMonth = e.date && e.date.startsWith(currentMonthStr);
    const isInternalTransfer = e.category === 'صندوق مخصص' || e.category === 'الراتب' || e.description?.includes('توزيع') || e.description?.includes('تخصيص');
    const isDebtOrDedicatedFund = 
      e.paymentMethod === 'صندوق سداد الديون' || 
      e.paymentMethod === 'صندوق الادخار والاستثمار' || 
      e.paymentMethod === 'صندوق الطوارئ' ||
      e.category === 'الديون' ||
      e.category === 'سداد دين' ||
      e.description?.includes('سداد دفعة من دين') ||
      e.description?.includes('سداد دين');
    return isExpense && isCurrentMonth && !isInternalTransfer && !isDebtOrDedicatedFund;
  });

  const totalActualExpenses = existingClosure 
    ? existingClosure.actualExpenses 
    : livingExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  const diff = operationalBudget - totalActualExpenses;
  const isDeficit = diff < 0;
  const surplusAmount = Math.max(0, diff);
  const deficitAmount = Math.max(0, -diff);

  // Step 2 Action: Confirm and Close Month
  const handleConfirmCloseMonth = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setIsSubmitting(true);
    setFeedbackMsg(null);

    try {
      const todayStr = new Date().toISOString().split('T')[0];

      // Save Monthly Closure Record
      await addDoc(collection(db, 'monthly_closures'), {
        userId: user.uid,
        month: currentMonthStr,
        closedAt: new Date().toISOString(),
        salary,
        extraIncomeTotal,
        totalIncome: salary + extraIncomeTotal,
        extraIncomeLiving,
        livingBudget: operationalBudget,
        baseLivingBudget,
        actualExpenses: totalActualExpenses,
        surplusOrDeficit: diff,
        isDeficit,
        allocationChoice: surplusAmount > 0 ? 'rollover' : null,
        allocationAmount: surplusAmount,
        allocationNotes: surplusAmount > 0 ? 'ترحيل الفائض تلقائياً لظرف المعيشة' : (isDeficit ? 'عجز معيشي موثق' : 'متوازن'),
        // Snapshot of balances
        fundBalances: accounts.reduce((acc, account) => {
          acc[account.name] = account.balance || 0;
          return acc;
        }, {} as Record<string, number>),
        status: 'closed'
      });

      setIsModalOpen(false);
      setFeedbackMsg({
        type: 'success',
        text: `تم إغلاق شهر ${currentMonthName} وتوثيق النتائج بنجاح.`
      });
    } catch (err: any) {
      console.error('Error closing month:', err);
      setFeedbackMsg({
        type: 'error',
        text: 'حدث خطأ أثناء إغلاق الشهر. يرجى المحاولة مجدداً.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Safe Reopen Month Handler
  const handleReopenMonth = async () => {
    if (!existingClosure || !existingClosure.id) return;
    const user = auth.currentUser;
    if (!user) return;
    setIsSubmitting(true);

    try {
      // Delete the monthly closure doc
      await deleteDoc(doc(db, 'monthly_closures', existingClosure.id));

      setShowReopenConfirm(false);
      setFeedbackMsg({
        type: 'success',
        text: `تمت إعادة فتح شهر ${currentMonthName} بنجاح وبأمان.`
      });
    } catch (err: any) {
      console.error('Error reopening month:', err);
      setFeedbackMsg({
        type: 'error',
        text: 'حدث خطأ أثناء إعادة فتح الشهر.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="month-close-card" className="bg-white rounded-3xl border border-slate-200/80 p-6 md:p-7 shadow-xs relative overflow-hidden">
      {/* Background Accent Pill */}
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-11 h-11 rounded-2xl flex items-center justify-center shadow-xs",
            isClosed ? "bg-emerald-600 text-white" : "bg-indigo-600 text-white"
          )}>
            {isClosed ? <Lock className="w-5 h-5" /> : <CalendarCheck className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-slate-900">إغلاق الشهر المالي</h3>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {currentMonthName}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {isClosed 
                ? 'تم حفظ نتائج الشهر وتوجيه الفائض بنجاح' 
                : 'إنهاء دورة الشهر وتوجيه فائض المعيشة بنقرة واحدة'}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div>
          {isClosed ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>الشهر مغلق ومؤرشف</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Unlock className="w-4 h-4 text-indigo-600" />
              <span>دورة الشهر نشطة</span>
            </span>
          )}
        </div>
      </div>

      {/* Feedback Toast */}
      {feedbackMsg && (
        <div className={cn(
          "mt-4 p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between gap-2 shadow-xs",
          feedbackMsg.type === 'success' ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"
        )}>
          <span>{feedbackMsg.text}</span>
          <button onClick={() => setFeedbackMsg(null)} className="text-slate-400 hover:text-slate-600 text-sm">×</button>
        </div>
      )}

      {/* The 3 Core Required Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 my-5">
        {/* 1. إجمالي مخصص المعيشة */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
          <span className="text-xs font-bold text-slate-500 block">إجمالي مخصص المعيشة</span>
          <div className="text-xl font-black text-slate-900">{formatCurrency(operationalBudget, currency)}</div>
          <span className="text-[11px] text-slate-400 font-medium block">
            {extraIncomeLiving > 0 
              ? `46% أساسي (${formatCurrency(baseLivingBudget)}) + إضافي (${formatCurrency(extraIncomeLiving)})`
              : '46% المعتمد في الراتب'}
          </span>
        </div>

        {/* 2. إجمالي المصروف الفعلي */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
          <span className="text-xs font-bold text-slate-500 block">إجمالي المصروف الفعلي</span>
          <div className="text-xl font-black text-slate-900">{formatCurrency(totalActualExpenses, currency)}</div>
          <span className="text-[11px] text-slate-400 font-medium block">المصروفات المعيشية المسجلة</span>
        </div>

        {/* 3. الفائض المتبقي أو مقدار التجاوز */}
        <div className={cn(
          "p-4 rounded-2xl border space-y-1",
          isDeficit 
            ? "bg-rose-50/70 border-rose-200" 
            : "bg-emerald-50/70 border-emerald-200"
        )}>
          <span className={cn("text-xs font-bold block", isDeficit ? "text-rose-700" : "text-emerald-700")}>
            {isDeficit ? 'مقدار التجاوز (عجز معيشي)' : 'الفائض المتبقي'}
          </span>
          <div className={cn("text-xl font-black", isDeficit ? "text-rose-700" : "text-emerald-800")}>
            {isDeficit ? `-${formatCurrency(deficitAmount, currency)}` : `+${formatCurrency(surplusAmount, currency)}`}
          </div>
          <span className={cn("text-[11px] font-medium block", isDeficit ? "text-rose-600" : "text-emerald-600")}>
            {isDeficit ? 'يوثق في السجل دون خصم من الصناديق' : 'متاح للتوجيه والترحيل بالكامل'}
          </span>
        </div>
      </div>

      {/* Action Area */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
        {!isClosed ? (
          <button
            id="close-month-btn"
            onClick={() => setIsModalOpen(true)}
            className="w-full sm:w-auto px-7 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-black text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            <CalendarCheck className="w-4 h-4" />
            <span>إغلاق الشهر</span>
          </button>
        ) : (
          <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="text-xs text-slate-600 font-medium">
              <span className="font-bold text-slate-800 block">سجل الإغلاق:</span>
              <span>
                {existingClosure?.allocationNotes || (existingClosure?.isDeficit ? 'تم توثيق عجز الشهر' : 'تم إغلاق الشهر')}
              </span>
            </div>
            <button
              id="reopen-month-btn"
              onClick={() => setShowReopenConfirm(true)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-white border border-slate-200 transition-all self-end sm:self-auto"
            >
              إعادة فتح الشهر
            </button>
          </div>
        )}
      </div>

      {/* 🚀 MODAL: Step 2 Flow for Surplus / Deficit Routing */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs dir-rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-7 shadow-2xl border border-slate-100 space-y-6"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <CalendarCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">إغلاق شهر {currentMonthName}</h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">خطوة 2 من 2: تأكيد وتوجيه الميزانية</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Modal Body: Surplus Case vs Deficit Case */}
              {!isDeficit && surplusAmount > 0 ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-900 space-y-2">
                    <div className="flex items-center gap-2 text-indigo-800 font-black text-sm">
                      <RefreshCcw className="w-5 h-5 text-indigo-600" />
                      <span>ترحيل الفائض تلقائياً</span>
                    </div>
                    <p className="text-xs text-indigo-800 font-medium leading-relaxed">
                      يوجد لديك فائض متبقي من مخصص المعيشة بقيمة <span className="font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">{formatCurrency(surplusAmount, currency)}</span>. سيتم ترحيله تلقائياً كرصيد افتتاحي إضافي لنفس ظرف المعيشة في الشهر القادم، ولن يتم تصفيره.
                    </p>
                  </div>
                </div>
              ) : isDeficit ? (
                /* Deficit Case */
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 space-y-2">
                    <div className="flex items-center gap-2 text-rose-800 font-black text-sm">
                      <AlertTriangle className="w-5 h-5 text-rose-600" />
                      <span>تم تجاوز ميزانية المعيشة بمقدار {formatCurrency(deficitAmount, currency)}</span>
                    </div>
                    <p className="text-xs text-rose-800 font-medium leading-relaxed">
                      لقد زادت المصروفات المعيشية الفعلية عن مخصص الراتب لهذا الشهر. عند الإغلاق، سيتم توثيق العجز في التقارير المالية دون خصمه تلقائياً من صندوق الطوارئ أو الادخار للحفاظ على استقرار خطتك.
                    </p>
                  </div>
                </div>
              ) : (
                /* Balanced Case */
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium">
                  المصروفات مطابقة تماماً لمخصص المعيشة (الفائض 0 ريال). سيتم أرشفة الشهر وبدء الدورة الجديدة.
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCloseMonth}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-black text-xs shadow-sm transition-all flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <span>جاري الحفظ...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>تأكيد إغلاق الشهر</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal for Reopening Month */}
      <AnimatePresence>
        {showReopenConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs dir-rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4"
            >
              <div className="flex items-center gap-3 text-amber-600">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h3 className="text-base font-black text-slate-900">إعادة فتح شهر {currentMonthName}؟</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                هل أنت متأكد من رغبتك في إعادة فتح الشهر؟ سيتم التراجع عن تحويل الفائض بأمان واستعادة حالة الدورة النشطة.
              </p>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  onClick={() => setShowReopenConfirm(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleReopenMonth}
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-xs"
                >
                  {isSubmitting ? 'جاري الإلغاء...' : 'نعم، أعد فتح الشهر'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
