/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  UserSettings, 
  AccountItem, 
  Expense, 
  Transaction, 
  DebtItem,
  SavingsRecord,
  SalaryDistributionRecord
} from '../types';
import { formatCurrency } from '../lib/utils';
import { 
  extractCurrentReality,
  simulateFinancialProjection,
  calculateEmergencyTarget
} from '../lib/financialProjection';
import { 
  Target, 
  Sparkles, 
  TrendingUp, 
  ShieldCheck, 
  CreditCard, 
  PiggyBank, 
  Award, 
  CheckCircle2, 
  Sliders, 
  RotateCcw, 
  Info, 
  Calendar,
  Lock,
  ArrowUpRight,
  Zap,
  HelpCircle,
  BarChart3,
  Flame,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';

interface TenYearJourneyViewProps {
  settings: UserSettings | null;
  accounts?: AccountItem[];
  expenses?: Expense[];
  transactions?: Transaction[];
  debts?: DebtItem[];
  savings?: SavingsRecord[];
  salaryDistributions?: SalaryDistributionRecord[];
}

type TabKey = 'overview' | 'timeline' | 'whatif' | 'achievements';

export function TenYearJourneyView({
  settings,
  accounts = [],
  expenses = [],
  transactions = [],
  debts = [],
  savings = [],
  salaryDistributions = []
}: TenYearJourneyViewProps) {

  // Active Tab navigation state
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // Base parameters
  const baseSalary = settings?.salary || 2500;
  const emergencyCapMonths = settings?.emergencyCapMonths || 3;

  // "What if" Simulation Options
  const [salaryGrowthPct, setSalaryGrowthPct] = useState<number>(0);
  const [extraMonthlyIncome, setExtraMonthlyIncome] = useState<number>(0);
  const [investmentReturnPct, setInvestmentReturnPct] = useState<number>(0);
  const [customSalary, setCustomSalary] = useState<number>(baseSalary);
  const [selectedYear, setSelectedYear] = useState<number>(10);

  // Sync customSalary when baseSalary changes if untouched
  React.useEffect(() => {
    if (customSalary === 2500 && baseSalary !== 2500) {
      setCustomSalary(baseSalary);
    }
  }, [baseSalary]);

  // 1. Current Reality Extraction (Year 0 state)
  const currentReality = useMemo(() => {
    return extractCurrentReality({
      accounts,
      debts,
      baseSalary: customSalary,
      emergencyCapMonths
    });
  }, [accounts, debts, customSalary, emergencyCapMonths]);

  // 2. Run 120-Month Waterfall Simulation Engine
  const simulationResult = useMemo(() => {
    return simulateFinancialProjection(currentReality, {
      annualSalaryGrowthPct: salaryGrowthPct,
      extraMonthlyIncome: extraMonthlyIncome,
      annualInvestmentReturnPct: investmentReturnPct,
      totalMonths: 120
    });
  }, [currentReality, salaryGrowthPct, extraMonthlyIncome, investmentReturnPct]);

  const { timelineMonths, timelineYears, milestones, initialReality, final10Year } = simulationResult;

  // Selected year details in timeline tab
  const selectedYearDetails = useMemo(() => {
    return timelineYears.find(y => y.year === selectedYear) || timelineYears[10];
  }, [timelineYears, selectedYear]);

  // Actual Progress Stats (From real salary_distributions and current reality)
  const actualStats = useMemo(() => {
    const distributionCount = salaryDistributions.length;
    
    // Time progress (0 to 120 months)
    const timeProgressPct = Math.min(100, Math.max(0, Math.round((distributionCount / 120) * 1000) / 10));

    // Financial progress: compare current net worth against target benchmark
    // Target net worth at 120 months in baseline
    const target10YearNetWorth = Math.max(1, final10Year.netWorth);
    const currentNetWorth = initialReality.initialNetWorth;
    const financialProgressPct = target10YearNetWorth > 0 
      ? Math.min(100, Math.max(0, Math.round((currentNetWorth / target10YearNetWorth) * 1000) / 10))
      : 0;

    return {
      distributionCount,
      timeProgressPct,
      financialProgressPct,
      currentNetWorth,
      target10YearNetWorth
    };
  }, [salaryDistributions, initialReality, final10Year]);

  // Real Event-based Achievements
  const achievements = useMemo(() => {
    const hasClosedDebt = debts.some(d => d.status === 'تم' || (d.paidAmount >= d.totalAmount && d.totalAmount > 0));
    const allDebtsPaid = initialReality.initialRemainingDebt <= 0;
    const isEmg50 = initialReality.emergencyBalance >= initialReality.emergencyTarget * 0.5 && initialReality.emergencyTarget > 0;
    const isEmg100 = initialReality.emergencyBalance >= initialReality.emergencyTarget && initialReality.emergencyTarget > 0;
    const isSavings10k = initialReality.savingsBalance >= 10000;

    return [
      {
        id: 'first_dist',
        title: '🎯 أول توزيع راتب',
        desc: 'تنفيذ أول عملية توزيع للراتب بالقاعدة الذهبية',
        unlocked: actualStats.distributionCount >= 1,
        metric: `${actualStats.distributionCount} / 1 توزيع`
      },
      {
        id: 'first_year',
        title: '📅 12 شهراً من الالتزام',
        desc: 'إكمال عام كامل من التوزيع والانضباط المالي',
        unlocked: actualStats.distributionCount >= 12,
        metric: `${actualStats.distributionCount} / 12 شهراً`
      },
      {
        id: 'first_debt_closed',
        title: '💳 إغلاق أول دين',
        desc: 'الانتهاء من سداد دين قائم بالكامل',
        unlocked: hasClosedDebt,
        metric: hasClosedDebt ? 'تم بنجاح' : 'قيد السداد'
      },
      {
        id: 'all_debts_cleared',
        title: '🚀 الحرية من الديون',
        desc: 'تصفير إجمالي الديون المتبقية بالكامل',
        unlocked: allDebtsPaid,
        metric: allDebtsPaid ? 'خالٍ من الديون' : `متبقي ${formatCurrency(initialReality.initialRemainingDebt)}`
      },
      {
        id: 'emergency_50',
        title: '🛡️ نصف درع الطوارئ (50%)',
        desc: 'تأمين 50% من مستهدف صندوق الطوارئ',
        unlocked: isEmg50,
        metric: `${formatCurrency(initialReality.emergencyBalance)} / ${formatCurrency(initialReality.emergencyTarget * 0.5)}`
      },
      {
        id: 'emergency_100',
        title: '🛡️ اكتمال صندوق الطوارئ (100%)',
        desc: 'تأمين شبكة الأمان المالي لـ 3 أشهر معيشة',
        unlocked: isEmg100,
        metric: `${formatCurrency(initialReality.emergencyBalance)} / ${formatCurrency(initialReality.emergencyTarget)}`
      },
      {
        id: 'savings_10k',
        title: '💰 أول 10,000 ريال ادخار',
        desc: 'بناء رصيد أساسي صلب في صندوق الادخار والاستثمار',
        unlocked: isSavings10k,
        metric: formatCurrency(initialReality.savingsBalance)
      },
      {
        id: 'five_years',
        title: '🌟 5 سنوات من الالتزام',
        desc: 'قطع 60 شهراً من مسار الـ 10 سنوات بنجاح',
        unlocked: actualStats.distributionCount >= 60,
        metric: `${actualStats.distributionCount} / 60 شهراً`
      },
      {
        id: 'decade_mastery',
        title: '🏆 10 سنوات من الالتزام التام',
        desc: 'إكمال 120 شهراً والوصول إلى أقصى استقلال مالي',
        unlocked: actualStats.distributionCount >= 120,
        metric: `${actualStats.distributionCount} / 120 شهراً`
      }
    ];
  }, [actualStats, initialReality, debts]);

  // Is What-If active
  const isWhatIfModified = salaryGrowthPct !== 0 || extraMonthlyIncome !== 0 || investmentReturnPct !== 0 || customSalary !== baseSalary;

  const handleResetWhatIf = () => {
    setCustomSalary(baseSalary);
    setSalaryGrowthPct(0);
    setExtraMonthlyIncome(0);
    setInvestmentReturnPct(0);
  };

  return (
    <div className="space-y-6 pb-16">
      
      {/* 1. HERO HEADER */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 w-72 h-72 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-black">
              <Target className="w-4 h-4 text-emerald-400" />
              <span>🎯 رحلتي المالية – 10 سنوات (محاكاة الشلال المالي)</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              إذا استمرت خطتي الحالية، أين سأكون بعد 10 سنوات؟
            </h1>
            <p className="text-slate-300 text-xs md:text-sm font-bold max-w-2xl leading-relaxed">
              محاكاة شهرية دقيقة قائمة على منطق التحويل الذكي: 46% معيشة، والتوجيه التلقائي لمخصصات الديون والطوارئ نحو الادخار والاستثمار (حتى 54%) فور اكتمالها.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4 text-center md:text-right shrink-0 min-w-[210px]">
            <span className="text-[11px] font-bold text-slate-300 block mb-1">الراتب الشهري المعتمد</span>
            <span className="text-2xl font-black text-emerald-400 block">{formatCurrency(customSalary)}</span>
            <span className="text-[10px] text-slate-400 font-bold block mt-1">توزيع شلالي ذكي (120 شهراً)</span>
          </div>
        </div>
      </div>

      {/* 2. TOP SUMMARY BANNER (بعد 10 سنوات إذا استمرت خطتك الحالية) */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6 border-b border-slate-100 pb-6 mb-6">
          
          <div>
            <div className="flex items-center gap-2 text-slate-500 font-bold text-xs mb-1">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>بعد 10 سنوات إذا استمرت خطتك الحالية (120 شهراً)</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900">صافي المركز المالي المتوقع</h2>
          </div>

          <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 md:p-5 text-right flex items-center justify-between md:justify-start gap-4">
            <div>
              <span className="text-xs font-bold text-emerald-800 block">صافي المركز المالي بعد 10 سنوات</span>
              <span className="text-2xl md:text-3xl font-black text-emerald-700">{formatCurrency(final10Year.netWorth)}</span>
            </div>
            <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-md shadow-emerald-200">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Dynamic Waterfall Milestones Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          
          {/* Debt Free Date */}
          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/70">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-500">💳 التخلص من الديون</span>
              <div className="p-1 bg-rose-100 text-rose-700 rounded-lg">
                <CreditCard className="w-3.5 h-3.5" />
              </div>
            </div>
            <span className="text-base md:text-lg font-black text-slate-900 block">
              {milestones.debtFreeDate || 'غير محدد'}
            </span>
            <p className="text-[11px] text-slate-500 font-bold mt-1">
              {milestones.isAlreadyDebtFree 
                ? 'خالٍ من الديون حالياً' 
                : milestones.debtFreeMonth ? `في الشهر ${milestones.debtFreeMonth} من المحاكاة` : 'تتطلب خطة سداد إضافية'}
            </p>
          </div>

          {/* Emergency Fund Date */}
          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/70">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-500">🛡️ اكتمال صندوق الطوارئ</span>
              <div className="p-1 bg-amber-100 text-amber-700 rounded-lg">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
            </div>
            <span className="text-base md:text-lg font-black text-slate-900 block">
              {milestones.emergencyCompleteDate || 'غير محدد'}
            </span>
            <p className="text-[11px] text-slate-500 font-bold mt-1">
              {milestones.isAlreadyEmergencyComplete 
                ? 'الصندوق مكتمل حالياً' 
                : milestones.emergencyCompleteMonth ? `الهدف: ${formatCurrency(initialReality.emergencyTarget)}` : 'جاري التراكم'}
            </p>
          </div>

          {/* 54% Acceleration Date */}
          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/70">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-500">🚀 تسارع الادخار إلى 54%</span>
              <div className="p-1 bg-emerald-100 text-emerald-700 rounded-lg">
                <PiggyBank className="w-3.5 h-3.5" />
              </div>
            </div>
            <span className="text-base md:text-lg font-black text-slate-900 block">
              {milestones.savings54Date || 'بعد استكمال الشلال'}
            </span>
            <p className="text-[11px] text-slate-500 font-bold mt-1">
              توجيه 54% كاملاً للادخار والاستثمار
            </p>
          </div>

        </div>

        {/* 4 Metrics: Liquid Assets, Cumulative Savings, Emergency, Remaining Debt */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/60">
            <span className="text-[11px] font-bold text-slate-500 block">الأصول السائلة المتراكمة</span>
            <span className="text-base md:text-lg font-black text-slate-900 block mt-1">{formatCurrency(final10Year.liquidAssets)}</span>
            <span className="text-[10px] text-slate-400 font-bold block mt-0.5">ادخار + طوارئ + حسابات</span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/60">
            <span className="text-[11px] font-bold text-emerald-700 block">💰 الادخار والاستثمار</span>
            <span className="text-base md:text-lg font-black text-emerald-800 block mt-1">{formatCurrency(final10Year.savingsBalance)}</span>
            <span className="text-[10px] text-slate-400 font-bold block mt-0.5">أصول نقدية واستثمارية</span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/60">
            <span className="text-[11px] font-bold text-amber-700 block">🛡️ رصيد الطوارئ</span>
            <span className="text-base md:text-lg font-black text-amber-800 block mt-1">{formatCurrency(final10Year.emergencyBalance)}</span>
            <span className="text-[10px] text-slate-400 font-bold block mt-0.5">شبكة الأمان المالي المستدامة</span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/60">
            <span className="text-[11px] font-bold text-rose-700 block">💳 الدين المتبقي المتوقع</span>
            <span className="text-base md:text-lg font-black text-rose-800 block mt-1">{formatCurrency(final10Year.remainingDebt)}</span>
            <span className="text-[10px] text-slate-400 font-bold block mt-0.5">مسدد بالكامل: {formatCurrency(final10Year.totalDebtPaid)}</span>
          </div>
        </div>

        {/* Clear Disclaimer */}
        <div className="mt-4 p-3 bg-slate-100/70 rounded-xl text-center text-[11px] text-slate-500 font-bold border border-slate-200/60 leading-relaxed">
          💡 <b>افتراضات النموذج:</b> هذه توقعات تقديرية مبنية على استمرار الدخل والخطة الحالية. لا تشمل التضخم أو عوائد الاستثمار أو تغيّر نمط الإنفاق إلا إذا تمت إضافتها إلى المحاكاة.
        </div>
      </div>

      {/* 3. SEGMENTED NAVIGATION TABS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all border shrink-0 ${
            activeTab === 'overview'
              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
              : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>📊 نظرة عامة والرسم البياني</span>
        </button>

        <button
          onClick={() => setActiveTab('timeline')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all border shrink-0 ${
            activeTab === 'timeline'
              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
              : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>📅 المسار والخط الزمني (10 سنوات)</span>
        </button>

        <button
          onClick={() => setActiveTab('whatif')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all border shrink-0 ${
            activeTab === 'whatif'
              ? 'bg-purple-700 text-white border-purple-700 shadow-sm'
              : isWhatIfModified 
                ? 'bg-purple-50 text-purple-700 border-purple-300'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>🔮 أداة ماذا لو؟ {isWhatIfModified && '⚡'}</span>
        </button>

        <button
          onClick={() => setActiveTab('achievements')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all border shrink-0 ${
            activeTab === 'achievements'
              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
              : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>🏅 الإنجازات والمحطات</span>
        </button>
      </div>

      {/* 4. TAB CONTENTS */}
      <AnimatePresence mode="wait">
        
        {/* ========================================================================= */}
        {/* TAB 1: OVERVIEW & CHART                                                   */}
        {/* ========================================================================= */}
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Progress Dual Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Time Progress */}
              <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200/80 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-sm font-black text-slate-900">الالتزام الزمني الفعلي</h3>
                  </div>
                  <span className="text-xs font-black px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                    {actualStats.distributionCount} / 120 شهراً
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    <div 
                      className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                      style={{ width: `${actualStats.timeProgressPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] font-bold text-slate-500">
                    <span>نسبة الالتزام الزمني: {actualStats.timeProgressPct}%</span>
                    <span>المتبقي: {120 - actualStats.distributionCount} شهراً</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 font-bold">
                  يعتمد الالتزام على عدد الرواتب الموزعة فعلياً في سجلات النظام.
                </p>
              </div>

              {/* Financial Net Worth Snapshot */}
              <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200/80 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-500" />
                    <h3 className="text-sm font-black text-slate-900">صافي المركز المالي الحالي</h3>
                  </div>
                  <span className="text-xs font-black px-2.5 py-1 rounded-full bg-slate-100 text-slate-800">
                    اليوم
                  </span>
                </div>

                <div className="flex items-baseline justify-between pt-1">
                  <div>
                    <span className="text-2xl font-black text-slate-900">{formatCurrency(initialReality.initialNetWorth)}</span>
                    <span className="text-[11px] text-slate-400 font-bold block mt-0.5">
                      الأصول: {formatCurrency(initialReality.initialLiquidAssets)} | الديون: {formatCurrency(initialReality.initialRemainingDebt)}
                    </span>
                  </div>
                  <div className="text-left">
                    <span className="text-[11px] font-bold text-slate-400 block">المستهدف بعد 10 سنوات</span>
                    <span className="text-sm font-black text-emerald-700 block">{formatCurrency(final10Year.netWorth)}</span>
                  </div>
                </div>

                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-700 rounded-full transition-all duration-500"
                    style={{ width: `${actualStats.financialProgressPct}%` }}
                  />
                </div>
              </div>

            </div>

            {/* Growth & Waterfall Chart */}
            <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900">📈 مسار التطور المالي (صافي المركز المالي ومكوناته)</h3>
                  <p className="text-xs text-slate-500 font-bold">انعكاس ديناميكي لتغير مسار الديون والطوارئ والادخار عبر 120 شهراً</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                    صافي المركز المالي
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 border border-teal-200">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                    الادخار المتراكم
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    صندوق الطوارئ
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    الدين المتبقي
                  </span>
                </div>
              </div>

              <div className="h-80 w-full dir-ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timelineYears} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorNetWorth" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#059669" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#059669" stopOpacity={0.0}/>
                      </linearGradient>
                      <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0d9488" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#0d9488" stopOpacity={0.0}/>
                      </linearGradient>
                      <linearGradient id="colorEmergency" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0}/>
                      </linearGradient>
                      <linearGradient id="colorDebt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="yearLabel" tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis 
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      tickFormatter={(val) => `${Math.round(val / 1000)}k`}
                    />
                    <Tooltip 
                      formatter={(value: any, name: any) => [`${formatCurrency(Number(value))}`, name]}
                      labelFormatter={(label) => `التوقع في: ${label}`}
                      contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', textAlign: 'right' }}
                    />
                    <Area type="monotone" dataKey="netWorth" name="صافي المركز المالي" stroke="#059669" strokeWidth={3} fillOpacity={1} fill="url(#colorNetWorth)" />
                    <Area type="monotone" dataKey="savingsBalance" name="الادخار والاستثمار" stroke="#0d9488" strokeWidth={2} fillOpacity={1} fill="url(#colorSavings)" />
                    <Area type="monotone" dataKey="emergencyBalance" name="صندوق الطوارئ" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorEmergency)" />
                    <Area type="monotone" dataKey="remainingDebt" name="الدين المتبقي" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorDebt)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Milestones bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-xs font-bold text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                  <span>سداد الدين: <b>{milestones.debtFreeDate || 'قيد المعالجة'}</b></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  <span>اكتمال الطوارئ: <b>{milestones.emergencyCompleteDate || 'قيد التراكم'}</b></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span>تسارع الادخار 54%: <b>{milestones.savings54Date || 'بعد الشلال'}</b></span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: TIMELINE & ANNUAL BREAKDOWN                                        */}
        {/* ========================================================================= */}
        {activeTab === 'timeline' && (
          <motion.div
            key="timeline"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm space-y-6"
          >
            <div>
              <h3 className="text-lg font-black text-slate-900 mb-1">📅 الخط الزمني التفاعلي (من اليوم إلى سنة 10)</h3>
              <p className="text-xs text-slate-500 font-bold">اضغط على أي سنة لعرض المركز المالي ونسب التوزيع الفعالة لتلك المرحلة</p>
            </div>

            {/* Timeline Year Buttons */}
            <div className="flex items-center gap-2 overflow-x-auto pb-3 scrollbar-thin">
              {timelineYears.map((d) => {
                const isSelected = selectedYear === d.year;
                return (
                  <button
                    key={d.year}
                    onClick={() => setSelectedYear(d.year)}
                    className={`px-4 py-3 rounded-2xl font-black text-xs md:text-sm shrink-0 transition-all border ${
                      isSelected 
                        ? 'bg-slate-900 text-white border-slate-900 shadow-md scale-105' 
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <span>{d.yearLabel}</span>
                  </button>
                );
              })}
            </div>

            {/* Selected Year Details Display */}
            <div className="bg-slate-50/90 rounded-3xl p-6 border border-slate-200/80 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
                <div>
                  <span className="text-xs font-bold text-slate-400 block">تفاصيل المركز المالي لـ</span>
                  <h4 className="text-xl font-black text-slate-900">{selectedYearDetails.yearLabel} {selectedYearDetails.year > 0 ? `(${selectedYearDetails.monthsCount} شهراً)` : '(الوضع الفعلي الحالي)'}</h4>
                </div>
                <div className="bg-emerald-100 text-emerald-900 px-4 py-2 rounded-xl text-xs font-black">
                  صافي المركز المالي: {formatCurrency(selectedYearDetails.netWorth)}
                </div>
              </div>

              {/* 4 Balance Cards for that year */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 block">الراتب السنوي المحاكى</span>
                  <span className="text-lg font-black text-slate-800 block">{formatCurrency(selectedYearDetails.annualSalary)}</span>
                  <span className="text-[10px] text-slate-400 font-bold block">معدل شهري: {formatCurrency(Math.round(selectedYearDetails.annualSalary / 12))}</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                  <span className="text-[11px] font-bold text-emerald-700 block">💰 رصيد الادخار والاستثمار</span>
                  <span className="text-lg font-black text-slate-800 block">{formatCurrency(selectedYearDetails.savingsBalance)}</span>
                  <span className="text-[10px] text-emerald-600 font-bold block">نسبة التوجيه: {selectedYearDetails.savingsPct}%</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                  <span className="text-[11px] font-bold text-amber-700 block">🛡️ رصيد صندوق الطوارئ</span>
                  <span className="text-lg font-black text-slate-800 block">{formatCurrency(selectedYearDetails.emergencyBalance)}</span>
                  <span className="text-[10px] text-amber-600 font-bold block">نسبة التوجيه: {selectedYearDetails.emergencyPct}%</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                  <span className="text-[11px] font-bold text-rose-700 block">💳 الدين المتبقي</span>
                  <span className="text-lg font-black text-slate-800 block">{formatCurrency(selectedYearDetails.remainingDebt)}</span>
                  <span className="text-[10px] text-rose-600 font-bold block">نسبة السداد: {selectedYearDetails.debtPct}%</span>
                </div>

              </div>

              {/* Active Waterfall Stage Explanation */}
              <div className="p-4 bg-white rounded-2xl border border-slate-200/70 text-xs font-bold text-slate-600 space-y-2">
                <div className="flex items-center gap-2 text-slate-800 font-black">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>توزيع الراتب الفعّال في هذه المرحلة:</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-slate-700">46% معيشة</span>
                  <span className={`px-2.5 py-1 rounded-lg ${selectedYearDetails.debtPct > 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-400 line-through'}`}>
                    {selectedYearDetails.debtPct}% ديون
                  </span>
                  <span className={`px-2.5 py-1 rounded-lg ${selectedYearDetails.emergencyPct > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-400 line-through'}`}>
                    {selectedYearDetails.emergencyPct}% طوارئ
                  </span>
                  <span className={`px-2.5 py-1 rounded-lg ${selectedYearDetails.savingsPct >= 54 ? 'bg-emerald-600 text-white font-black' : 'bg-emerald-100 text-emerald-800'}`}>
                    {selectedYearDetails.savingsPct}% ادخار واستثمار
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: WHAT-IF SIMULATION TOOL                                            */}
        {/* ========================================================================= */}
        {activeTab === 'whatif' && (
          <motion.div
            key="whatif"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 text-purple-700 rounded-2xl border border-purple-200">
                  <Sliders className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">🔮 أداة ماذا لو؟ (محاكاة السيناريوهات المتطورة)</h3>
                  <p className="text-xs text-slate-500 font-bold">اختبر أثر نمو الراتب، الدخل الإضافي، أو العوائد الاستثمارية التقديرية دون المساس ببياناتك الفعلية</p>
                </div>
              </div>

              {isWhatIfModified && (
                <button
                  onClick={handleResetWhatIf}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors self-start sm:self-auto"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>إعادة تعيين للوضع الفعلي</span>
                </button>
              )}
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* 1. Monthly Salary Input */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/70 space-y-2">
                <label className="text-xs font-black text-slate-800 block">الراتب الشهري الأساسي (ر.س)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={customSalary}
                    onChange={(e) => setCustomSalary(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-black text-slate-900 focus:outline-emerald-500"
                  />
                  <button
                    onClick={() => setCustomSalary(baseSalary)}
                    className="px-3 py-2 bg-slate-200 hover:bg-slate-300 rounded-xl text-[11px] font-bold text-slate-700 shrink-0"
                  >
                    الأساسي ({formatCurrency(baseSalary)})
                  </button>
                </div>
              </div>

              {/* 2. Annual Salary Growth % */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/70 space-y-2">
                <div className="flex justify-between text-xs font-black text-slate-800">
                  <span>نسبة نمو الراتب السنوية (%):</span>
                  <span className="text-purple-700">{salaryGrowthPct}% سنويًا</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="1"
                  value={salaryGrowthPct}
                  onChange={(e) => setSalaryGrowthPct(Number(e.target.value))}
                  className="w-full accent-purple-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                  <span>0% (ثابت)</span>
                  <span>5% (متوسط)</span>
                  <span>10%</span>
                  <span>20% (مرتفع)</span>
                </div>
              </div>

              {/* 3. Extra Monthly Income */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/70 space-y-2">
                <label className="text-xs font-black text-slate-800 block">دخل إضافي شهري ثابت (ر.س)</label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={extraMonthlyIncome}
                  onChange={(e) => setExtraMonthlyIncome(Math.max(0, Number(e.target.value)))}
                  placeholder="مثال: 500 ريال شهرياً من عمل حر"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-black text-slate-900 focus:outline-emerald-500"
                />
                <p className="text-[10px] text-slate-400 font-bold">يوزع تلقائياً وفق الشلال المالي كل شهر</p>
              </div>

              {/* 4. Annual Investment Return % (Default 0%, strictly estimated) */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/70 space-y-2">
                <div className="flex justify-between text-xs font-black text-slate-800">
                  <span>عائد استثماري سنوي تقديري (%):</span>
                  <span className="text-emerald-700">{investmentReturnPct}% سنويًا</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="15"
                  step="1"
                  value={investmentReturnPct}
                  onChange={(e) => setInvestmentReturnPct(Number(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                  <span>0% (بدون أرباح)</span>
                  <span>5% (محافظ)</span>
                  <span>8% (متوازن)</span>
                  <span>15%</span>
                </div>
                <p className="text-[10px] text-amber-700 font-bold">
                  ⚠️ العوائد الاستثمارية تقديرية وليست مضمونة، وتطبق شهرياً بالمركب على رصيد الادخار فقط.
                </p>
              </div>

            </div>

            {/* Simulation Comparison Output */}
            <div className="bg-purple-50/90 border border-purple-200 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-200/70 pb-3">
                <span className="text-xs font-black text-purple-900">
                  مقارنة النتيجة المحاكاة بعد 10 سنوات:
                </span>
                <span className="text-xs font-black px-3 py-1 bg-purple-200 text-purple-900 rounded-lg self-start sm:self-auto">
                  صافي المركز المالي المحاكى: {formatCurrency(final10Year.netWorth)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white p-3.5 rounded-xl border border-purple-100">
                  <span className="text-[11px] font-bold text-slate-500 block">إجمالي الادخار والاستثمار</span>
                  <span className="text-lg font-black text-emerald-700 block mt-0.5">{formatCurrency(final10Year.savingsBalance)}</span>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-purple-100">
                  <span className="text-[11px] font-bold text-slate-500 block">صندوق الطوارئ المحاكى</span>
                  <span className="text-lg font-black text-amber-700 block mt-0.5">{formatCurrency(final10Year.emergencyBalance)}</span>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-purple-100">
                  <span className="text-[11px] font-bold text-slate-500 block">تاريخ الحرية من الديون</span>
                  <span className="text-sm font-black text-slate-800 block mt-1">{milestones.debtFreeDate || 'مكتمل'}</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl text-center text-xs text-slate-500 font-bold border border-slate-200/60">
              🔒 <b>محاكاة آمنة تماماً:</b> هذه الأداة لا تغيّر إعداداتك أو رواتبك أو حساباتك المحفوظة في قاعدة البيانات.
            </div>
          </motion.div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: ACHIEVEMENTS & REAL MILESTONES                                     */}
        {/* ========================================================================= */}
        {activeTab === 'achievements' && (
          <motion.div
            key="achievements"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm space-y-6"
          >
            <div>
              <h3 className="text-lg font-black text-slate-900 mb-1">🏅 المحطات والإنجازات الحقيقية</h3>
              <p className="text-xs text-slate-500 font-bold">شارات يتم فتحها تلقائياً عند تحقق الأحداث المالية الفعلية في حسابك</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {achievements.map((ach) => (
                <div 
                  key={ach.id}
                  className={`p-5 rounded-2xl border transition-all relative overflow-hidden ${
                    ach.unlocked 
                      ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/40 border-emerald-300/80 shadow-xs' 
                      : 'bg-slate-50/60 border-slate-200/70 opacity-75'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="text-sm font-black text-slate-900">{ach.title}</h4>
                    {ach.unlocked ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-600 text-white shadow-2xs">
                        <CheckCircle2 className="w-3 h-3" />
                        متحقق
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-200 text-slate-600">
                        <Lock className="w-3 h-3" />
                        قيد التراكم
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 font-bold mb-3">{ach.desc}</p>
                  
                  <div className="text-xs font-black text-slate-800 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                    <span>الوضع الفعلي:</span>
                    <span className={ach.unlocked ? 'text-emerald-700' : 'text-slate-500'}>{ach.metric}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

      </AnimatePresence>

    </div>
  );
}
