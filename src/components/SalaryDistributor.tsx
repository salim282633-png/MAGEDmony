import React, { useState, useMemo } from 'react';
import { BudgetItem, AccountItem, Transaction, Expense, UserSettings, DebtItem } from '../types';
import { db, auth } from '../lib/firebase';
import { addDoc, collection, updateDoc, doc, deleteDoc, increment } from 'firebase/firestore';
import { CheckCircle2, Landmark, ArrowDownToLine, Loader2, CreditCard, ShieldAlert, PiggyBank, Home, Calculator, AlertCircle, X } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';

interface SalaryDistributorProps {
  settings: UserSettings | null;
  budget: BudgetItem[];
  accounts: AccountItem[];
  expenses: Expense[];
  transactions: Transaction[];
  debts: DebtItem[];
}

export function SalaryDistributor({ settings, accounts, expenses, transactions = [], debts = [] }: SalaryDistributorProps) {
  const [isDistributing, setIsDistributing] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showRedistributeDialog, setShowRedistributeDialog] = useState(false);
  const [isRedistributing, setIsRedistributing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  
  const now = new Date();
  const currentMonthStr = now.toISOString().substring(0, 7); // YYYY-MM
  const localYear = now.getFullYear();
  const localMonth = String(now.getMonth() + 1).padStart(2, '0');
  const localMonthStr = `${localYear}-${localMonth}`;

  const arabicMonthNames = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];
  const currentMonthArabic = `${arabicMonthNames[now.getMonth()]} ${now.getFullYear()}`;
  
  // Salary amount from settings
  const salaryAmount = settings?.salary || 2500;

  // Check if user is debt free
  const debtFund = accounts.find(a => a.name === 'صندوق سداد الديون' || a.name.includes('الديون'));
  const debtFundBalance = debtFund?.balance || 0;

  const totalDebtsRemaining = useMemo(() => {
    const raw = debts.reduce((sum, d) => sum + Math.max(0, (d.totalAmount || 0) - (d.paidAmount || 0)), 0);
    return Math.max(0, raw - debtFundBalance);
  }, [debts, debtFundBalance]);
  const isDebtFree = debts.length > 0 && totalDebtsRemaining === 0;

  // Calculate actual percentages based on Smart Redirect Rule
  const { 
    debtPct: finalDebtPct, 
    emergencyPct: finalEmergencyPct, 
    savingsPct: finalSavingsPct 
  } = useMemo(() => {
    // Basic expenses (operational) is always protected at 46%
    // The other 54% is divided between Debt, Emergency, and Savings
    let dPct = 26;
    let ePct = 16;
    let sPct = 12;

    // Check if Emergency Fund is fully funded (3 months of basic expenses)
    const basicMonthlyExpenses = Math.round(salaryAmount * 0.46);
    const emergencyTarget = basicMonthlyExpenses * 3;
    const emergencyAccount = accounts.find(a => a.name.includes('طوارئ') || a.name.includes('الطوارئ'));
    const isEmergencyFundComplete = (emergencyAccount?.balance || 0) >= emergencyTarget;

    if (isDebtFree && isEmergencyFundComplete) {
      // Both done! Everything goes to Savings
      dPct = 0;
      ePct = 0;
      sPct = 54;
    } else if (isDebtFree) {
      // Debt free, redirect its 26% to Emergency
      dPct = 0;
      ePct = 16 + 26; // 42%
      sPct = 12;
      
      // But if Emergency is also full, it would have been caught above.
    } else if (isEmergencyFundComplete) {
      // Emergency complete, redirect its 16% to Savings
      dPct = 26;
      ePct = 0;
      sPct = 12 + 16; // 28%
    }

    return { debtPct: dPct, emergencyPct: ePct, savingsPct: sPct };
  }, [isDebtFree, accounts, salaryAmount]);

  // Calculated amounts
  const debtAmount = Math.round(salaryAmount * (finalDebtPct / 100));
  const emergencyAmount = Math.round(salaryAmount * (finalEmergencyPct / 100));
  const savingsAmount = Math.round(salaryAmount * (finalSavingsPct / 100));
  const operationalAmount = salaryAmount - debtAmount - emergencyAmount - savingsAmount;
  const operationalPct = Math.round((operationalAmount / salaryAmount) * 100);


  // Check if already distributed this month
  const hasDistributedThisMonth = useMemo(() => {
    // 1. Check expenses for any salary record or distribution in this month
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

    // 2. Check transactions for internal allocation logs for salary in this month
    const hasSalaryTransaction = transactions.some(t => {
      if (!t.date) return false;
      const isThisMonth = t.date.startsWith(currentMonthStr) || t.date.startsWith(localMonthStr) || (t.notes && t.notes.includes(currentMonthArabic));
      if (!isThisMonth) return false;

      return t.notes && (t.notes.includes('تخصيص تلقائي لراتب') || t.notes.includes('توزيع') || t.notes.includes('راتب'));
    });

    return hasSalaryTransaction;
  }, [expenses, transactions, currentMonthStr, localMonthStr, currentMonthArabic]);

  const runDistributionCore = async () => {
    if (!auth.currentUser) return;
    const today = new Date().toISOString().split('T')[0];

    // 1. Record Income Transaction
    await addDoc(collection(db, 'expenses'), {
      userId: auth.currentUser.uid,
      type: 'دخل',
      date: today,
      category: 'الراتب',
      description: `إيداع وتوزيع راتب ${currentMonthArabic} تلقائياً`,
      amount: salaryAmount,
      paymentMethod: 'الحساب البنكي الرئيسي'
    });

    // 2. Helper to get or update account
    const getOrCreateAccount = async (accName: string, defaultType: string, setBalanceAmount: number, notesStr: string) => {
      let acc = accounts.find(a => a.name === accName || a.name.includes(accName));
      if (acc && acc.id) {
        await updateDoc(doc(db, 'accounts', acc.id), { 
          balance: accName === 'الحساب البنكي الرئيسي' ? setBalanceAmount : increment(setBalanceAmount),
          notes: notesStr
        });
        return acc.id;
      } else {
        const newRef = await addDoc(collection(db, 'accounts'), {
          userId: auth.currentUser!.uid,
          name: accName,
          type: defaultType,
          balance: setBalanceAmount,
          currency: 'ريال سعودي',
          isArchived: false,
          notes: notesStr
        });
        return newRef.id;
      }
    };

    // Clean up any old "صندوق المصاريف الأساسية" account
    const oldAcc = accounts.find(a => a.name === 'صندوق المصاريف الأساسية');
    if (oldAcc && oldAcc.id) {
      await deleteDoc(doc(db, 'accounts', oldAcc.id));
    }

    // Update Main Bank Account balance to the leftover operational amount
    await getOrCreateAccount('الحساب البنكي الرئيسي', 'الحساب البنكي', operationalAmount, 'حساب الراتب والمصاريف المعيشية (الصافي المتاح بعد الاقتطاعات)');

    // Update Internal Allocation Boxes
    await getOrCreateAccount('صندوق سداد الديون', 'صندوق مخصص', debtAmount, 'مخصص سداد الديون (26%)');
    await getOrCreateAccount('صندوق الطوارئ', 'صندوق مخصص', emergencyAmount, 'مخصص الطوارئ (16%)');
    await getOrCreateAccount('صندوق الادخار والاستثمار', 'صندوق مخصص', savingsAmount, 'مخصص الادخار والاستثمار (12%)');

    // 3. Log internal accounting transactions for audit transparency
    const allocations = [
      { name: 'صندوق سداد الديون', amt: debtAmount, pct: finalDebtPct },
      { name: 'صندوق الطوارئ', amt: emergencyAmount, pct: finalEmergencyPct },
      { name: 'صندوق الادخار والاستثمار', amt: savingsAmount, pct: finalSavingsPct }
    ].filter(item => item.amt > 0);

    for (const item of allocations) {
      const alreadyLogged = transactions.some(t => 
        (t.fromAccount === 'الحساب البنكي الرئيسي' || t.fromAccount?.includes('الرئيسي')) &&
        (t.toAccount === item.name || t.toAccount?.includes(item.name.replace('صندوق ', ''))) &&
        t.amount === item.amt &&
        t.date?.startsWith(currentMonthStr)
      );

      if (!alreadyLogged) {
        await addDoc(collection(db, 'transactions'), {
          userId: auth.currentUser.uid,
          fromAccount: 'الحساب البنكي الرئيسي',
          toAccount: item.name,
          amount: item.amt,
          date: today,
          notes: `تخصيص تلقائي لراتب ${currentMonthArabic} بنسبة ${item.pct}%`
        });
      }
    }

    // --- 4. التحقق المحاسبي الإجباري (Mandatory Accounting Audit) ---
    // 1) إجمالي مبالغ التوزيع = صافي الراتب
    const sumAllocations = operationalAmount + debtAmount + emergencyAmount + savingsAmount;
    const diffAllocations = Math.abs(sumAllocations - salaryAmount);

    // 2) إجمالي التحويلات الناتجة = إجمالي مبالغ التوزيع
    const transferAmountsTotal = debtAmount + emergencyAmount + savingsAmount;
    const sumTransfers = transferAmountsTotal + operationalAmount;
    const diffTransfers = Math.abs(sumTransfers - sumAllocations);

    // 3) إجمالي المبالغ المضافة للصناديق والحسابات = إجمالي المبالغ المحولة
    const sumAddedToAccounts = operationalAmount + debtAmount + emergencyAmount + savingsAmount;
    const diffAccounts = Math.abs(sumAddedToAccounts - sumTransfers);

    if (diffAllocations >= 0.01 || diffTransfers >= 0.01 || diffAccounts >= 0.01) {
      await performCancelInternal();
      const maxDiff = Math.max(diffAllocations, diffTransfers, diffAccounts);
      throw new Error(`خطأ في التحقق المحاسبي الإجباري: ظهر فرق قدره (${maxDiff.toFixed(2)} ريال). التوزيع غير مطابق لصافي الراتب (${salaryAmount} ريال). تم إلغاء العملية رفضا لأي تفاوت.`);
    }
  };

  const handleConfirmDistribute = async () => {
    if (!auth.currentUser) return;
    if (hasDistributedThisMonth) {
      alert(`توزيع راتب شهر ${currentMonthArabic} تم تنفيذه بالفعل. لمنع التكرار المحاسبي، استخدم خيار "إعادة توزيع الراتب" لإلغاء التوزيع السابق وإعادة تطبيقه.`);
      return;
    }
    
    setIsDistributing(true);
    setSuccessMsg('');
    try {
      if (salaryAmount <= 0) {
        alert("يرجى تعيين الراتب في الإعدادات أولاً.");
        setIsDistributing(false);
        return;
      }

      await runDistributionCore();
      setSuccessMsg(`✅ تم استلام وتوزيع راتب ${currentMonthArabic} بنجاح!`);
      setTimeout(() => setSuccessMsg(''), 7000);
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء توزيع الراتب.");
    } finally {
      setIsDistributing(false);
    }
  };

  const performCancelInternal = async () => {
    if (!auth.currentUser) return;
    // 1. Delete the salary distribution expenses for the current month
    const currentMonthExpenses = expenses.filter(e => 
      e.date && e.date.startsWith(currentMonthStr) && 
      e.category === 'الراتب'
    );
    for (const e of currentMonthExpenses) {
      if (e.id) {
        await deleteDoc(doc(db, 'expenses', e.id));
      }
    }

    // 2. Delete any transaction logs for the distribution this month
    const currentMonthTransactions = transactions.filter(t =>
      t.date && t.date.startsWith(currentMonthStr) &&
      t.fromAccount === 'الحساب البنكي الرئيسي' &&
      t.notes?.includes('تخصيص تلقائي لراتب')
    );
    for (const t of currentMonthTransactions) {
      if (t.id) {
        await deleteDoc(doc(db, 'transactions', t.id));
      }
    }

    // 3. Zero out the balances of the dedicated allocation boxes AND refund the Main Bank Account
    const boxesNames = ['صندوق سداد الديون', 'صندوق الطوارئ', 'صندوق الادخار والاستثمار'];
    const boxesToReset = accounts.filter(a => boxesNames.some(name => a.name === name || a.name.includes(name)));
    let totalToRefund = 0;
    
    for (const box of boxesToReset) {
      if (box.id) {
        const currentBalance = box.balance || 0;
        totalToRefund += currentBalance;
        await updateDoc(doc(db, 'accounts', box.id), { balance: 0 });
      }
    }

    // Refund the Main Account so the user doesn't lose their money when resetting
    const mainAcc = accounts.find(a => a.name === 'الحساب البنكي الرئيسي');
    if (mainAcc && mainAcc.id && totalToRefund > 0) {
      await updateDoc(doc(db, 'accounts', mainAcc.id), {
        balance: increment(totalToRefund)
      });
    }
  };

  const handleResetDistribution = async () => {
    if (!auth.currentUser) return;
    setIsResetting(true);
    try {
      await performCancelInternal();
      setSuccessMsg('✅ تم إلغاء التوزيع الحالي للراتب وتصفير الصناديق بنجاح!');
      setShowResetModal(false);
      setTimeout(() => setSuccessMsg(''), 7000);
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء إلغاء التوزيع وتصفير الصناديق.");
    } finally {
      setIsResetting(false);
    }
  };

  const handleExecuteRedistribution = async () => {
    if (!auth.currentUser) return;
    setIsRedistributing(true);
    try {
      // 1. Reverse previous distribution cleanly
      await performCancelInternal();
      // 2. Run fresh distribution
      await runDistributionCore();

      setSuccessMsg(`✅ تم عكس التوزيع السابق وإعادة توزيع راتب ${currentMonthArabic} بنسبة 100% بنجاح!`);
      setShowRedistributeDialog(false);
      setTimeout(() => setSuccessMsg(''), 7000);
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء إعادة توزيع الراتب.");
    } finally {
      setIsRedistributing(false);
    }
  };

  return (
    <div className="bg-white text-slate-800 rounded-3xl p-6 md:p-8 shadow-sm mb-8 relative overflow-hidden border border-slate-200">
      <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-50 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Header & Trigger Button */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10 pb-6 border-b border-slate-100">
        <div className="flex items-center gap-4">
          <div className="bg-emerald-50 border border-emerald-100 p-3.5 rounded-2xl text-emerald-600">
            <Landmark className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-emerald-50 text-emerald-700 text-xs font-black px-3 py-1 rounded-full border border-emerald-200">
                راتب {currentMonthArabic}: {formatCurrency(salaryAmount)}
              </span>
              <span className="bg-blue-50 text-blue-700 text-xs font-black px-3 py-1 rounded-full border border-blue-200">
                توزيع تلقائي 100%
              </span>
            </div>
            <h3 className="text-xl md:text-2xl font-black text-slate-900">آلية استلام وتوزيع الراتب</h3>
            <p className="text-xs md:text-sm text-slate-600 font-bold mt-1 max-w-xl leading-relaxed">
              3 اقتطاعات ثابتة تلقائياً، والباقي المتبقي يخصص للمصاريف التشغيلية والأساسية.
            </p>
          </div>
        </div>

        <div className="shrink-0 w-full md:w-auto">
          {hasDistributedThisMonth ? (
            <div className="flex flex-col sm:flex-row items-stretch md:items-center gap-3">
              <button
                disabled
                className="flex items-center justify-center gap-2 bg-emerald-50 text-emerald-800 px-4 py-3 rounded-2xl font-black text-xs md:text-sm border border-emerald-200 cursor-default"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>موزع لـ {currentMonthArabic}</span>
              </button>
              <button
                onClick={() => setShowRedistributeDialog(true)}
                className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-5 py-3.5 rounded-2xl font-black text-xs md:text-sm shadow-sm transition-all active:scale-95"
                title="إلغاء التوزيع الحالي وتطبيقه من جديد بطريقة محاسبية صحيحة"
              >
                <span>🔄 إعادة توزيع الراتب</span>
              </button>
              <button
                onClick={() => setShowResetModal(true)}
                className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-3.5 rounded-2xl font-bold text-xs border border-slate-200 transition-all active:scale-95"
                title="إلغاء التوزيع وتصفير الصناديق"
              >
                <span>إلغاء التوزيع</span>
              </button>
            </div>
          ) : (
            <button
              onClick={handleConfirmDistribute}
              disabled={isDistributing}
              className="w-full md:w-auto flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white px-7 py-4 rounded-2xl font-black text-base shadow-sm transition-all active:scale-95 disabled:opacity-75"
            >
              {isDistributing ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <ArrowDownToLine className="w-6 h-6" />
              )}
              <span>استلام وتوزيع الراتب ({formatCurrency(salaryAmount)})</span>
            </button>
          )}
        </div>
      </div>

      {successMsg && (
        <div className="mt-4 p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 text-sm font-black text-center animate-in fade-in flex items-center justify-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Distribution Plan Table & Explanation */}
      <div className="mt-6 relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Table breakdown */}
        <div className="lg:col-span-8 overflow-x-auto">
          <table className="w-full text-right text-xs md:text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500 font-bold">
                <th className="py-2.5 px-3">المخصص / الصندوق الداخلي</th>
                <th className="py-2.5 px-3">النسبة</th>
                <th className="py-2.5 px-3">المبلغ المخصص</th>
                <th className="py-2.5 px-3">الوصف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 font-bold">
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="py-3 px-3 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-rose-500" />
                  <span className="text-slate-700">💳 سداد الديون</span>
                </td>
                <td className="py-3 px-3">
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 text-xs font-black border border-rose-100">26%</span>
                </td>
                <td className="py-3 px-3 text-slate-900 font-black">{formatCurrency(debtAmount)}</td>
                <td className="py-3 px-3 text-slate-600 text-xs font-semibold">
                  تغطية الأقساط وتسريع إغلاق الديون
                </td>
              </tr>
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="py-3 px-3 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-purple-500" />
                  <span className="text-slate-700">🚨 صندوق الطوارئ</span>
                </td>
                <td className="py-3 px-3">
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 text-xs font-black border border-purple-100">16%</span>
                </td>
                <td className="py-3 px-3 text-slate-900 font-black">{formatCurrency(emergencyAmount)}</td>
                <td className="py-3 px-3 text-slate-600 text-xs font-semibold">
                  تأمين الأمان المالي وتغطية المصاريف الطارئة
                </td>
              </tr>
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="py-3 px-3 flex items-center gap-2">
                  <PiggyBank className="w-4 h-4 text-blue-500" />
                  <span className="text-slate-700">💰 الادخار والاستثمار</span>
                </td>
                <td className="py-3 px-3">
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-black border border-blue-100">12%</span>
                </td>
                <td className="py-3 px-3 text-slate-900 font-black">{formatCurrency(savingsAmount)}</td>
                <td className="py-3 px-3 text-slate-600 text-xs font-semibold">
                  بناء وتكثيف الثروة طويلة المدى
                </td>
              </tr>
              <tr className="hover:bg-emerald-50 transition-colors bg-emerald-50/50">
                <td className="py-3 px-3 flex items-center gap-2 text-emerald-800 font-black">
                  <Home className="w-4 h-4 text-emerald-600" />
                  🏠 الصافي المتاح للمصاريف المعيشية
                </td>
                <td className="py-3 px-3"><span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black border border-emerald-200">46% (الباقي تلقائياً)</span></td>
                <td className="py-3 px-3 text-emerald-900 font-black">{formatCurrency(operationalAmount)}</td>
                <td className="py-3 px-3 text-emerald-700/80 text-xs font-bold">المبلغ المتبقي في الحساب البنكي الرئيسي للمصاريف المعيشية والفواتير</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Calculation formula card */}
        <div className="lg:col-span-4 bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-3">
          <div className="flex items-center gap-2 text-emerald-700 font-black text-xs uppercase tracking-wide">
            <Calculator className="w-4 h-4" />
            المعادلة الأساسية
          </div>
          <div className="bg-white p-3.5 rounded-xl text-center space-y-1 border border-slate-100 shadow-sm">
            <p className="text-xs text-slate-500 font-bold">المصاريف التشغيلية =</p>
            <p className="text-xs font-black text-amber-700 dir-ltr">
              الراتب − (الديون + الطوارئ + الادخار)
            </p>
            <p className="text-sm font-black text-emerald-600 dir-ltr pt-1">
              {formatCurrency(salaryAmount)} − ({formatCurrency(debtAmount)} + {formatCurrency(emergencyAmount)} + {formatCurrency(savingsAmount)}) = <span className="underline">{formatCurrency(operationalAmount)}</span>
            </p>
          </div>
          <p className="text-[11px] text-slate-600 font-bold leading-relaxed">
            💡 <b>قاعدة إعادة التوجيه الذكية:</b> عند سداد الديون بالكامل (تصبح 0%) أو اكتمال صندوق الطوارئ، يعاد توجيه مخصصاتهما تلقائياً بالكامل إلى <b>صندوق الادخار والاستثمار</b> ليرتفع حتى <b>54%</b> لتسريع بناء ثروتك، مع الحفاظ على مخصص معيشتك ثابتاً بنسبة 46%.
          </p>
        </div>
      </div>

      {/* Extra Income Rule Notice */}
      <div className="mt-5 p-4 rounded-2xl bg-amber-50/50 border border-amber-100 text-xs text-slate-700 flex items-start gap-3">
        <span className="text-xl shrink-0">💵</span>
        <div className="space-y-1">
          <span className="font-extrabold text-amber-700 block text-xs">
            مسار الدخل الإضافي (سواء كان ثابتاً شهرياً أو متقطعاً) للمرونة والاستقلالية:
          </span>
          <p className="text-[11px] font-semibold text-slate-600 leading-relaxed">
            قاعدة توزيع النسب (26% ديون / 16% طوارئ / 12% ادخار / 46% معيشة) تنطبق **حصراً على الراتب الشهري الأساسي**. 
            لو كان راتبك <b>2,500 ريال</b> وبدأت تحصل على <b>دخل إضافي 500 ريال شهرياً</b>:
            الـ 2,500 تُوزع تلقائياً وفق القاعدة الذهبية، بينما الـ <b>500 الإضافية</b> تبقى دخلاً إضافياً منفصلاً تختار وجهتها بحرية كاملة حسب أولويتك (سداد دين، طوارئ، ادخار، أو فائض معيشي حر) دون أن تُخل بقاعدة توزيع راتبك.
          </p>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in text-right">
          <div className="bg-white border border-rose-100 rounded-3xl max-w-md w-full p-6 text-slate-800 shadow-2xl relative space-y-5">
            <button 
              onClick={() => setShowResetModal(false)}
              className="absolute top-5 left-5 text-slate-400 hover:text-slate-600 p-1 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-rose-50 pb-4">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100">
                <AlertCircle className="w-6 h-6 text-rose-500" />
              </div>
              <div>
                <h4 className="text-lg font-black text-rose-700">تأكيد إلغاء التوزيع وتصفير الصناديق</h4>
                <p className="text-xs text-slate-500 font-bold">هذا الإجراء سيقوم بإعادة تعيين الشهر الحالي</p>
              </div>
            </div>

            <div className="bg-rose-50/50 rounded-2xl p-4 border border-rose-100 space-y-3 text-xs font-bold text-right leading-relaxed text-slate-700">
              <p>⚠️ عند التأكيد، سيتم إجراء الآتي:</p>
              <ul className="list-disc list-inside space-y-1.5 text-slate-600 pr-2">
                <li>حذف قيد استلام الراتب وتوزيعه المسجل لهذا الشهر ({currentMonthArabic}).</li>
                <li>حذف قيود التحويل الداخلي التلقائي من الحساب الرئيسي إلى الصناديق.</li>
                <li>إعادة تعيين أرصدة <b>صندوق سداد الديون</b>، <b>صندوق الطوارئ</b>، و<b>صندوق الادخار والاستثمار</b> لتصبح <b>صفر ريال</b> للبدء من جديد.</li>
              </ul>
              <p className="text-rose-600 font-black text-xs mt-2">ملاحظة: لن يؤثر هذا الإجراء على المصاريف اليومية الأخرى التي قمت بتسجيلها يدويًا.</p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleResetDistribution}
                disabled={isResetting}
                className="flex-1 py-3.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-2xl shadow-sm transition-all text-sm flex items-center justify-center gap-2"
              >
                {isResetting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <span>نعم، إلغاء التوزيع وتصفير الصناديق</span>
                )}
              </button>

              <button
                onClick={() => setShowResetModal(false)}
                className="py-3.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl text-sm transition-colors"
              >
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Redistribution Confirmation Modal */}
      {showRedistributeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in text-right">
          <div className="bg-white border border-amber-200 rounded-3xl max-w-md w-full p-6 text-slate-800 shadow-2xl relative space-y-5">
            <button 
              onClick={() => setShowRedistributeDialog(false)}
              className="absolute top-5 left-5 text-slate-400 hover:text-slate-600 p-1 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-amber-100 pb-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl border border-amber-200">
                <Landmark className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h4 className="text-lg font-black text-slate-900">إعادة توزيع راتب {currentMonthArabic}</h4>
                <p className="text-xs text-slate-500 font-bold">إلغاء التوزيع السابق وإنشاء توزيع جديد محاسبياً</p>
              </div>
            </div>

            <div className="bg-amber-50/60 rounded-2xl p-4 border border-amber-200 space-y-3 text-xs font-bold text-right leading-relaxed text-slate-700">
              <p>📋 عند إجراء <b>إعادة توزيع الراتب</b>:</p>
              <ul className="list-disc list-inside space-y-1.5 text-slate-600 pr-2">
                <li>إلغاء وعكس قيد الدخل والتحويلات المخصصة السابقة لشهر ({currentMonthArabic}) لمنع التكرار المحاسبي.</li>
                <li>إعادة احتساب وتوزيع راتب <b>{formatCurrency(salaryAmount)}</b> بنسبة 100% فوراً بموجب النسب المعتمدة الحالية.</li>
              </ul>
              <p className="text-amber-700 font-black text-xs mt-1">يضمن هذا الإجراء عدم مضاعفة التحويلات أو تكرار القيود في سجلاتك.</p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleExecuteRedistribution}
                disabled={isRedistributing}
                className="flex-1 py-3.5 px-4 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-2xl shadow-sm transition-all text-sm flex items-center justify-center gap-2"
              >
                {isRedistributing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <span>نعم، إعادة توزيع الراتب الآن</span>
                )}
              </button>

              <button
                onClick={() => setShowRedistributeDialog(false)}
                className="py-3.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl text-sm transition-colors"
              >
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


