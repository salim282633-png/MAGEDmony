/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { X, ArrowDownLeft, ArrowUpRight, Receipt, Target, Plus, Check, AlertCircle, Landmark } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useFinanceData } from '../lib/useFinanceData';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, updateDoc, doc, deleteDoc, increment } from 'firebase/firestore';
import { formatCurrency } from '../lib/utils';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: 'income' | 'expense';
}

export function QuickAddModal({ isOpen, onClose, initialType = 'income' }: QuickAddModalProps) {
  const { 
    addTransaction, 
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

  const [activeType, setActiveType] = useState<'income' | 'expense'>(initialType === 'expense' ? 'expense' : 'income');
  const [incomeType, setIncomeType] = useState<'salary' | 'extra'>('extra');
  const [amount, setAmount] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [accountName, setAccountName] = useState<string>('الحساب البنكي الرئيسي');
  
  // Extra income allocation state: 3 main options
  const [extraAllocationChoice, setExtraAllocationChoice] = useState<'specific' | 'salary_split' | 'unallocated'>('specific');
  const [specificFund, setSpecificFund] = useState<'living' | 'debt' | 'emergency' | 'savings'>('living');
  const [selectedDebtId, setSelectedDebtId] = useState<string>('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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

  // Adjust default fields depending on type selection
  React.useEffect(() => {
    if (activeType === 'income' && incomeType === 'salary') {
      setAmount(salaryAmount.toString());
      setName(`إيداع وتوزيع راتب ${currentMonthArabic} تلقائياً`);
      setAccountName('الحساب البنكي الرئيسي');
    } else {
      setAmount('');
      setName('');
      if (accounts.length > 0) {
        const mainAcc = accounts.find(a => a.name === 'الحساب البنكي الرئيسي');
        setAccountName(mainAcc ? mainAcc.name : accounts[0].name);
      }
    }
  }, [activeType, incomeType, salaryAmount, currentMonthArabic, accounts]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    if (activeType === 'income' && incomeType === 'salary') {
      const parsedSalary = parseFloat(amount);
      if (isNaN(parsedSalary) || parsedSalary <= 0) {
        alert('يرجى إدخال مبلغ الراتب بشكل صحيح.');
        return;
      }
      
      const salaryAmount = parsedSalary;

      if (hasDistributedThisMonth) {
        alert(`توزيع راتب شهر ${currentMonthArabic} تم تنفيذه بالفعل. لمنع التكرار المحاسبي، لا يمكن إضافة توزيع آخر تلقائياً. يمكنك استخدام خيار "إعادة توزيع الراتب" من شاشة الراتب.`);
        return;
      }

      setIsSubmitting(true);
      try {
        const today = new Date().toISOString().split('T')[0];

        // Check if Emergency Fund is fully funded based on 3 months of basic expenses (46% of salary)
        const basicExpenses = Math.round(salaryAmount * 0.46);
        const emergencyTarget = basicExpenses * 3; // 3 months of basic expenses
        const emergencyAccount = accounts.find(a => a.name === 'صندوق الطوارئ' && !a.isArchived);
        const currentEmergencyBalance = emergencyAccount ? (emergencyAccount.balance || 0) : 0;
        const isEmergencyFundComplete = currentEmergencyBalance >= emergencyTarget;

        // Smart Redirect Rule percentages
        let debtPct = 26;
        let emergencyPct = isEmergencyFundComplete ? 0 : 16;
        let savingsPct = 12;

        if (debts.length > 0) {
          const debtFund = accounts.find(a => a.name === 'صندوق سداد الديون' || a.name.includes('الديون'));
          const debtFundBalance = debtFund?.balance || 0;
          const rawRemaining = debts.reduce((sum, d) => sum + Math.max(0, (d.totalAmount || 0) - (d.paidAmount || 0)), 0);
          const totalRemaining = Math.max(0, rawRemaining - debtFundBalance);
          if (totalRemaining === 0) {
            // Debt free!
            if (isEmergencyFundComplete) {
              // Both done! Everything goes to Savings
              debtPct = 0;
              emergencyPct = 0;
              savingsPct = 54;
            } else {
              // Redirect debt 26% to emergency
              debtPct = 0;
              emergencyPct = 16 + 26;
              savingsPct = 12;
            }
          } else if (isEmergencyFundComplete) {
            // Only emergency done, redirect its 16% to savings
            debtPct = 26;
            emergencyPct = 0;
            savingsPct = 12 + 16;
          }
        } else if (isEmergencyFundComplete) {
           // No debts and emergency complete
           debtPct = 0;
           emergencyPct = 0;
           savingsPct = 54;
        }

        const debtAmount = Math.round(salaryAmount * (debtPct / 100));
        const emergencyAmount = Math.round(salaryAmount * (emergencyPct / 100));
        const savingsAmount = Math.round(salaryAmount * (savingsPct / 100));
        const operationalAmount = salaryAmount - debtAmount - emergencyAmount - savingsAmount;
        const operationalPct = Math.round((operationalAmount / salaryAmount) * 100);

        await distributeSalaryTransactional(
          salaryAmount,
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

        setSuccessMsg(`✅ تم استلام وتوزيع راتب ${currentMonthArabic} تلقائياً بنسبة 100%!`);
        setAmount('');
        setName('');
        setTimeout(() => {
          setSuccessMsg(null);
          onClose();
        }, 1500);
      } catch (err) {
        console.error(err);
        alert('حدث خطأ أثناء توزيع الراتب.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    setIsSubmitting(true);
    const todayStr = new Date().toISOString().split('T')[0];

    try {
      if (activeType === 'income') {
        if (incomeType === 'extra') {
          // --- 3-OPTION EXTRA INCOME MECHANISM ---
          if (extraAllocationChoice === 'specific') {
            // Option 1: Direct to a specific fund
            if (specificFund === 'living') {
              await quickAddIncomeLivingTransactional(parsedAmount, name || 'دخل إضافي (مخصص للمعيشة)', todayStr);
              setSuccessMsg(`🎉 تم توجيه الدخل الإضافي (${formatCurrency(parsedAmount)}) لميزانية المعيشة لهذا الشهر بنجاح!`);
            } else if (specificFund === 'debt') {
              const targetDebt = debts.find(d => d.id === (selectedDebtId || debts[0]?.id)) || debts[0];
              await quickAddIncomeDebtTransactional(parsedAmount, name || 'دخل إضافي (لسداد الديون)', targetDebt?.id, todayStr);
              if (targetDebt) {
                setSuccessMsg(`🎉 تم توجيه الدخل الإضافي (${formatCurrency(parsedAmount)}) لسداد دين [${targetDebt.name}] بنجاح!`);
              } else {
                setSuccessMsg(`🎉 تم توجيه ${formatCurrency(parsedAmount)} لصندوق سداد الديون بنجاح!`);
              }
            } else if (specificFund === 'emergency') {
              await quickAddIncomeEmergencyTransactional(parsedAmount, name || 'دخل إضافي (طوارئ)', todayStr);
              setSuccessMsg(`🎉 تم إيداع وتوجيه ${formatCurrency(parsedAmount)} مباشرة في صندوق الطوارئ!`);
            } else if (specificFund === 'savings') {
              await quickAddIncomeSavingsTransactional(parsedAmount, name || 'دخل إضافي (ادخار واستثمار)', todayStr);
              setSuccessMsg(`🎉 تم إيداع وتوجيه ${formatCurrency(parsedAmount)} في صندوق الادخار والاستثمار!`);
            }
          } else if (extraAllocationChoice === 'salary_split') {
            await quickAddIncomeSalarySplitTransactional(parsedAmount, name || 'دخل إضافي موزع بنسب الراتب', todayStr);
            const debtAmt = Math.round(parsedAmount * 0.26);
            const emgAmt = Math.round(parsedAmount * 0.16);
            const savAmt = Math.round(parsedAmount * 0.12);
            const livingAmt = parsedAmount - debtAmt - emgAmt - savAmt;
            setSuccessMsg(`🎉 تم توزيع الدخل الإضافي بنجاح: ${formatCurrency(livingAmt)} للمعيشة، ${formatCurrency(debtAmt)} للديون، ${formatCurrency(emgAmt)} للطوارئ، ${formatCurrency(savAmt)} للادخار!`);
          } else if (extraAllocationChoice === 'unallocated') {
            await quickAddIncomeUnallocatedTransactional(parsedAmount, name || 'دخل إضافي غير مخصص', todayStr);
            setSuccessMsg(`✅ تم حفظ الدخل الإضافي (${formatCurrency(parsedAmount)}) كـ "غير مخصص" في الحساب البنكي وصافي الثروة.`);
          }
        }
      } else if (activeType === 'expense') {
        await quickAddExpenseTransactional(parsedAmount, name || 'مصروف عام', accountName, 'الطعام', todayStr);
        setSuccessMsg(`تم خصم المصروف بقيمة ${formatCurrency(parsedAmount)} من ${accountName}!`);
      }

      setAmount('');
      setName('');
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1400);

    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء معالجة العملية: ' + (err instanceof Error ? err.message : 'يرجى المحاولة مرة أخرى'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm dir-rtl text-right">
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-100 space-y-5 max-h-[92vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <span>إضافة حركة مالية سريعة</span>
              <span className="text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">تلقائي</span>
            </h3>
            <button 
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Type Selector Tabs */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-2xl text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setActiveType('income');
                setIncomeType('extra');
              }}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all ${
                activeType === 'income' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>تسجيل دخل (+وارد)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveType('expense')}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all ${
                activeType === 'expense' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>تسجيل مصروف (-صادر)</span>
            </button>
          </div>

          {/* Income Subtypes (Only show if activeType is income) */}
          {activeType === 'income' && (
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-50 border border-slate-200/60 rounded-xl text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setIncomeType('extra')}
                className={`py-1.5 rounded-lg transition-all ${
                  incomeType === 'extra' ? 'bg-white text-emerald-700 shadow-sm border border-emerald-100 font-black' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                💵 دخل إضافي / مكافأة
              </button>

              <button
                type="button"
                onClick={() => setIncomeType('salary')}
                className={`py-1.5 rounded-lg transition-all ${
                  incomeType === 'salary' ? 'bg-emerald-600 text-white shadow-sm font-black' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                🏢 الراتب الشهري الثابت
              </button>
            </div>
          )}

          {/* Context Notice / Warning */}
          <div>
            {activeType === 'income' && incomeType === 'salary' ? (
              hasDistributedThisMonth ? (
                <div className="p-3.5 rounded-xl text-xs font-bold bg-amber-50 border border-amber-200 text-amber-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>تم استلام وتوزيع راتب هذا الشهر ({currentMonthArabic}) بالفعل. لا يمكن تكراره لتفادي تضخم الحسابات بشكل خاطئ.</span>
                </div>
              ) : (
                <div className="p-3 rounded-xl text-xs font-semibold bg-emerald-50 border border-emerald-100 text-emerald-800">
                  🎯 سيتم أخذ الراتب تلقائياً من الإعدادات وتوزيعه بنسبة 100% على جميع الصناديق دون تدخل منك.
                </div>
              )
            ) : activeType === 'income' && incomeType === 'extra' ? (
              <div className="p-3 rounded-xl text-xs font-bold bg-emerald-50/80 border border-emerald-200/80 text-emerald-900 space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-800 font-extrabold">
                  <span>💵 تسجيل دخل إضافي / مكافأة</span>
                </div>
                <p className="text-[11px] leading-relaxed text-emerald-700 font-medium">
                  حساب بنكي رئيسي واحد + صناديق افتراضية محاسبياً. يمكنك توجيهه لصندوق، توزيعه بنسب الراتب، أو إبقاؤه دون تخصيص.
                </p>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl text-xs font-bold bg-slate-50 border border-slate-200/80 text-slate-600">
                🔴 يخصم هذا المبلغ مباشرة من رصيد الحساب المالي المحدد.
              </div>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">المبلغ (بالريال السعودي)</label>
              <input
                type="number"
                required
                disabled={activeType === 'income' && incomeType === 'salary'}
                min="1"
                step="any"
                placeholder="مثلاً: 500"
                value={amount || ""}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full text-left dir-ltr px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-400"
              />
              {activeType === 'income' && incomeType === 'salary' && (
                <p className="text-[10px] text-slate-400 font-bold mt-1">
                  * الراتب مأخوذ من الإعدادات. يمكنك تعديله من صفحة الإعدادات.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">البيان / مصدر الدخل الإضافي</label>
              <input
                type="text"
                required
                disabled={activeType === 'income' && incomeType === 'salary'}
                placeholder={
                  activeType === 'income' ? 'مثلاً: عمل حر، عمولة، مكافأة أداء، بيع غرض، مشروع مستقل' : 'مثلاً: بنزين أو مقاضي'
                }
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>

            {/* --- SINGLE QUESTION WITH 3 CHOICES FOR EXTRA INCOME --- */}
            {activeType === 'income' && incomeType === 'extra' && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3.5">
                <div className="border-b border-slate-200/60 pb-2">
                  <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <span>❓ كيف تريد استخدام هذا الدخل؟</span>
                  </h4>
                  <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                    اختر واحدة من الطرق الـ 3 المعتمدة للتعامل مع هذا الدخل
                  </p>
                </div>

                {/* 3 Main Choices */}
                <div className="space-y-2">
                  {/* Choice 1: Specific Fund */}
                  <label
                    onClick={() => setExtraAllocationChoice('specific')}
                    className={`p-3 rounded-xl border transition-all flex items-start gap-2.5 cursor-pointer ${
                      extraAllocationChoice === 'specific'
                        ? 'bg-white border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'bg-white/60 border-slate-200 hover:bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="extraAllocationChoice"
                      checked={extraAllocationChoice === 'specific'}
                      onChange={() => setExtraAllocationChoice('specific')}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="flex-1 space-y-1">
                      <div className="font-black text-xs text-slate-900 flex items-center justify-between">
                        <span>1. توجيهه إلى صندوق محدد</span>
                        <span className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-bold">صندوق واحد</span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium">
                        تخصيص كامل المبلغ لأحد الصناديق الأربعة (المعيشة، الديون، الطوارئ، أو الادخار).
                      </p>

                      {/* Sub-selection for 4 funds when Choice 1 is active */}
                      {extraAllocationChoice === 'specific' && (
                        <div className="pt-2 grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSpecificFund('living');
                            }}
                            className={`p-2 rounded-lg text-right border transition-all text-xs font-bold flex flex-col justify-between ${
                              specificFund === 'living'
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <span>🛒 المعيشة</span>
                            <span className={`text-[9px] mt-0.5 ${specificFund === 'living' ? 'text-emerald-100' : 'text-slate-400'}`}>
                              يرفع مخصص المعيشة للشهر الحالي
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSpecificFund('debt');
                            }}
                            className={`p-2 rounded-lg text-right border transition-all text-xs font-bold flex flex-col justify-between ${
                              specificFund === 'debt'
                                ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <span>💳 سداد الديون</span>
                            <span className={`text-[9px] mt-0.5 ${specificFund === 'debt' ? 'text-rose-100' : 'text-slate-400'}`}>
                              تخفيض المديونية القائمة
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSpecificFund('emergency');
                            }}
                            className={`p-2 rounded-lg text-right border transition-all text-xs font-bold flex flex-col justify-between ${
                              specificFund === 'emergency'
                                ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <span>🛡️ صندوق الطوارئ</span>
                            <span className={`text-[9px] mt-0.5 ${specificFund === 'emergency' ? 'text-purple-100' : 'text-slate-400'}`}>
                              تعزيز شبكة الأمان المالي
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSpecificFund('savings');
                            }}
                            className={`p-2 rounded-lg text-right border transition-all text-xs font-bold flex flex-col justify-between ${
                              specificFund === 'savings'
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <span>📈 الادخار والاستثمار</span>
                            <span className={`text-[9px] mt-0.5 ${specificFund === 'savings' ? 'text-blue-100' : 'text-slate-400'}`}>
                              تنمية رأس المال المستقبلي
                            </span>
                          </button>
                        </div>
                      )}

                      {/* If Debt fund selected, show target debt selection */}
                      {extraAllocationChoice === 'specific' && specificFund === 'debt' && (
                        <div className="pt-2">
                          {debts.length > 0 ? (
                            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs space-y-1.5">
                              <label className="block text-[10px] font-bold text-rose-900">اختر الدين المراد تخفيضه:</label>
                              <select
                                value={selectedDebtId || (debts[0]?.id || '')}
                                onChange={(e) => setSelectedDebtId(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-md border border-rose-200 font-bold text-slate-900 bg-white text-xs"
                              >
                                {debts.map(d => (
                                  <option key={d.id} value={d.id}>
                                    {d.name} (المتبقي: {formatCurrency(d.totalAmount - d.paidAmount)})
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <div className="p-2 rounded bg-slate-100 text-[10px] text-slate-600 font-bold">
                              لا توجد ديون مسجلة، سيتم حفظ المبلغ في صندوق سداد الديون.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </label>

                  {/* Choice 2: Proportional Distribution by Salary ratios */}
                  <label
                    onClick={() => setExtraAllocationChoice('salary_split')}
                    className={`p-3 rounded-xl border transition-all flex items-start gap-2.5 cursor-pointer ${
                      extraAllocationChoice === 'salary_split'
                        ? 'bg-white border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'bg-white/60 border-slate-200 hover:bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="extraAllocationChoice"
                      checked={extraAllocationChoice === 'salary_split'}
                      onChange={() => setExtraAllocationChoice('salary_split')}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="flex-1 space-y-1">
                      <div className="font-black text-xs text-slate-900 flex items-center justify-between">
                        <span>2. توزيعه بنفس نسب الراتب</span>
                        <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-bold">توزيع آلي</span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium">
                        توزيع المبلغ تلقائياً: 26% ديون، 16% طوارئ، 12% ادخار، و 46% معيشة (لرفع ميزانية الشهر).
                      </p>

                      {/* Live calculation breakdown */}
                      {extraAllocationChoice === 'salary_split' && (
                        <div className="pt-2">
                          {(() => {
                            const val = parseFloat(amount) || 0;
                            const d = Math.round(val * 0.26);
                            const em = Math.round(val * 0.16);
                            const s = Math.round(val * 0.12);
                            const liv = val - d - em - s;
                            return (
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-2 bg-slate-50 rounded-lg border border-slate-200 text-center text-[10px] font-bold">
                                <div className="p-1 bg-white rounded border border-slate-200">
                                  <span className="text-slate-400 block text-[9px]">ديون (26%)</span>
                                  <span className="text-rose-600 font-black">{formatCurrency(d)}</span>
                                </div>
                                <div className="p-1 bg-white rounded border border-slate-200">
                                  <span className="text-slate-400 block text-[9px]">طوارئ (16%)</span>
                                  <span className="text-purple-600 font-black">{formatCurrency(em)}</span>
                                </div>
                                <div className="p-1 bg-white rounded border border-slate-200">
                                  <span className="text-slate-400 block text-[9px]">ادخار (12%)</span>
                                  <span className="text-blue-600 font-black">{formatCurrency(s)}</span>
                                </div>
                                <div className="p-1 bg-emerald-50 rounded border border-emerald-200">
                                  <span className="text-emerald-700 block text-[9px]">معيشة (46%)</span>
                                  <span className="text-emerald-800 font-black">{formatCurrency(liv)}</span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </label>

                  {/* Choice 3: Unallocated */}
                  <label
                    onClick={() => setExtraAllocationChoice('unallocated')}
                    className={`p-3 rounded-xl border transition-all flex items-start gap-2.5 cursor-pointer ${
                      extraAllocationChoice === 'unallocated'
                        ? 'bg-white border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'bg-white/60 border-slate-200 hover:bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="extraAllocationChoice"
                      checked={extraAllocationChoice === 'unallocated'}
                      onChange={() => setExtraAllocationChoice('unallocated')}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="flex-1 space-y-1">
                      <div className="font-black text-xs text-slate-900 flex items-center justify-between">
                        <span>3. إبقاؤه دون تخصيص</span>
                        <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full font-bold">في الحساب البنكي</span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium">
                        يضاف للرصيد البنكي الرئيسي وصافي الثروة، دون زيادة ميزانية المعيشة أو الصناديق، لتخصيصه لاحقاً.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Account selection for standard expense */}
            {activeType === 'expense' && accounts.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الخصم من الحساب المالي</label>
                <select
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 font-bold bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {accounts.map(a => (
                    <option key={a.id || a.name} value={a.name}>
                      {a.name} ({formatCurrency(a.balance)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {successMsg ? (
              <div className="p-4 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center gap-2">
                <Check className="w-4.5 h-4.5 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting || !amount || (activeType === 'income' && incomeType === 'salary' && hasDistributedThisMonth)}
                className={`w-full py-3 px-6 rounded-2xl text-white font-extrabold transition-colors shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 ${
                  activeType === 'income' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
                }`}
              >
                <Plus className="w-5 h-5" />
                <span>
                  {isSubmitting 
                    ? 'جاري الحفظ والمعالجة...' 
                    : activeType === 'income' && incomeType === 'salary' 
                      ? `تأكيد استلام وتوزيع الراتب (${formatCurrency(salaryAmount)})` 
                      : 'حفظ وتسجيل الحركة الآن'
                  }
                </span>
              </button>
            )}
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
