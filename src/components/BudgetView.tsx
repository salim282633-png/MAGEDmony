import { UserSettings, Expense } from '../types';
import { formatCurrency } from '../lib/utils';
import { ShieldCheck, HeartHandshake, Lock, Info } from 'lucide-react';
import React, { useMemo } from 'react';

interface BudgetViewProps {
  settings?: UserSettings | null;
  expenses?: Expense[];
}

export function BudgetView({ settings, expenses = [] }: BudgetViewProps) {
  const salary = settings?.salary || 2500;
  
  const debtAmt = Math.round(salary * 0.26);
  const emergencyAmt = Math.round(salary * 0.16);
  const savingsAmt = Math.round(salary * 0.12);
  const mandatoryTotal = debtAmt + emergencyAmt + savingsAmt; // 54%
  const operationalAmt = salary - mandatoryTotal; // 46%
  
  // Calculate current month's expenses
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const currentMonthExpenses = useMemo(() => {
    return expenses
      .filter(e => {
        const isExpense = (e.type === 'مصروف' || !e.type);
        const isCurrentMonth = e.date && e.date.startsWith(currentMonthStr);
        const isInternalTransfer = e.category === 'صندوق مخصص' || e.category === 'الراتب' || e.description?.includes('توزيع') || e.description?.includes('تخصيص');
        const isDedicatedFund = 
          e.paymentMethod === 'صندوق سداد الديون' || 
          e.paymentMethod === 'صندوق الادخار والاستثمار' || 
          e.paymentMethod === 'صندوق الطوارئ' ||
          (e.category === 'الديون' && (e.paymentMethod?.includes('صندوق') || e.paymentMethod === 'صندوق سداد الديون'));
        const isDummy = e.amount === 700 || e.amount === 400 || e.amount === 300;
        return isExpense && isCurrentMonth && !isInternalTransfer && !isDedicatedFund && !isDummy;
      })
      .reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [expenses, currentMonthStr]);

  const remainingOperational = Math.max(0, operationalAmt - currentMonthExpenses);
  const progressPercent = Math.min(100, (currentMonthExpenses / operationalAmt) * 100);

  return (
    <div className="space-y-6">
      {/* Rule Banner */}
      <div className="bg-white rounded-3xl p-6 md:p-8 text-slate-800 shadow-sm relative overflow-hidden border border-slate-200">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-slate-50 rounded-full blur-3xl opacity-50"></div>
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-50 rounded-full blur-3xl opacity-50"></div>
        
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-full text-xs font-black tracking-wide text-emerald-700">
              القاعدة الذهبية
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">
            نوزّع راتبك أولاً، ثم نخبرك كم يمكنك أن تعيش به.
          </h2>
          <p className="text-slate-600 text-sm md:text-base max-w-2xl font-medium leading-relaxed">
            يتم تخصيص 54% من الراتب فوراً للمستقبل والالتزامات (الديون، الطوارئ، الادخار)، وما يتبقى (46%) هو الميزانية الوحيدة التي تحتاج لمتابعتها لمصاريفك المعيشية.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Living Budget Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/60 flex flex-col justify-center">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <HeartHandshake className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-lg">الصافي المتاح للعيش</h3>
                <p className="text-xs text-slate-500 font-medium mt-1">المبلغ المخصص للمصروفات التشغيلية (46%)</p>
              </div>
            </div>
            <div className="text-left">
              <span className="text-2xl font-black text-emerald-600">{formatCurrency(operationalAmt)}</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-sm font-bold">
              <span className="text-slate-600">ما تم صرفه: <span className="text-slate-900">{formatCurrency(currentMonthExpenses)}</span></span>
              <span className="text-slate-600">المتبقي: <span className="text-emerald-600">{formatCurrency(remainingOperational)}</span></span>
            </div>
            <div className="h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ${progressPercent > 90 ? 'bg-rose-500' : progressPercent > 75 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 text-center font-medium pt-2">
              استهلكت {progressPercent.toFixed(1)}% من ميزانية المعيشة هذا الشهر
            </p>
          </div>
        </div>

        {/* Deductions Breakdown */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/60">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-600">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg">الاقتطاعات الأساسية (54%)</h3>
              <p className="text-xs text-slate-500 font-medium mt-1">تقتطع تلقائياً فور إيداع الراتب</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                <span className="text-sm font-bold text-slate-700">سداد الديون</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs font-black text-rose-500/70">26%</span>
                <span className="text-sm font-black text-slate-900">{formatCurrency(debtAmt)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                <span className="text-sm font-bold text-slate-700">صندوق الطوارئ</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs font-black text-purple-500/70">16%</span>
                <span className="text-sm font-black text-slate-900">{formatCurrency(emergencyAmt)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span className="text-sm font-bold text-slate-700">الادخار والاستثمار</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs font-black text-blue-500/70">12%</span>
                <span className="text-sm font-black text-slate-900">{formatCurrency(savingsAmt)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800 font-medium leading-relaxed">
          بناءً على طلبك، تم إيقاف أي ميزانيات يدوية أو توزيعات فرعية للمصاريف. القاعدة الوحيدة الآن هي أن تستمتع بالـ 46% المتبقية لحياتك، بينما يقوم التطبيق بحماية مستقبلك من خلال الـ 54% المقتطعة تلقائياً.
        </p>
      </div>

    </div>
  );
}
