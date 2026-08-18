/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DebtItem, UserSettings, AccountItem } from '../types';
import { TableView } from './TableView';
import { formatCurrency, cn } from '../lib/utils';
import { Plus, Trash2, CheckCircle2, Clock, Landmark, Wallet, ShieldAlert } from 'lucide-react';
import React, { useState } from 'react';
import { addDoc, collection, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { motion } from 'motion/react';
import { MetricCard } from './MetricCard';

interface DebtViewProps {
  debts: DebtItem[];
  settings?: UserSettings | null;
  accounts: AccountItem[];
}

export function DebtView({ debts, settings, accounts }: DebtViewProps) {
  const salary = settings?.salary || 2500;
  const debtDeduction = Math.round(salary * 0.26);

  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState<Partial<DebtItem>>({
    name: '',
    totalAmount: 0,
    paidAmount: 0,
    status: 'قيد الانتظار',
    dueDate: new Date().toISOString().split('T')[0]
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    
    await addDoc(collection(db, 'debts'), {
      ...newItem,
      userId: auth.currentUser.uid,
    });
    setNewItem({ name: '', totalAmount: 0, paidAmount: 0, status: 'قيد الانتظار', dueDate: new Date().toISOString().split('T')[0] });
    setIsAdding(false);
  };

  const [payingDebtId, setPayingDebtId] = useState<string | null>(null);
  const [payAmountInput, setPayAmountInput] = useState<string>('');

  const handleUpdatePaidSubmit = async (id: string, currentPaid: number, total: number) => {
    const paid = parseFloat(payAmountInput);
    if (isNaN(paid) || paid <= 0) return;

    const newPaid = Math.min(currentPaid + paid, total);
    const newStatus = newPaid === total ? 'تم' : 'قيد الانتظار';
    
    await updateDoc(doc(db, 'debts', id), {
      paidAmount: newPaid,
      status: newStatus
    });

    // Also deduct from the "صندوق سداد الديون" account if it exists
    const debtAcc = accounts.find(a => a.name === 'صندوق سداد الديون' || a.name.includes('الديون'));
    if (debtAcc && debtAcc.id) {
      await updateDoc(doc(db, 'accounts', debtAcc.id), {
        balance: (debtAcc.balance || 0) - paid
      });
    }

    setPayingDebtId(null);
    setPayAmountInput('');
  };

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, 'debts', id));
  };

  const debtFund = accounts.find(a => a.name === 'صندوق سداد الديون' || a.name.includes('الديون'));
  const debtFundBalance = debtFund?.balance || 0;
  
  const totalDebt = debts.reduce((sum, d) => sum + (d.totalAmount || 0), 0);
  const totalPaid = debts.reduce((sum, d) => sum + (d.paidAmount || 0), 0);
  const totalRemaining = Math.max(0, totalDebt - totalPaid - debtFundBalance);

  const completedDebts = debts.filter(d => d.status === 'تم' || d.paidAmount >= d.totalAmount);
  const activeDebts = debts.filter(d => (d.totalAmount - d.paidAmount) > 0);
  // Sort active debts by remaining amount ascending (classic Snowball method: smallest debt first)
  const sortedActiveDebts = [...activeDebts].sort((a, b) => (a.totalAmount - a.paidAmount) - (b.totalAmount - b.paidAmount));
  const nextTargetDebt = sortedActiveDebts[0];

  const [snowballSuccessMsg, setSnowballSuccessMsg] = useState<string | null>(null);

  const handleApplySnowball = async (targetDebtId: string, amount: number) => {
    const target = debts.find(d => d.id === targetDebtId);
    if (!target || !target.id) return;
    const currentPaid = target.paidAmount || 0;
    const newPaid = Math.min(target.totalAmount, currentPaid + amount);
    const newStatus = newPaid >= target.totalAmount ? 'تم' : 'قيد الانتظار';

    await updateDoc(doc(db, 'debts', target.id), {
      paidAmount: newPaid,
      status: newStatus
    });

    // Deduct from the "صندوق سداد الديون" account
    const debtAcc = accounts.find(a => a.name === 'صندوق سداد الديون' || a.name.includes('الديون'));
    if (debtAcc && debtAcc.id) {
      await updateDoc(doc(db, 'accounts', debtAcc.id), {
        balance: (debtAcc.balance || 0) - amount
      });
    }

    setSnowballSuccessMsg(`🎉 تم تطبيق استراتيجية كرة الثلج (Snowball)! تحويل ${formatCurrency(amount)} لسداد ${target.name}. المتبقي منها الآن: ${formatCurrency(target.totalAmount - newPaid)} ريال فقط!`);
    setTimeout(() => setSnowballSuccessMsg(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="رصيد صندوق الديون" value={debtFundBalance} icon={Landmark} color="blue" subtext="مخصص السداد التلقائي" />
        <MetricCard title="إجمالي الديون القائمة" value={totalDebt} icon={ShieldAlert} color="red" />
        <MetricCard title="إجمالي المسدد" value={totalPaid} icon={CheckCircle2} color="green" />
        <MetricCard title="المتبقي للسداد" value={totalRemaining} icon={Clock} color="orange" />
      </div>

      {/* Mandatory Debt Payoff Plan Banner */}
      <div className="bg-white text-slate-800 rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-50 rounded-full blur-3xl opacity-50 -z-10 pointer-events-none"></div>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-xs font-black flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                سداد الديون (أسرع تخلص ممكن)
              </span>
              <span className="px-3 py-1 bg-slate-50 text-slate-600 border border-slate-200 rounded-full text-xs font-black flex items-center gap-1.5">
                26% مقتطع إلزامي
              </span>
            </div>
            <h3 className="text-2xl font-black text-slate-900">خطة التسريع لسداد الديون – {formatCurrency(debtDeduction)} شهرياً</h3>
            <p className="text-slate-600 text-sm max-w-2xl font-bold leading-relaxed">
              اقتطاع مخصص إلزامي شهري بـ {formatCurrency(debtDeduction)} (26% من الراتب {formatCurrency(salary)}) موجه لتسديد الدين الإجمالي بأعلى كفاءة وأسرع وتيرة زمنية ممكنة.
            </p>
          </div>
          <div className="bg-rose-50 px-6 py-4 rounded-2xl border border-rose-100 text-center flex-shrink-0">
            <span className="text-xs font-bold text-rose-700 block mb-1">المقتطع الشهري لسداد الدين</span>
            <span className="text-3xl font-black text-rose-800">{formatCurrency(debtDeduction)}</span>
            <span className="text-[11px] text-rose-600 font-bold block mt-1">26% من الراتب المباشر ({formatCurrency(salary)})</span>
          </div>
        </div>
      </div>

      {/* Debt Acceleration Snowball Recommendation Banner */}
      {completedDebts.length > 0 && nextTargetDebt ? (
        <div className="p-6 rounded-3xl bg-amber-50 border border-amber-200 text-slate-900 space-y-3 shadow-sm animate-in fade-in">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="text-3xl shrink-0">🚀</span>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900 font-black text-[11px]">
                    كرة الثلج لتسريع السداد (Debt Snowball)
                  </span>
                  <span className="text-xs font-black text-amber-700">
                    تم إغلاق {completedDebts.length} دين/ديون بنجاح! 🎉
                  </span>
                </div>
                <p className="text-xs font-extrabold text-slate-700 leading-relaxed">
                  توصية النظام الذكية: بدلاً من تقليل القسط المقتطع بعد إغلاق الديون السابقة، توجّه القيمة المتفرغة فوراً لإضافتها على قسط <b className="text-red-700 font-black">[{nextTargetDebt.name}]</b> (المتبقي: {formatCurrency(nextTargetDebt.totalAmount - nextTargetDebt.paidAmount)}). هذا يسرّع القضاء عليه في أسرع وقت قياسي!
                </p>
              </div>
            </div>
            <button
              onClick={() => handleApplySnowball(nextTargetDebt.id!, Math.min(debtDeduction, nextTargetDebt.totalAmount - nextTargetDebt.paidAmount))}
              className="px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition-all shadow-md shrink-0 active:scale-95 flex items-center gap-1.5"
            >
              🎯 توجيه {formatCurrency(debtDeduction)} لسداد [{nextTargetDebt.name}] الآن
            </button>
          </div>
          {snowballSuccessMsg && (
            <div className="p-3 rounded-xl bg-emerald-100 text-emerald-900 font-black text-xs text-center border border-emerald-300">
              {snowballSuccessMsg}
            </div>
          )}
        </div>
      ) : activeDebts.length > 0 ? (
        <div className="p-4 rounded-2xl bg-slate-900 text-slate-100 text-xs font-medium leading-relaxed border border-slate-800 flex items-center gap-3">
          <span className="text-xl shrink-0">💡</span>
          <div>
            <b className="text-amber-400 font-black">منهجية كرة الثلج (Debt Snowball):</b> يتم ترتيب الديون من الأصغر حجماً إلى الأكبر. عند تسديد أي دين بالكامل، يُعاد توجيه قسطه فوراً إلى الدين التالي لتزداد سرعة وقوة السداد تدريجياً ككرة الثلج!
          </div>
        </div>
      ) : (
        <div className="p-5 rounded-3xl bg-emerald-500/10 border-2 border-emerald-500/30 text-emerald-950 text-xs font-black leading-relaxed text-center flex flex-col items-center gap-2">
          <span className="text-3xl">🎉</span>
          <span>تهانينا الحرارة! أنت الآن خالي تماماً من الديون (Debt-Free)!</span>
          <span className="text-slate-600 font-bold text-[11px]">
            وفق الشلال المالي للقاعدة الذهبية، يتم توجيه الـ 26% الخاصة بالديون تلقائياً لتعزيز صندوق الادخار والاستثمار أو الطوارئ!
          </span>
        </div>
      )}
      {isAdding && (
        <div className="bg-white p-8 rounded-3xl border-2 border-blue-100 shadow-xl mb-8">
          <h4 className="text-lg font-bold text-slate-800 mb-6">إضافة دين جديد</h4>
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">جهة الدين</label>
              <input 
                type="text" 
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="مثلاً: البنك، شخص، بطاقة ائتمان..."
                value={newItem.name}
                onChange={e => setNewItem({...newItem, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">المبلغ الإجمالي</label>
              <input 
                type="number" 
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                value={newItem.totalAmount}
                onChange={e => setNewItem({...newItem, totalAmount: parseFloat(e.target.value)})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">تاريخ السداد المتوقع</label>
              <input 
                type="date" 
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                value={newItem.dueDate}
                onChange={e => setNewItem({...newItem, dueDate: e.target.value})}
              />
            </div>
            <div className="flex items-end gap-3">
              <button type="submit" className="flex-1 bg-blue-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-blue-700 transition-colors">حفظ</button>
              <button type="button" onClick={() => setIsAdding(false)} className="px-6 py-3 text-slate-500 font-medium hover:bg-slate-100 rounded-xl transition-colors">إلغاء</button>
            </div>
          </form>
        </div>
      )}

      <TableView 
        title="سجل الديون" 
        description="تتبع المبالغ المستحقة والتقدم المحرز في السداد."
        headers={['جهة الدين', 'المبلغ الإجمالي', 'المسدد', 'المتبقي', 'نسبة الإنجاز', 'تاريخ السداد', 'الحالة', 'إجراءات']}
        action={
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" />
            <span>إضافة دين</span>
          </button>
        }
      >
        {debts.map((item) => {
          const remaining = item.totalAmount - item.paidAmount;
          const progress = (item.paidAmount / item.totalAmount) * 100;
          return (
            <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
              <td className="px-6 py-4 font-bold text-slate-800">{item.name}</td>
              <td className="px-6 py-4 text-slate-600 font-medium">{formatCurrency(item.totalAmount)}</td>
              <td className="px-6 py-4 text-green-600 font-bold">{formatCurrency(item.paidAmount)}</td>
              <td className="px-6 py-4 text-orange-600 font-bold">{formatCurrency(remaining)}</td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden min-w-[60px]">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="text-xs font-bold text-slate-500">{progress.toFixed(0)}%</span>
                </div>
              </td>
              <td className="px-6 py-4 text-slate-400 text-sm">{item.dueDate || '-'}</td>
              <td className="px-6 py-4">
                <span className={cn(
                  "px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit",
                  item.status === 'تم' ? "bg-green-50 text-green-600" : 
                  item.status === 'متأخر' ? "bg-red-50 text-red-600" : "bg-orange-50 text-orange-600"
                )}>
                  {item.status === 'تم' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                  {item.status}
                </span>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  {payingDebtId === item.id ? (
                    <div className="flex items-center gap-1">
                      <input 
                        type="number" 
                        placeholder="المبلغ" 
                        value={payAmountInput}
                        onChange={(e) => setPayAmountInput(e.target.value)}
                        className="w-20 px-2 py-1 text-xs border border-blue-300 rounded focus:outline-none"
                      />
                      <button
                        onClick={() => handleUpdatePaidSubmit(item.id!, item.paidAmount, item.totalAmount)}
                        className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-bold"
                      >
                        سداد
                      </button>
                      <button
                        onClick={() => setPayingDebtId(null)}
                        className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-xs font-bold"
                      >
                        إلغاء
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => { setPayingDebtId(item.id!); setPayAmountInput(''); }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      title="تسجيل دفعة"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => handleDelete(item.id!)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="حذف الدين">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </TableView>
    </div>
  );
}
