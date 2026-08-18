/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { 
  UserSettings,
  Expense,
  AccountItem,
  Transaction,
  BudgetItem,
  MonthlyClosure
} from '../types';
import { formatCurrency } from '../lib/utils';
import { 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  TrendingUp,
  AlertCircle,
  Scale,
  ArrowLeftRight,
  ShieldCheck,
  AlertTriangle,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Receipt,
  Lock
} from 'lucide-react';

interface ReportsViewProps {
  settings: UserSettings | null;
  expenses: Expense[];
  accounts?: AccountItem[];
  transactions?: Transaction[];
  budget?: BudgetItem[];
  monthlyClosures?: MonthlyClosure[];
}

export function ReportsView({ 
  settings, 
  expenses,
  accounts = [],
  transactions = [],
  budget = [],
  monthlyClosures = []
}: ReportsViewProps) {
  
  // Filter expenses to only include actual external spending (46% operational area)
  const expenseTransactions = useMemo(() => expenses.filter(e => {
    const isExpense = e.type === 'مصروف' || !e.type;
    const isInternalTransfer = e.category === 'صندوق مخصص' || e.category === 'الراتب' || e.description?.includes('توزيع') || e.description?.includes('تخصيص');
    const isDedicatedFund = 
      e.paymentMethod === 'صندوق سداد الديون' || 
      e.paymentMethod === 'صندوق الادخار والاستثمار' || 
      e.paymentMethod === 'صندوق الطوارئ' ||
      (e.category === 'الديون' && (e.paymentMethod?.includes('صندوق') || e.paymentMethod === 'صندوق سداد الديون'));
    return isExpense && !isInternalTransfer && !isDedicatedFund;
  }), [expenses]);

  const getArabicMonthName = (yearMonthStr: string) => {
    const [year, month] = yearMonthStr.split('-');
    const monthIndex = parseInt(month, 10) - 1;
    const arabicMonthNames = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    return `${arabicMonthNames[monthIndex]} ${year}`;
  };

  const currentSalary = settings?.salary || 2500;

  // Planned Budget vs Actual Balances Audit Report
  const accountAuditReport = useMemo(() => {
    // Standard Distribution Categories
    const plannedCategories = [
      {
        id: 'main',
        name: 'بنك الشامل / المعيشة (46%)',
        plannedAmount: Math.round(currentSalary * 0.46), // 1150
        matcher: (a: AccountItem) => a.name.includes('الرئيسي') || a.name.includes('المصاريف') || a.type === 'الحساب البنكي' || a.type === 'جاري',
        note: 'الميزانية المتبقية لمصاريف المعيشة التشغيلية'
      },
      {
        id: 'debt',
        name: 'صندوق سداد الديون (26%)',
        plannedAmount: Math.round(currentSalary * 0.26), // 650
        matcher: (a: AccountItem) => a.name.includes('الديون'),
        note: 'استقطاع سداد الالتزامات والأقساط'
      },
      {
        id: 'emergency',
        name: 'صندوق الطوارئ (16%)',
        plannedAmount: Math.round(currentSalary * 0.16), // 400
        matcher: (a: AccountItem) => a.name.includes('الطوارئ'),
        note: 'ادخار الحماية للأزمات والظروف الطارئة'
      },
      {
        id: 'savings',
        name: 'صندوق الادخار والاستثمار (12%)',
        plannedAmount: Math.round(currentSalary * 0.12), // 300
        matcher: (a: AccountItem) => a.name.includes('الادخار'),
        note: 'تنمية رأس المال والنمو المستقبلي'
      }
    ];

    const mappedAccounts = plannedCategories.map(cat => {
      const matchedAcc = accounts.find(cat.matcher);

      // Find recorded expenses for this account/category
      const catExpenses = expenses.filter(e => {
        const isExpense = e.type === 'مصروف' || !e.type;
        const isInternal = e.category === 'صندوق مخصص' || e.category === 'الراتب' || e.description?.includes('توزيع') || e.description?.includes('تخصيص');
        if (!isExpense || isInternal) return false;

        if (cat.id === 'main') {
          return !e.paymentMethod || e.paymentMethod.includes('الرئيسي') || e.paymentMethod.includes('بنكي') || e.paymentMethod === 'الحساب البنكي' || e.paymentMethod === 'المصاريف';
        } else {
          return e.paymentMethod && matchedAcc && (e.paymentMethod === matchedAcc.name || e.paymentMethod.includes(matchedAcc.name));
        }
      }).reduce((sum, e) => sum + (e.amount || 0), 0);

      const rawBalance = matchedAcc ? matchedAcc.balance : cat.plannedAmount;
      // Subtract expenses if rawBalance still equals plannedAmount or hasn't deducted expenses
      const actualBalance = (rawBalance === cat.plannedAmount && catExpenses > 0)
        ? rawBalance - catExpenses
        : rawBalance;

      const diff = actualBalance - cat.plannedAmount;

      // Find recorded transfers into this account
      const transferredIn = transactions
        .filter(t => matchedAcc && (t.toAccount === matchedAcc.name || t.toAccount?.includes(matchedAcc.name.replace('صندوق ', ''))))
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      // Find recorded transfers out of this account
      const transferredOut = transactions
        .filter(t => matchedAcc && (t.fromAccount === matchedAcc.name || t.fromAccount?.includes(matchedAcc.name.replace('صندوق ', ''))))
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      return {
        ...cat,
        accountName: matchedAcc ? matchedAcc.name : cat.name,
        actualBalance,
        catExpenses,
        diff,
        transferredIn,
        transferredOut,
        hasMissingTransfer: diff < 0 && transferredIn === 0,
        isBalanced: diff === 0
      };
    });

    const totalPlanned = mappedAccounts.reduce((sum, item) => sum + item.plannedAmount, 0);
    const totalActual = mappedAccounts.reduce((sum, item) => sum + item.actualBalance, 0);
    const netDifference = totalActual - totalPlanned;

    return {
      items: mappedAccounts,
      totalPlanned,
      totalActual,
      netDifference,
      allBalanced: mappedAccounts.every(item => item.isBalanced)
    };
  }, [accounts, currentSalary, transactions]);

  const monthlyLogs = useMemo(() => {
    const monthsSet = new Set<string>();
    
    // Always include current month
    const today = new Date();
    const currentMonthKey = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;
    monthsSet.add(currentMonthKey);

    expenses.forEach(e => {
      if (e.date && e.date.match(/^\d{4}-\d{2}/)) {
        monthsSet.add(e.date.substring(0, 7));
      }
    });

    const sortedMonths = Array.from(monthsSet).sort().reverse(); // Newest first

    return sortedMonths.map(monthKey => {
      const monthExpenses = expenseTransactions.filter(e => e.date && e.date.startsWith(monthKey));
      const totalSpent = monthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      
      const salary = settings?.salary || 2500;
      const budgetLimit = Math.round(salary * 0.46);
      const isCompliant = totalSpent <= budgetLimit;

      return {
        key: monthKey,
        name: getArabicMonthName(monthKey),
        totalSpent,
        budgetLimit,
        isCompliant,
        percent: budgetLimit > 0 ? Math.round((totalSpent / budgetLimit) * 100) : 0
      };
    });
  }, [expenses, expenseTransactions, settings]);

  return (
    <div className="space-y-8 max-w-3xl mx-auto dir-rtl">
      {/* 1. New Section: Planned vs Actual Account Reconciliation */}
      <div className="space-y-4">
        <div className="text-right space-y-1">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Scale className="w-5 h-5 text-emerald-600" />
              <span>مطابقة الميزانية المخططة بالأرصدة الفعلية</span>
            </h2>

            {accountAuditReport.allBalanced ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>جميع الحسابات متطابقة 100%</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>توجد فروقات بين المخطط والفعلي</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 font-medium">
            تقرير دقيق يوضح الفرق بين حصة كل صندوق في الميزانية والرصيد الفعلي الموجود في الحساب لاكتشاف أي تحويل مفقود أو مصروف غير مدوّن.
          </p>
        </div>

        {/* Audit Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {accountAuditReport.items.map((item) => (
            <div 
              key={item.id}
              className={`p-4 rounded-2xl border transition-all space-y-3 ${
                item.isBalanced 
                  ? 'bg-white border-slate-200 shadow-xs' 
                  : item.diff < 0 
                    ? 'bg-rose-50/40 border-rose-200 shadow-xs' 
                    : 'bg-emerald-50/40 border-emerald-200 shadow-xs'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-black text-sm text-slate-900 flex items-center gap-1.5">
                    <Wallet className="w-4 h-4 text-slate-500" />
                    <span>{item.accountName}</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">{item.note}</p>
                </div>

                {item.isBalanced ? (
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                    متطابق ✅
                  </span>
                ) : item.diff < 0 ? (
                  <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 text-[11px] font-bold">
                    عجز {formatCurrency(Math.abs(item.diff))}
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                    فائض +{formatCurrency(item.diff)}
                  </span>
                )}
              </div>

              {/* Numbers grid */}
              <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-50/80 rounded-xl text-center border border-slate-100">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold">المخطط</p>
                  <p className="font-black text-xs text-slate-700 mt-0.5">{formatCurrency(item.plannedAmount)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold">الرصيد الفعلي</p>
                  <p className="font-black text-xs text-slate-900 mt-0.5">{formatCurrency(item.actualBalance)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold">الفرق / الكشف</p>
                  <p className={`font-black text-xs mt-0.5 ${
                    item.isBalanced ? 'text-slate-500' : item.diff < 0 ? 'text-rose-600' : 'text-emerald-600'
                  }`}>
                    {item.diff === 0 ? '0 ر.س' : `${item.diff > 0 ? '+' : ''}${formatCurrency(item.diff)}`}
                  </p>
                </div>
              </div>

              {/* Expenses Breakdown if present */}
              {item.catExpenses > 0 && (
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium pt-1 border-t border-slate-100">
                  <span className="flex items-center gap-1">
                    <Receipt className="w-3.5 h-3.5 text-rose-500" />
                    <span>المصروفات المسجلة:</span>
                  </span>
                  <span className="font-bold text-rose-600">
                    -{formatCurrency(item.catExpenses)} (تم خصمها من الميزانية)
                  </span>
                </div>
              )}

              {/* Transfer Status Badge */}
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium pt-1 border-t border-slate-100">
                <span className="flex items-center gap-1">
                  <ArrowLeftRight className="w-3.5 h-3.5 text-slate-400" />
                  <span>التحويلات المسجلة:</span>
                </span>
                <span className="font-bold text-slate-700">
                  {item.transferredIn > 0 ? (
                    <span className="text-emerald-600 flex items-center gap-0.5">
                      <ArrowDownLeft className="w-3 h-3" />
                      مُحول إليه {formatCurrency(item.transferredIn)}
                    </span>
                  ) : item.transferredOut > 0 ? (
                    <span className="text-blue-600 flex items-center gap-0.5">
                      <ArrowUpRight className="w-3 h-3" />
                      مُحول منه {formatCurrency(item.transferredOut)}
                    </span>
                  ) : (
                    <span className="text-slate-400">لا توجد حركات تحويل جديدة</span>
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Audit Total Card */}
        <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
          <div className="space-y-1 text-center sm:text-right">
            <h4 className="font-black text-sm text-emerald-400 flex items-center gap-2 justify-center sm:justify-start">
              <span>إجمالي مطابقة الراتب مع الأرصدة (2,500 ريال)</span>
            </h4>
            <p className="text-xs text-slate-300">
              مجموع الميزانية المخططة: <b className="text-white">{formatCurrency(accountAuditReport.totalPlanned)}</b> | 
              مجموع الأرصدة الحالية: <b className="text-white">{formatCurrency(accountAuditReport.totalActual)}</b>
            </p>
          </div>

          <div className="px-4 py-2 bg-slate-800 rounded-xl text-center border border-slate-700">
            <p className="text-[10px] text-slate-400 font-bold">صافي المطابقة الإجمالية</p>
            <p className={`text-sm font-black mt-0.5 ${
              accountAuditReport.netDifference === 0 ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              {accountAuditReport.netDifference === 0 ? 'متطابق بالكامل (0 ر.س)' : `${formatCurrency(accountAuditReport.netDifference)}`}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Monthly Expense Compliance Record */}
      <div className="space-y-4">
        <div className="text-right space-y-1">
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <span>سجل الالتزام الشهري بالمصاريف</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            متابعة مباشرة لمدى التزامك بحد المصاريف المعيشية المتاح (46% من الراتب) شهراً بشهر.
          </p>
        </div>

        {/* Simplified List */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-50">
          {monthlyLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 font-bold flex flex-col items-center justify-center gap-2">
              <AlertCircle className="w-8 h-8 text-slate-300" />
              <span>لا توجد بيانات مسجلة بعد لبدء السجل.</span>
            </div>
          ) : (
            monthlyLogs.map((log) => (
              <div 
                key={log.key} 
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/40 transition-colors text-right"
              >
                {/* Month name & Mini visual bar */}
                <div className="space-y-1.5 flex-1 order-1 sm:order-2">
                  <div className="flex items-center justify-start gap-2">
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-black text-sm text-slate-800">{log.name}</span>
                    {(() => {
                      const closure = monthlyClosures.find(c => c.month === log.key);
                      if (closure) {
                        return (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                            <Lock className="w-3 h-3" />
                            <span>مغلق ومؤرشف ({closure.allocationNotes || (closure.isDeficit ? 'عجز' : 'متوازن')})</span>
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  
                  {/* Micro progress bar */}
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden flex-row-reverse">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          log.isCompliant ? 'bg-emerald-500' : 'bg-rose-500'
                        }`} 
                        style={{ width: `${Math.min(100, log.percent)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold">
                      تم صرف {formatCurrency(log.totalSpent)} من أصل {formatCurrency(log.budgetLimit)} ({log.percent}%)
                    </span>
                  </div>
                </div>

                {/* Compliance Badge */}
                <div className="shrink-0 flex items-center justify-start order-2 sm:order-1">
                  {log.isCompliant ? (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 font-black text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>التزمت ✅</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-50 text-rose-700 border border-rose-100 font-black text-xs">
                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span>تجاوزت المصاريف ❌</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Footnote */}
      <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 text-[11px] text-slate-500 text-right leading-relaxed font-medium">
        💡 <b>كيف يتم المطابقة والتتبع؟</b> يوزّع النظام راتبك (2,500 ريال) بنسب الميزانية الدقيقة: (26% ديون، 16% طوارئ، 12% ادخار، 46% معيشة). وبالمطابقة الآلية مع أرصدة حساباتك، يتم كشف الفرق في أي صندوق فوراً لمنع التجاوزات وضمان التوازن المالي.
      </div>
    </div>
  );
}
