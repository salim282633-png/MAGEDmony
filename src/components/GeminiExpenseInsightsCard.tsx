/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Brain, 
  Sparkles, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  RefreshCw, 
  Calendar, 
  PieChart, 
  Lightbulb, 
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { UserSettings, Expense, AccountItem, DebtItem } from '../types';

interface GeminiExpenseInsightsCardProps {
  settings: UserSettings | null;
  expenses: Expense[];
  salaryAmount: number;
  accounts?: AccountItem[];
  debts?: DebtItem[];
}

interface AnalysisData {
  status: string;
  statusText: string;
  spendingSummary: string;
  topObservation: string;
  suggestions: string[];
  isFallback?: boolean;
}

export function GeminiExpenseInsightsCard({
  settings,
  expenses,
  salaryAmount,
  accounts = [],
  debts = []
}: GeminiExpenseInsightsCardProps) {
  const [isOpenModal, setIsOpenModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisData | null>(null);

  // Dates & Month Math
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthNum = now.getMonth() + 1;
  const currentMonthStr = `${currentYear}-${currentMonthNum.toString().padStart(2, '0')}`;
  const dayOfMonth = now.getDate();
  const totalDaysInMonth = new Date(currentYear, currentMonthNum, 0).getDate();
  const daysElapsed = dayOfMonth;
  const daysRemaining = Math.max(1, totalDaysInMonth - dayOfMonth + 1);

  // Golden Rule 46% Operational Allocation
  const operationalAllocation = Math.round(salaryAmount * 0.46);
  const debtAllocation = Math.round(salaryAmount * 0.26);
  const emergencyAllocation = Math.round(salaryAmount * 0.16);
  const savingsAllocation = Math.round(salaryAmount * 0.12);

  // Current Month Expenses (Excluding internal transfers or salary entries)
  const monthExpensesList = useMemo(() => {
    return expenses.filter(e => {
      const isExpense = (e.type === 'مصروف' || !e.type);
      const isCurrentMonth = e.date && e.date.startsWith(currentMonthStr);
      const isTransfer = e.category === 'صندوق مخصص' || e.category === 'الراتب' || e.description?.includes('توزيع') || e.description?.includes('تخصيص');
      const isDedicatedFund = 
        e.paymentMethod === 'صندوق سداد الديون' || 
        e.paymentMethod === 'صندوق الادخار والاستثمار' || 
        e.paymentMethod === 'صندوق الطوارئ' ||
        (e.category === 'الديون' && (e.paymentMethod?.includes('صندوق') || e.paymentMethod === 'صندوق سداد الديون'));
      return isExpense && isCurrentMonth && !isTransfer && !isDedicatedFund;
    });
  }, [expenses, currentMonthStr]);

  const totalSpent = useMemo(() => {
    return monthExpensesList.reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [monthExpensesList]);

  const remainingOperational = Math.max(0, operationalAllocation - totalSpent);
  const dailyAllowance = Math.round(remainingOperational / daysRemaining);

  // Helper to normalize category names for consistent aggregation
  const normalizeCategory = (cat?: string): string => {
    if (!cat) return 'أخرى';
    const trimmed = cat.trim();
    if (trimmed.includes('طعام') || trimmed.includes('أغذية') || trimmed.includes('مطاعم') || trimmed.includes('مشروبات') || trimmed.includes('معيشة')) {
      return 'الطعام';
    }
    if (trimmed.includes('سكن') || trimmed.includes('إيجار') || trimmed.includes('ايجار')) {
      return 'السكن';
    }
    if (trimmed.includes('مواصلات') || trimmed.includes('نقل') || trimmed.includes('تاكسي')) {
      return 'المواصلات';
    }
    if (trimmed.includes('بنزين') || trimmed.includes('وقود')) {
      return 'الوقود';
    }
    if (trimmed.includes('تسوق') || trimmed.includes('ملابس')) {
      return 'التسوق';
    }
    if (trimmed.includes('فاتورة') || trimmed.includes('فواتير') || trimmed.includes('كهرباء') || trimmed.includes('إنترنت') || trimmed.includes('ماء')) {
      return 'الفواتير';
    }
    return trimmed;
  };

  // Category Breakdown
  const categoryTotals = useMemo(() => {
    const cats: Record<string, number> = {};
    monthExpensesList.forEach(e => {
      const cat = normalizeCategory(e.category);
      cats[cat] = (cats[cat] || 0) + (e.amount || 0);
    });
    return cats;
  }, [monthExpensesList]);

  // Unusual Expenses Detection (> 25% of operational budget or > 250 SAR single item)
  const unusualExpenses = useMemo(() => {
    return monthExpensesList
      .filter(e => e.amount > 250 || e.amount > operationalAllocation * 0.25)
      .map(e => ({ description: e.description, amount: e.amount, category: e.category }));
  }, [monthExpensesList, operationalAllocation]);

  // Extra Income Total
  const extraIncomeTotal = useMemo(() => {
    return expenses
      .filter(e => e.type === 'دخل' && e.category !== 'الراتب' && e.date && e.date.startsWith(currentMonthStr))
      .reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [expenses, currentMonthStr]);

  // Debts & Balances Summary
  const debtsRemaining = useMemo(() => {
    const raw = debts.reduce((sum, d) => sum + Math.max(0, (d.totalAmount || 0) - (d.paidAmount || 0)), 0);
    const debtFund = accounts.find(a => a.name === 'صندوق سداد الديون' || a.name.includes('الديون'));
    const debtFundBalance = debtFund?.balance || 0;
    return Math.max(0, raw - debtFundBalance);
  }, [debts, accounts]);

  const emergencyBalance = useMemo(() => {
    const acc = accounts.find(a => a.name.includes('طوارئ'));
    return acc?.balance || 0;
  }, [accounts]);

  const savingsBalance = useMemo(() => {
    const acc = accounts.find(a => a.name.includes('ادخار'));
    return acc?.balance || 0;
  }, [accounts]);

  // Previous Month Spending Comparison
  const prevMonthStr = useMemo(() => {
    const prevMonthNum = currentMonthNum === 1 ? 12 : currentMonthNum - 1;
    const prevYear = currentMonthNum === 1 ? currentYear - 1 : currentYear;
    return `${prevYear}-${prevMonthNum.toString().padStart(2, '0')}`;
  }, [currentMonthNum, currentYear]);

  const prevMonthSpent = useMemo(() => {
    return expenses
      .filter(e => (e.type === 'مصروف' || !e.type) && e.date && e.date.startsWith(prevMonthStr) && e.category !== 'الراتب')
      .reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [expenses, prevMonthStr]);

  const historicalComparisonText = useMemo(() => {
    if (prevMonthSpent <= 0) {
      return "لا توجد بيانات تاريخية كافية للشهر السابق لإجراء مقارنة دقيقة.";
    }
    const diff = totalSpent - prevMonthSpent;
    if (Math.abs(diff) < 50) {
      return "إنفاقك هذا الشهر قريب جداً من إنفاق الشهر السابق في نفس الفترة.";
    }
    if (diff > 0) {
      return `ارتفع إنفاقك هذا الشهر بمقدار ${formatCurrency(diff)} مقارنة بالشهر السابق.`;
    }
    return `انخفض إنفاقك هذا الشهر بمقدار ${formatCurrency(Math.abs(diff))} مقارنة بالشهر السابق.`;
  }, [prevMonthSpent, totalSpent]);

  // Local Mathematical Fallback Generator
  const generateLocalFallback = (): AnalysisData => {
    const spendingRatio = totalSpent / (operationalAllocation || 1);
    const daysRatio = daysElapsed / totalDaysInMonth;

    let status = "🟢 جيد";
    let statusText = "وضعك المالي جيد وصرفك الحالية ضمن وتيرة متوازنة لمخصص المعيشة.";

    if (totalSpent >= operationalAllocation || spendingRatio > daysRatio + 0.15) {
      status = "🔴 خطر";
      statusText = "وتيرة الإنفاق الحالية قد تؤدي إلى نفاد مخصص المعيشة قبل موعد الراتب القادم.";
    } else if (spendingRatio > daysRatio) {
      status = "🟡 انتبه";
      statusText = "وتيرة إنفاقك أعلى قليلًا من المعدل المطلوب، وقد تحتاج إلى تخفيف المصروفات خلال الأيام القادمة.";
    }

    // Top Category
    let topCat = "";
    let maxAmt = 0;
    Object.entries(categoryTotals).forEach(([cat, amt]) => {
      const val = Number(amt) || 0;
      if (val > maxAmt) {
        maxAmt = val;
        topCat = cat;
      }
    });

    let topObs = topCat 
      ? `أكبر بند إنفاق لديك هذا الشهر هو "${topCat}" بقيمة ${formatCurrency(maxAmt)}.`
      : "لم تسجل مصروفات معيشية كبيرة حتى الآن هذا الشهر.";

    if (unusualExpenses.length > 0) {
      topObs += ` ⚠️ تم رصد مصروف كبير غير معتاد: ${unusualExpenses[0].description} (${formatCurrency(unusualExpenses[0].amount)}).`;
    }

    const suggestions = [
      `حافظ على متوسط إنفاق يومي قريب من ${formatCurrency(dailyAllowance)} حتى موعد الراتب القادم (${daysRemaining} يومًا متبقية).`,
      "ركز الإنفاق على الاحتياجات الأساسية لضمان استمرار رصيدك المعيشي حتى نهاية الشهر."
    ];

    return {
      status,
      statusText,
      spendingSummary: `صرفت ${formatCurrency(totalSpent)} من أصل ${formatCurrency(operationalAllocation)} (مخصص المعيشة 46%). المتبقي: ${formatCurrency(remainingOperational)} لـ ${daysRemaining} يومًا متبقية.`,
      topObservation: topObs,
      suggestions,
      isFallback: true
    };
  };

  // Run AI Analysis
  const runAnalysis = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/ai/analyze-expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salary: salaryAmount,
          debtAllocation,
          emergencyAllocation,
          savingsAllocation,
          operationalAllocation,
          totalSpent,
          remainingOperational,
          daysElapsed,
          daysRemaining,
          dailyAllowance,
          categoryTotals,
          extraIncomeTotal,
          unusualExpenses,
          debtsSummary: { total: debts.reduce((s, d) => s + d.totalAmount, 0), remaining: debtsRemaining },
          emergencyBalance,
          savingsBalance,
          historicalComparison: historicalComparisonText
        })
      });

      if (!response.ok) {
        throw new Error('API server unavailable or missing key');
      }

      const data = await response.json();
      if (data.status && data.spendingSummary) {
        setAnalysisResult({
          status: data.status,
          statusText: data.statusText || '',
          spendingSummary: data.spendingSummary || '',
          topObservation: data.topObservation || '',
          suggestions: data.suggestions || [],
          isFallback: false
        });
      } else {
        setAnalysisResult(generateLocalFallback());
      }
    } catch (error) {
      // Clean fallback without technical error messages
      console.warn("Using local analysis fallback:", error);
      setAnalysisResult(generateLocalFallback());
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAnalysis = () => {
    setIsOpenModal(true);
    if (!analysisResult) {
      runAnalysis();
    }
  };

  // Fast Card Preview status
  const cardStatus = useMemo(() => {
    if (analysisResult) return analysisResult.status;
    const spendingRatio = totalSpent / (operationalAllocation || 1);
    const daysRatio = daysElapsed / totalDaysInMonth;
    if (totalSpent >= operationalAllocation || spendingRatio > daysRatio + 0.15) return "🔴 خطر";
    if (spendingRatio > daysRatio) return "🟡 انتبه";
    return "🟢 جيد";
  }, [analysisResult, totalSpent, operationalAllocation, daysElapsed, totalDaysInMonth]);

  const cardStatusLabel = useMemo(() => {
    if (cardStatus.includes("جيد")) return "وضعك المالي جيد";
    if (cardStatus.includes("انتبه")) return "انتبه لوتيرة إنفاقك";
    return "تحذير: تجاوز/اقتراب النفاد";
  }, [cardStatus]);

  return (
    <>
      {/* Main Dashboard Card for "🧠 تحليل مصروفاتي" */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-6 rounded-3xl border border-slate-200 text-slate-800 shadow-sm relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 -mt-8 -ml-8 w-40 h-40 bg-purple-50 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 -mb-8 -mr-8 w-40 h-40 bg-blue-50 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          
          {/* Card Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-purple-100 border border-purple-200 text-purple-700 flex items-center justify-center shrink-0 shadow-sm">
                <Brain className="w-5 h-5 text-purple-700" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <span>🧠 ذكاء الميزانية (Gemini AI)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-600 text-white font-black">
                    نشط
                  </span>
                </h3>
                <p className="text-xs text-slate-600 font-bold">
                  تحليل ذكي لأنماط الإنفاق يساعدك على الالتزام بالقواعد المالية وتجنب العجز
                </p>
              </div>
            </div>

            <div className="hidden sm:block text-xs font-black px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 shadow-sm">
              {cardStatus} {cardStatusLabel}
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            
            {/* Status indicator */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-3">
              <span className="text-2xl shrink-0">{cardStatus.substring(0, 2)}</span>
              <div>
                <span className="text-[11px] text-slate-500 font-black block">تقييم الوتيرة</span>
                <span className="text-sm font-black text-slate-900 block">{cardStatusLabel}</span>
              </div>
            </div>

            {/* Spent & Remaining */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-0.5">
              <div className="text-xs text-slate-600 font-bold flex justify-between">
                <span>المصروف من المعيشة:</span>
                <span className="text-rose-600 font-black">{formatCurrency(totalSpent)}</span>
              </div>
              <div className="text-xs text-slate-600 font-bold flex justify-between pt-1 border-t border-slate-200">
                <span>المتبقي من 46%:</span>
                <span className="text-teal-700 font-black">{formatCurrency(remainingOperational)}</span>
              </div>
            </div>

            {/* Days Remaining */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-0.5">
              <span className="text-[11px] text-slate-500 font-black block">الأيام المتبقية للراتب</span>
              <div className="text-sm font-black text-amber-700 flex items-center justify-between">
                <span>{daysRemaining} يومًا متبقية</span>
                <span className="text-xs text-slate-600 font-bold">({formatCurrency(dailyAllowance)}/يوم)</span>
              </div>
            </div>

          </div>

          {/* Action Trigger Button */}
          <div className="pt-2 flex items-center justify-between">
            <div className="text-[11px] text-slate-400 font-medium">
              💡 يحلل أنماط إنفاقك من الـ 46% المعيشية ويقدم توجيهات سلوكية
            </div>

            <button
              onClick={handleOpenAnalysis}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs shadow-sm transition-all active:scale-95 shrink-0"
            >
              <Brain className="w-4 h-4" />
              <span>[ 🧠 تحليل مصروفاتي ]</span>
            </button>
          </div>

        </div>
      </motion.div>

      {/* Interactive Modal for Full Analysis */}
      <AnimatePresence>
        {isOpenModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm dir-rtl text-right">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white text-slate-900 rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl border border-slate-200 relative max-h-[90vh] overflow-y-auto space-y-6"
            >
              
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                    <Brain className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                      <span>🧠 مجهر المصروفات الذكي</span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-600 text-white font-black">
                        Gemini AI Insights
                      </span>
                    </h3>
                    <p className="text-xs text-slate-800 font-black">
                      تشخيص دقيق لسلوكك الاستهلاكي مع نصائح مخصصة لتحسين جودة صرفك
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsOpenModal(false)}
                  className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Loader */}
              {isLoading ? (
                <div className="py-12 text-center space-y-4">
                  <RefreshCw className="w-10 h-10 text-purple-600 animate-spin mx-auto" />
                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-slate-900">جاري تحليل بيانات المصروفات بالذكاء الاصطناعي...</h4>
                    <p className="text-xs text-slate-700 font-bold">يقوم النظام بقراءة فئات إنفاقك وحساب وتيرة الاستهلاك</p>
                  </div>
                </div>
              ) : analysisResult ? (
                <div className="space-y-5">
                  
                  {/* Section 1: Status Badge & Headline */}
                  <div className={cn(
                    "p-4 rounded-2xl border flex items-start gap-3.5",
                    analysisResult.status.includes("جيد") && "bg-emerald-50 border-emerald-200 text-emerald-950",
                    analysisResult.status.includes("انتبه") && "bg-amber-50 border-amber-200 text-amber-950",
                    analysisResult.status.includes("خطر") && "bg-rose-50 border-rose-200 text-rose-950"
                  )}>
                    <span className="text-3xl shrink-0">{analysisResult.status.substring(0, 2)}</span>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm">{analysisResult.status}</span>
                        <span className="text-xs font-black text-slate-800">— {analysisResult.statusText}</span>
                      </div>
                      <p className="text-xs text-slate-800 font-bold leading-relaxed">
                        تقييم وتيرة استهلاك مخصص المعيشة (46%) بناءً على الأيام المتبقية حتى الراتب القادم.
                      </p>
                    </div>
                  </div>

                  {/* Section 2: What is happening with spending? */}
                  <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 space-y-2 shadow-sm">
                    <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <PieChart className="w-4 h-4 text-purple-700" />
                      <span>📊 ملخص حركة التدفق المالي</span>
                    </h4>
                    <p className="text-xs font-black text-slate-900 leading-relaxed">
                      {analysisResult.spendingSummary}
                    </p>

                    <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                      <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-500 font-black block">مخصص المعيشة (46%)</span>
                        <span className="font-black text-slate-900">{formatCurrency(operationalAllocation)}</span>
                      </div>
                      <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-500 font-black block">المتاح اليومي حتى الراتب القادم</span>
                        <span className="font-black text-emerald-700">{formatCurrency(dailyAllowance)} / يوم</span>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Top Observation */}
                  <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 space-y-1.5 shadow-sm">
                    <h4 className="text-xs font-black text-purple-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-700" />
                      <span>🔍 أبرز الملاحظات السلوكية:</span>
                    </h4>
                    <p className="text-xs font-black text-slate-900 leading-relaxed">
                      {analysisResult.topObservation}
                    </p>
                  </div>

                  {/* Section 4: Behavioral Suggestions */}
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2 shadow-sm">
                    <h4 className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                      <Lightbulb className="w-4 h-4 text-amber-700" />
                      <span>💡 خطوات عملية للتحسين:</span>
                    </h4>
                    <ul className="space-y-1.5 text-xs font-black text-slate-900">
                      {analysisResult.suggestions.map((sug, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-amber-700 shrink-0 mt-0.5">•</span>
                          <span>{sug}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Security & Rule Confirmation Banner */}
                  <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 text-[11px] text-slate-800 font-black flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>
                      <b>خصوصية وأمان:</b> يقوم الذكاء الاصطناعي بقراءة البيانات لتحليلها فقط، دون أي صلاحية لإجراء تحويلات أو تعديل مخصصاتك الثابتة.
                    </span>
                  </div>

                </div>
              ) : null}

              {/* Footer controls */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <button
                  onClick={runAnalysis}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 hover:text-purple-900 transition-colors"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
                  <span>تحديث التحليل</span>
                </button>

                <button
                  onClick={() => setIsOpenModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-black text-xs hover:bg-slate-800 transition-colors"
                >
                  إغلاق
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
