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
  SavingsRecord
} from '../types';
import { formatCurrency } from '../lib/utils';
import { 
  Target, 
  Sparkles, 
  TrendingUp, 
  ShieldCheck, 
  CreditCard, 
  PiggyBank, 
  Home, 
  Award, 
  CheckCircle2, 
  Sliders, 
  RotateCcw, 
  Info, 
  Calendar,
  Lock,
  ArrowUpRight,
  Zap,
  HelpCircle
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { motion } from 'motion/react';

interface TenYearJourneyViewProps {
  settings: UserSettings | null;
  accounts?: AccountItem[];
  expenses?: Expense[];
  transactions?: Transaction[];
  debts?: DebtItem[];
  savings?: SavingsRecord[];
}

export function TenYearJourneyView({
  settings,
  accounts = [],
  expenses = [],
  transactions = [],
  debts = [],
  savings = []
}: TenYearJourneyViewProps) {

  // Base parameters
  const baseSalary = settings?.salary || 2500;
  const debtPct = 26;
  const emergencyPct = 16;
  const savingsPct = 12;
  const livingPct = 46;

  // "What if" Simulation State (-50% to +100%)
  const [simPercent, setSimPercent] = useState<number>(0);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [selectedYear, setSelectedYear] = useState<number>(10);

  // Effective salary used for calculations
  const effectiveSalary = useMemo(() => {
    return Math.max(0, Math.round(baseSalary * (1 + simPercent / 100)));
  }, [baseSalary, simPercent]);

  // Monthly breakdown
  const monthlyDebt = useMemo(() => Math.round(effectiveSalary * (debtPct / 100)), [effectiveSalary, debtPct]);
  const monthlyEmergency = useMemo(() => Math.round(effectiveSalary * (emergencyPct / 100)), [effectiveSalary, emergencyPct]);
  const monthlySavings = useMemo(() => Math.round(effectiveSalary * (savingsPct / 100)), [effectiveSalary, savingsPct]);
  const monthlyLiving = useMemo(() => Math.round(effectiveSalary * (livingPct / 100)), [effectiveSalary, livingPct]);
  const monthlyAccumulated = monthlyDebt + monthlyEmergency + monthlySavings; // 54%

  // 10-Year Totals (120 Months)
  const totalMonths = 120;
  const total10YearWealth = monthlyAccumulated * totalMonths;
  const total10YearDebt = monthlyDebt * totalMonths;
  const total10YearEmergency = monthlyEmergency * totalMonths;
  const total10YearSavings = monthlySavings * totalMonths;
  const total10YearLiving = monthlyLiving * totalMonths;

  // Actual progress calculation based on actual account balances & past salary distributions
  const actualStats = useMemo(() => {
    // 1. Calculate actual savings box balance
    const savingsAcc = accounts.find(a => a.name.includes('الادخار') || a.name.includes('استثمار'));
    const actualSavingsBalance = savingsAcc?.balance || 0;

    // 2. Calculate actual emergency box balance
    const emergencyAcc = accounts.find(a => a.name.includes('الطوارئ'));
    const actualEmergencyBalance = emergencyAcc?.balance || 0;

    // 3. Calculate actual debt box balance or total debt payments
    const debtAcc = accounts.find(a => a.name.includes('الديون'));
    const actualDebtBalance = debtAcc?.balance || 0;

    // Total actual accumulated balance in special allocation boxes
    const totalActualBalance = Math.max(0, actualSavingsBalance + actualEmergencyBalance + actualDebtBalance);

    // Count salary distribution entries executed
    const distributionCount = expenses.filter(e => 
      e.category === 'الراتب' && e.description && (e.description.includes('توزيع') || e.description.includes('راتب'))
    ).length;

    // Target for 10 years without simulation
    const base10YearTarget = Math.round(baseSalary * 0.54 * 120);

    // Progress percentage
    const rawProgress = base10YearTarget > 0 ? (totalActualBalance / base10YearTarget) * 100 : 0;
    const progressPct = Math.min(100, Math.max(0, Math.round(rawProgress * 10) / 10));

    return {
      savingsBalance: actualSavingsBalance,
      emergencyBalance: actualEmergencyBalance,
      debtBalance: actualDebtBalance,
      totalBalance: totalActualBalance,
      distributionCount,
      progressPct,
      base10YearTarget
    };
  }, [accounts, expenses, baseSalary]);

  // Year-by-Year Projected Timeline Data for Charts & Selected Year Details
  const timelineData = useMemo(() => {
    const data = [];
    for (let year = 0; year <= 10; year++) {
      const months = year * 12;
      const cumDebt = monthlyDebt * months;
      const cumEmergency = monthlyEmergency * months;
      const cumSavings = monthlySavings * months;
      const cumLiving = monthlyLiving * months;
      const cumWealth = monthlyAccumulated * months;
      const annualSalary = effectiveSalary * 12;

      data.push({
        year,
        yearLabel: year === 0 ? 'اليوم' : `سنة ${year}`,
        months,
        annualSalary,
        cumSalary: effectiveSalary * months,
        cumDebt,
        cumEmergency,
        cumSavings,
        cumLiving,
        cumWealth,
        // Annual allocations for that specific year
        yearDebt: monthlyDebt * 12,
        yearEmergency: monthlyEmergency * 12,
        yearSavings: monthlySavings * 12,
        yearLiving: monthlyLiving * 12,
      });
    }
    return data;
  }, [monthlyDebt, monthlyEmergency, monthlySavings, monthlyLiving, monthlyAccumulated, effectiveSalary]);

  const selectedYearDetails = useMemo(() => {
    return timelineData.find(d => d.year === selectedYear) || timelineData[10];
  }, [timelineData, selectedYear]);

  // Dynamic Motivational Message
  const motivationalMessage = useMemo(() => {
    const p = actualStats.progressPct;
    if (p < 5) {
      return {
        text: "كل راتب توزعه اليوم هو خطوة أولى نحو أمان مالي مستدام وتراكم ثروة لمستقبلك.",
        sub: "البداية المستمرة هي السر الفعلي لصناعة الفارق الاستثماري بعد 10 سنوات."
      };
    } else if (p < 25) {
      return {
        text: "استمرارك اليوم يصنع فرقًا كبيرًا بعد 10 سنوات.",
        sub: "الالتزام بنسب القاعدة الذهبية يضمن لك نمواً تراكمياً دون التضحية بحياتك الحالية."
      };
    } else if (p < 50) {
      return {
        text: "أنت لا تبني رصيدًا فقط، بل تبني مساحة أكبر من الحرية والاستقلال المالي.",
        sub: "خطواتك الثابتة تحميك من التقلبات وتمنحك أماناً مالياً متزايداً."
      };
    } else if (p < 75) {
      return {
        text: "قطعث نصف طريق الـ 10 سنوات بنجاح والتزام استثنائي!",
        sub: "مستقبلك المالي أصبح أكثر استقراراً وقوة مع تضخم رصيد الادخار والطوارئ."
      };
    } else {
      return {
        text: "أنت الآن على بعد خطوات معدودة من تحقيق هدف الـ 10 سنوات كاملاً!",
        sub: "استمرارك وثباتك نموذج حقيقي لإدارة المال بذكاء وحكمة."
      };
    }
  }, [actualStats.progressPct]);

  // Key Achievements dynamic list
  const achievements = useMemo(() => {
    return [
      {
        id: 'first_year',
        title: '🏆 أول سنة مكتملة',
        desc: 'التزام كامل بتوزيع الراتب لمدة 12 شهراً',
        unlocked: actualStats.distributionCount >= 12 || actualStats.progressPct >= 10,
        metric: `${actualStats.distributionCount} / 12 شهراً`
      },
      {
        id: 'debt_repayment',
        title: '💳 سداد وتخصيص الديون',
        desc: 'تراكم مخصص الديون في صندوق السداد',
        unlocked: actualStats.debtBalance > 0,
        metric: formatCurrency(actualStats.debtBalance)
      },
      {
        id: 'emergency_shield',
        title: '🛡️ حماية صندوق الطوارئ',
        desc: 'تأسيس شبكة أمان مالي لمواجهة الأزمات',
        unlocked: actualStats.emergencyBalance >= baseSalary * 2,
        metric: formatCurrency(actualStats.emergencyBalance)
      },
      {
        id: 'savings_growth',
        title: '💰 نمو الادخار والاستثمار',
        desc: 'بناء أصول مالية مستدامة',
        unlocked: actualStats.savingsBalance >= baseSalary * 3,
        metric: formatCurrency(actualStats.savingsBalance)
      },
      {
        id: 'halfway',
        title: '🎯 منتصف الطريق (5 سنوات)',
        desc: 'الوصول إلى 50% من هدف الـ 10 سنوات',
        unlocked: actualStats.progressPct >= 50 || actualStats.distributionCount >= 60,
        metric: `${actualStats.progressPct}% مكتملة`
      },
      {
        id: 'decade_mastery',
        title: '🏆 10 سنوات من الالتزام',
        desc: 'إكمال خطة الـ 10 سنوات بنجاح تام',
        unlocked: actualStats.progressPct >= 100 || actualStats.distributionCount >= 120,
        metric: `${actualStats.progressPct}% مكتملة`
      }
    ];
  }, [actualStats, baseSalary]);

  return (
    <div className="space-y-8 pb-12">
      
      {/* SECTION HEADER */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 w-72 h-72 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-black">
              <Target className="w-4 h-4 text-emerald-400" />
              <span>🎯 رحلتي المالية – 10 سنوات</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              إذا استمريت على خطتي الحالية، أين سأكون بعد 10 سنوات؟
            </h1>
            <p className="text-slate-300 text-xs md:text-sm font-bold max-w-2xl leading-relaxed">
              رؤية مستقبلية واضحة ومحفزة تظهر أثر التزامك اليومي بقاعدة التوزيع الذكية (54% ادخار وطوارئ وديون / 46% معيشة) على مدى 120 شهراً قادماً.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4 text-center md:text-right shrink-0 min-w-[200px]">
            <span className="text-[11px] font-bold text-slate-300 block mb-1">الراتب الأساسي المعتمد</span>
            <span className="text-2xl font-black text-emerald-400 block">{formatCurrency(baseSalary)}</span>
            <span className="text-[10px] text-slate-400 font-bold block mt-1">توزيع تلقائي شهري ثابت (100%)</span>
          </div>
        </div>
      </div>

      {/* 2. CARD PRINCIPAL TOP SUMMARY */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6 border-b border-slate-100 pb-6 mb-6">
          
          <div>
            <div className="flex items-center gap-2 text-slate-500 font-bold text-xs mb-1">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>الأثر المالي المتراكم بعد 10 سنوات (120 شهرًا)</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900">بعد 10 سنوات 🎯</h2>
          </div>

          <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 md:p-5 text-right flex items-center justify-between md:justify-start gap-4">
            <div>
              <span className="text-xs font-bold text-emerald-800 block">إجمالي الأموال المتوقعة</span>
              <span className="text-2xl md:text-3xl font-black text-emerald-700">{formatCurrency(total10YearWealth)}</span>
            </div>
            <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-md shadow-emerald-200">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Breakdown Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Debt */}
          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/60 transition-all hover:bg-slate-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500">💳 المخصص للديون ({debtPct}%)</span>
              <div className="p-1.5 bg-rose-100 text-rose-700 rounded-lg">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <span className="text-xl font-black text-slate-900 block">{formatCurrency(total10YearDebt)}</span>
            <p className="text-[11px] text-slate-400 font-bold mt-1">إجمالي ما يتم تخصيصه لسداد الديون</p>
          </div>

          {/* Emergency */}
          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/60 transition-all hover:bg-slate-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500">🛡️ صندوق الطوارئ ({emergencyPct}%)</span>
              <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <span className="text-xl font-black text-slate-900 block">{formatCurrency(total10YearEmergency)}</span>
            <p className="text-[11px] text-slate-400 font-bold mt-1">رصيد الطوارئ المتركم الصافي</p>
          </div>

          {/* Savings */}
          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/60 transition-all hover:bg-slate-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500">💰 الادخار والاستثمار ({savingsPct}%)</span>
              <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                <PiggyBank className="w-4 h-4" />
              </div>
            </div>
            <span className="text-xl font-black text-slate-900 block">{formatCurrency(total10YearSavings)}</span>
            <p className="text-[11px] text-slate-400 font-bold mt-1">أصول مالية متراكمة للاستثمار</p>
          </div>

          {/* Living */}
          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/60 transition-all hover:bg-slate-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500">🏠 مخصص المعيشة ({livingPct}%)</span>
              <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                <Home className="w-4 h-4" />
              </div>
            </div>
            <span className="text-xl font-black text-slate-900 block">{formatCurrency(total10YearLiving)}</span>
            <p className="text-[11px] text-slate-400 font-bold mt-1">مصاريف التشغيل والمصروفات اليومية</p>
          </div>
        </div>

        <div className="mt-4 p-3 bg-slate-100/70 rounded-xl text-center text-xs text-slate-500 font-bold border border-slate-200/60">
          💡 <b>ملاحظة محاسبية:</b> لا تُعتبر مصاريف المعيشة (46%) ضمن الثروة المتراكمة لأنها صُرفت كالتزامات تشغيلية حية. الثروة المتراكمة تشمل الادخار + الطوارئ + سداد الديون.
        </div>
      </div>

      {/* 3. PROGRESS INDICATOR & MOTIVATIONAL MESSAGE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Progress Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-black text-slate-900">🏆 تقدمي نحو 10 سنوات</h3>
              </div>
              <span className="text-xs font-black px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                {actualStats.progressPct}% مكتملة
              </span>
            </div>

            <div className="space-y-2 mb-4">
              <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                <motion.div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, Math.max(2, actualStats.progressPct))}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-bold text-slate-500">
                <span>الرصيد الفعلي في الصناديق: {formatCurrency(actualStats.totalBalance)}</span>
                <span>الهدف: {formatCurrency(actualStats.base10YearTarget)}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 text-xs font-bold text-slate-600 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>تم تنفيذ <b>{actualStats.distributionCount}</b> توزيعًا شهريًا معتمدًا حتى الآن من أصل 120 شهرًا.</span>
          </div>
        </div>

        {/* Motivational Message Card */}
        <div className="lg:col-span-2 bg-gradient-to-br from-emerald-900 to-slate-900 text-white rounded-3xl p-6 border border-emerald-800/50 shadow-md flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="relative z-10 space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-xs">
              <Zap className="w-4 h-4 fill-emerald-400" />
              <span>رسالة تحفيزية ذكية مخصصة لمسارك</span>
            </div>

            <h3 className="text-xl md:text-2xl font-black leading-snug text-white">
              «{motivationalMessage.text}»
            </h3>
            
            <p className="text-xs md:text-sm text-emerald-200/90 font-medium leading-relaxed">
              {motivationalMessage.sub}
            </p>
          </div>

          <div className="relative z-10 pt-4 mt-4 border-t border-emerald-800/60 flex items-center justify-between text-xs font-bold text-emerald-300">
            <span>الالتزام المستمر يحول الأرقام الصغيرة إلى أمان مالي راسخ.</span>
            <span className="text-[11px] px-2.5 py-1 bg-emerald-950/60 rounded-lg text-emerald-400 border border-emerald-800/40">120 شهراً</span>
          </div>
        </div>

      </div>

      {/* 4. VISUAL GROWTH CHART */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-slate-900">📈 مسار نمو الثروة المتراكمة عبر السنوات</h3>
            <p className="text-xs text-slate-500 font-bold">تطور الراتب المتوقع والمخصصات التراكمية من السنة 1 إلى السنة 10</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1.5 rounded-xl">
            <span>النسب المعتمدة:</span>
            <span className="text-rose-600">26% ديون</span>
            <span>/</span>
            <span className="text-amber-600">16% طوارئ</span>
            <span>/</span>
            <span className="text-emerald-600">12% ادخار</span>
          </div>
        </div>

        <div className="h-72 md:h-80 w-full dir-ltr">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="colorEmergency" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="colorDebt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="yearLabel" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis 
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickFormatter={(val) => `${Math.round(val / 1000)}k`}
              />
              <Tooltip 
                formatter={(value: any) => [`${formatCurrency(Number(value))}`, '']}
                labelFormatter={(label) => `التوقع في: ${label}`}
                contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', textAlign: 'right' }}
              />
              <Legend verticalAlign="top" height={36}/>
              <Area type="monotone" dataKey="cumSavings" name="💰 الادخار المتراكم" stroke="#10b981" fillOpacity={1} fill="url(#colorSavings)" stackId="1" />
              <Area type="monotone" dataKey="cumEmergency" name="🛡️ الطوارئ المتراكم" stroke="#f59e0b" fillOpacity={1} fill="url(#colorEmergency)" stackId="1" />
              <Area type="monotone" dataKey="cumDebt" name="💳 مخصص الديون المتراكم" stroke="#f43f5e" fillOpacity={1} fill="url(#colorDebt)" stackId="1" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 5. INTERACTIVE 10-YEAR TIMELINE */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm space-y-6">
        <div>
          <h3 className="text-lg font-black text-slate-900 mb-1">📅 الخط الزمني التفاعلي لـ 10 سنوات</h3>
          <p className="text-xs text-slate-500 font-bold">اضغط على أي سنة لعرض تفاصيل المخصصات والأرصدة المتراكمة الخاصة بها</p>
        </div>

        {/* Timeline Buttons */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 scrollbar-thin">
          {timelineData.map((d) => {
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
        <div className="bg-slate-50/90 rounded-3xl p-6 border border-slate-200/80 space-y-5 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
            <div>
              <span className="text-xs font-bold text-slate-400 block">تفاصيل السقف المالي لـ</span>
              <h4 className="text-xl font-black text-slate-900">{selectedYearDetails.yearLabel} ({selectedYearDetails.months} شهراً)</h4>
            </div>
            <div className="bg-emerald-100 text-emerald-800 px-4 py-2 rounded-xl text-xs font-black">
              صافي الثروة المتراكمة: {formatCurrency(selectedYearDetails.cumWealth)}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-slate-400 block">الراتب السنوي الإجمالي</span>
              <span className="text-lg font-black text-slate-800 block">{formatCurrency(selectedYearDetails.annualSalary)}</span>
              <span className="text-[10px] text-slate-500 font-bold block">التراكمي: {formatCurrency(selectedYearDetails.cumSalary)}</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-rose-600 block">💳 المخصص للديون</span>
              <span className="text-lg font-black text-slate-800 block">{formatCurrency(selectedYearDetails.yearDebt)}</span>
              <span className="text-[10px] text-slate-500 font-bold block">التراكمي: {formatCurrency(selectedYearDetails.cumDebt)}</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-amber-600 block">🛡️ المخصص للطوارئ</span>
              <span className="text-lg font-black text-slate-800 block">{formatCurrency(selectedYearDetails.yearEmergency)}</span>
              <span className="text-[10px] text-slate-500 font-bold block">التراكمي: {formatCurrency(selectedYearDetails.cumEmergency)}</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-emerald-600 block">💰 المخصص للادخار</span>
              <span className="text-lg font-black text-slate-800 block">{formatCurrency(selectedYearDetails.yearSavings)}</span>
              <span className="text-[10px] text-slate-500 font-bold block">التراكمي: {formatCurrency(selectedYearDetails.cumSavings)}</span>
            </div>

          </div>
        </div>
      </div>

      {/* 6. SIMULATION TOOL "🔮 ماذا لو؟" */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 text-purple-700 rounded-2xl border border-purple-200">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">🔮 ماذا لو؟ (محاكاة تغيير الراتب)</h3>
              <p className="text-xs text-slate-500 font-bold">استكشف تأثير زيادة أو انخفاض راتبك على ثروتك بعد 10 سنوات دون تعديل خطتك الحقيقية</p>
            </div>
          </div>

          {simPercent !== 0 && (
            <button
              onClick={() => setSimPercent(0)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors self-start sm:self-auto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إعادة للراتب الأصلي</span>
            </button>
          )}
        </div>

        {/* Preset percentage buttons & slider */}
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span>نسبة التغيير التجريبية في الراتب: <b className="text-purple-700 font-black">{simPercent > 0 ? `+${simPercent}%` : `${simPercent}%`}</b></span>
            <span>الراتب المحاكى: <b className="text-slate-900 font-black">{formatCurrency(effectiveSalary)}</b></span>
          </div>

          <div className="flex flex-wrap gap-2">
            {[-30, -15, 0, 10, 20, 30, 50].map((pct) => (
              <button
                key={pct}
                onClick={() => setSimPercent(pct)}
                className={`px-3.5 py-2 rounded-xl text-xs font-black border transition-all ${
                  simPercent === pct 
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm' 
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {pct === 0 ? 'الراتب الأصلي (0%)' : pct > 0 ? `+${pct}%` : `${pct}%`}
              </button>
            ))}
          </div>

          <input 
            type="range"
            min="-50"
            max="100"
            step="5"
            value={simPercent}
            onChange={(e) => setSimPercent(Number(e.target.value))}
            className="w-full accent-purple-600 cursor-pointer"
          />
        </div>

        {/* Simulation Output Card */}
        {simPercent !== 0 && (
          <div className="bg-purple-50/80 border border-purple-200 rounded-2xl p-5 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-purple-900">نتيجة المحاكاة التجريبية بعد 10 سنوات:</span>
              <span className="text-xs font-bold px-2.5 py-1 bg-purple-200 text-purple-900 rounded-lg">
                فارق {formatCurrency(total10YearWealth - (baseSalary * 0.54 * 120))}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="bg-white p-3.5 rounded-xl border border-purple-100 text-right">
                <span className="text-[11px] font-bold text-slate-500 block">إجمالي الأموال المتوقعة (المحاكى)</span>
                <span className="text-lg font-black text-purple-700 block">{formatCurrency(total10YearWealth)}</span>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-purple-100 text-right">
                <span className="text-[11px] font-bold text-slate-500 block">الادخار المتوقع (المحاكى)</span>
                <span className="text-lg font-black text-emerald-700 block">{formatCurrency(total10YearSavings)}</span>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-purple-100 text-right">
                <span className="text-[11px] font-bold text-slate-500 block">صندوق الطوارئ (المحاكى)</span>
                <span className="text-lg font-black text-amber-700 block">{formatCurrency(total10YearEmergency)}</span>
              </div>
            </div>
          </div>
        )}

        <div className="p-3 bg-slate-50 rounded-xl text-center text-xs text-slate-500 font-bold border border-slate-200/60">
          🔒 <b>قاعدة السلامة:</b> هذه المحاكاة مؤقتة ولا تؤثر على أرصدتك الحقيقية أو خطتك أو ميزانيتك المسجلة في النظام.
        </div>
      </div>

      {/* 7. KEY MILESTONES & ACHIEVEMENTS */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm space-y-6">
        <div>
          <h3 className="text-lg font-black text-slate-900 mb-1">🏅 أبرز الإنجازات والمحطات المستقبلية</h3>
          <p className="text-xs text-slate-500 font-bold">بطاقات إنجاز يتم فتحها آلياً عند تحقيق أهداف الرحلة المالية</p>
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
                    محقق
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-200 text-slate-600">
                    <Lock className="w-3 h-3" />
                    قيد التراكم
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-600 font-bold mb-3">{ach.desc}</p>
              
              <div className="text-xs font-black text-slate-800 pt-2 border-t border-slate-200/60">
                <span>الوضع الفعلي: </span>
                <span className={ach.unlocked ? 'text-emerald-700' : 'text-slate-500'}>{ach.metric}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
