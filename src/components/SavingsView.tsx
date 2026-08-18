/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SavingsRecord, UserSettings } from '../types';
import { TableView } from './TableView';
import { MetricCard } from './MetricCard';
import { formatCurrency, cn } from '../lib/utils';
import { Plus, Trash2, PiggyBank, ShieldAlert, Wallet, Lock, CheckCircle2 } from 'lucide-react';
import React, { useState } from 'react';
import { addDoc, collection, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

interface SavingsViewProps {
  savings: SavingsRecord[];
  settings?: UserSettings | null;
}

export function SavingsView({ savings, settings }: SavingsViewProps) {
  const salary = settings?.salary || 2500;
  const emergencyAmt = Math.round(salary * 0.16);
  const savingsAmt = Math.round(salary * 0.12);

  const emergencyCapMonths = settings?.emergencyCapMonths || 3;
  const basicExpenses = Math.round(salary * 0.46);
  const emergencyTarget = basicExpenses * emergencyCapMonths;

  const totalSavingsBalance = savings.reduce((acc, curr) => acc + (curr.savingsActual || 0), 0);
  const totalEmergencyBalance = savings.reduce((acc, curr) => acc + (curr.emergencyActual || 0), 0);
  const totalFunds = totalSavingsBalance + totalEmergencyBalance;

  const isEmergencyCapReached = totalEmergencyBalance >= emergencyTarget;
  const emergencyProgressPct = Math.min(100, Math.round((totalEmergencyBalance / (emergencyTarget || 1)) * 100));

  const [isAdding, setIsAdding] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState<string>('1500');
  const [withdrawReason, setWithdrawReason] = useState<string>('حالة طارئة (صيانة سيارة / علاج)');
  const [withdrawSuccessMsg, setWithdrawSuccessMsg] = useState<string | null>(null);

  const [newItem, setNewItem] = useState<Partial<SavingsRecord>>({
    month: new Date().toISOString().slice(0, 7),
    savingsPlanned: savingsAmt,
    savingsActual: savingsAmt,
    emergencyPlanned: emergencyAmt,
    emergencyActual: emergencyAmt
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    
    await addDoc(collection(db, 'savings'), {
      ...newItem,
      userId: auth.currentUser.uid,
    });
    setIsAdding(false);
  };

  const handleEmergencyWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    const amt = parseFloat(withdrawAmount) || 0;
    if (amt <= 0) return;

    // Record emergency withdrawal as negative actual emergency in current month record or a new record
    const currentMonthStr = new Date().toISOString().slice(0, 7);
    await addDoc(collection(db, 'savings'), {
      month: `${currentMonthStr} (سحب طارئ)`,
      savingsPlanned: 0,
      savingsActual: 0,
      emergencyPlanned: 0,
      emergencyActual: -amt,
      userId: auth.currentUser.uid,
    });

    // Also record as expense transaction
    await addDoc(collection(db, 'expenses'), {
      amount: amt,
      category: 'طوارئ',
      description: `سحب طارئ: ${withdrawReason}`,
      paymentMethod: 'صندوق الطوارئ',
      date: new Date().toISOString().split('T')[0],
      userId: auth.currentUser.uid,
    });

    const newRem = Math.max(0, totalEmergencyBalance - amt);
    setWithdrawSuccessMsg(`🚨 تم سحب ${formatCurrency(amt)} يدويًا من صندوق الطوارئ! أصبح رصيد الطوارئ: ${formatCurrency(newRem)}. ويستمر النظام في الاقتطاع الشهري التلقائي (${formatCurrency(emergencyAmt)}) لإعادة بناء الصندوق.`);

    setTimeout(() => {
      setWithdrawSuccessMsg(null);
      setIsWithdrawModalOpen(false);
    }, 2500);
  };

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, 'savings', id));
  };

  return (
    <div className="space-y-6">
      {/* Emergency & Investment Mandatory Rule Banner */}
      <div className="bg-white text-slate-800 rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-50 rounded-full blur-3xl opacity-50 -z-10 pointer-events-none"></div>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-xs font-black flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                المقتطعات الإلزامية للادخار والطوارئ (28%)
              </span>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-black flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                تأمين 3-6 أشهر مصاريف
              </span>
            </div>
            <h3 className="text-2xl font-black text-slate-900">صندوق الطوارئ والادخار / الاستثمار طويل المدى</h3>
            <p className="text-slate-600 text-sm max-w-2xl font-bold leading-relaxed">
              تخصيص شهري إلزامي اقتطاع مباشر: {formatCurrency(emergencyAmt)} لصندوق الطوارئ (16%) لضمان تغطية مصاريف 3-6 أشهر، و {formatCurrency(savingsAmt)} للادخار والاستثمار طويل المدى (12%).
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 flex-shrink-0">
            <div className="bg-purple-50 px-5 py-3 rounded-2xl border border-purple-100 text-center">
              <span className="text-[11px] font-bold text-purple-800 block mb-0.5">صندوق الطوارئ (16%)</span>
              <span className="text-xl font-black text-purple-900">{formatCurrency(emergencyAmt)}</span>
              <span className="text-[10px] text-purple-600 block mt-0.5">حتى 3-6 أشهر</span>
            </div>
            <div className="bg-blue-50 px-5 py-3 rounded-2xl border border-blue-100 text-center">
              <span className="text-[11px] font-bold text-blue-800 block mb-0.5">استثمار طويل (12%)</span>
              <span className="text-xl font-black text-blue-900">{formatCurrency(savingsAmt)}</span>
              <span className="text-[10px] text-blue-600 block mt-0.5">تنمية أصول</span>
            </div>
          </div>
        </div>

        {/* Emergency Cap Shift Banner & Target Progress Bar */}
        <div className="mt-6 p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-bold">
            <span className="text-amber-600 font-black text-sm flex items-center gap-1.5">
              🛡️ هدف صندوق الطوارئ ({emergencyCapMonths} أشهر مصاريف أساسية):
            </span>
            <span className="text-slate-700 font-mono">
              {formatCurrency(totalEmergencyBalance)} / {formatCurrency(emergencyTarget)} ({emergencyProgressPct}%)
            </span>
          </div>

          <div className="w-full h-3 bg-slate-200/50 rounded-full overflow-hidden p-0.5 border border-slate-300/30">
            <div 
              className={cn(
                "h-full rounded-full transition-all duration-500",
                isEmergencyCapReached 
                  ? "bg-emerald-500" 
                  : "bg-purple-500"
              )}
              style={{ width: `${emergencyProgressPct}%` }}
            />
          </div>

          {isEmergencyCapReached ? (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-xs text-emerald-800 font-bold leading-relaxed space-y-1">
              <span className="text-emerald-700 font-black block text-xs">
                🎉 تم اكتفاء صندوق الطوارئ بالكامل!
              </span>
              <p className="text-slate-600 text-[11px]">
                رصيد صندوق الطوارئ الحالي يغطي هدف الأمان المالي المحدد بالكامل ({emergencyCapMonths} أشهر مصاريف معيشية).
              </p>
            </div>
          ) : (
            <div className="text-[11px] text-slate-300 font-medium leading-relaxed">
              💡 <b>ملاحظة:</b> يستهدف صندوق الطوارئ تغطية <b>{formatCurrency(emergencyTarget)}</b> ({emergencyCapMonths} أشهر مصاريف معيشية) لتأمين الأمان المالي الكامل.
            </div>
          )}
        </div>

        {/* Emergency Withdrawal Rule Explanation Box */}
        <div className="mt-6 p-4 rounded-2xl bg-white/10 border border-white/15 text-xs text-purple-100 font-medium leading-relaxed flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-amber-300 font-black text-sm block">🚨 ماذا يحدث إذا وقعت حالة طارئة؟</span>
            <p className="text-slate-200 font-bold">
              لو كان لديك مثلاً <b>6,000 ريال</b> في صندوق الطوارئ وحدث ظرف طارئ بقيمة <b>1,500 ريال</b>:
              يتم سحب الـ 1,500 يدويًا من صندوق الطوارئ ليصبح الرصيد <b>4,500 ريال</b>.
              ثم يستمر النظام في بناء وتغذية الصندوق من جديد تلقائياً بحسب النسبة المحددة (16% شهرياً) دون مساس بالادخار!
            </p>
          </div>
          <button
            onClick={() => setIsWithdrawModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition-all shadow-md shrink-0 active:scale-95"
          >
            🚨 إجراء سحب يدوي لحالة طارئة
          </button>
        </div>
      </div>

      {/* Balances Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard title="رصيد صندوق الادخار" value={totalSavingsBalance} icon={PiggyBank} color="green" />
        <MetricCard title="رصيد صندوق الطوارئ" value={totalEmergencyBalance} icon={ShieldAlert} color="purple" />
        <MetricCard title="إجمالي الأرصدة" value={totalFunds} icon={Wallet} color="blue" />
      </div>

      {isAdding && (
        <div className="bg-white p-8 rounded-3xl border-2 border-blue-100 shadow-xl mb-8">
          <h4 className="text-lg font-bold text-slate-800 mb-6">إضافة سجل ادخار جديد</h4>
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">الشهر</label>
              <input 
                type="month" 
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                value={newItem.month}
                onChange={e => setNewItem({...newItem, month: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">الادخار المخطط</label>
              <input type="number" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" value={newItem.savingsPlanned || ""} onChange={e => setNewItem({...newItem, savingsPlanned: parseFloat(e.target.value)})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">الادخار الفعلي</label>
              <input type="number" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" value={newItem.savingsActual || ""} onChange={e => setNewItem({...newItem, savingsActual: parseFloat(e.target.value)})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">طوارئ مخطط</label>
              <input type="number" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" value={newItem.emergencyPlanned || ""} onChange={e => setNewItem({...newItem, emergencyPlanned: parseFloat(e.target.value)})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">طوارئ فعلي</label>
              <input type="number" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" value={newItem.emergencyActual || ""} onChange={e => setNewItem({...newItem, emergencyActual: parseFloat(e.target.value)})} />
            </div>
            <div className="flex items-end gap-3">
              <button type="submit" className="flex-1 bg-blue-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-blue-700 transition-colors">حفظ</button>
              <button type="button" onClick={() => setIsAdding(false)} className="px-6 py-3 text-slate-500 font-medium hover:bg-slate-100 rounded-xl transition-colors">إلغاء</button>
            </div>
          </form>
        </div>
      )}

      <TableView 
        title="الادخار والطوارئ" 
        description="سجل شهري لمدخراتك وصندوق الطوارئ الخاص بك."
        headers={['الشهر', 'الادخار المخطط', 'الادخار الفعلي', 'طوارئ مخطط', 'طوارئ فعلي', 'الرصيد التراكمي', 'إجراءات']}
        action={
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" />
            <span>إضافة سجل</span>
          </button>
        }
      >
        {savings.map((item, index) => {
          // Accumulative logic would ideally be handled on the fly or in a smarter way
          // For now, just sum up to this point
          const cumulative = savings.slice(0, index + 1).reduce((acc, curr) => 
            acc + curr.savingsActual + curr.emergencyActual, 0
          );
          return (
            <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
              <td className="px-6 py-4 font-bold text-slate-800">{item.month}</td>
              <td className="px-6 py-4 text-slate-500">{formatCurrency(item.savingsPlanned)}</td>
              <td className="px-6 py-4 text-green-600 font-bold">{formatCurrency(item.savingsActual)}</td>
              <td className="px-6 py-4 text-slate-500">{formatCurrency(item.emergencyPlanned)}</td>
              <td className="px-6 py-4 text-purple-600 font-bold">{formatCurrency(item.emergencyActual)}</td>
              <td className="px-6 py-4 font-black text-slate-900">{formatCurrency(cumulative)}</td>
              <td className="px-6 py-4">
                <button onClick={() => handleDelete(item.id!)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              </td>
            </tr>
          );
        })}
      </TableView>

      {/* Emergency Withdrawal Modal */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 text-right space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🚨</span>
                <div>
                  <h3 className="text-base font-black text-slate-900">سحب يدوي من صندوق الطوارئ</h3>
                  <span className="text-xs text-slate-500 font-bold block">استخدام الرصيد عند وقوع ظرف طارئ</span>
                </div>
              </div>
              <button 
                onClick={() => setIsWithdrawModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-black hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 font-bold leading-relaxed">
              💡 <b>مثال سيناريو الطوارئ:</b> لديك 6,000 ريال في الطوارئ وسحبت 1,500 ريال. سيصبح الرصيد 4,500 ريال، وسيواصل النظام تلقائياً إعادة بناء الصندوق بنسبة 16% شهرياً ({formatCurrency(emergencyAmt)})!
            </div>

            <form onSubmit={handleEmergencyWithdraw} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">المبلغ المراد سحبه (ريال)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 text-left dir-ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">سبب / بيان الظرف الطارئ</label>
                <input
                  type="text"
                  required
                  value={withdrawReason}
                  onChange={(e) => setWithdrawReason(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {withdrawSuccessMsg ? (
                <div className="p-3 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-xs text-center">
                  {withdrawSuccessMsg}
                </div>
              ) : (
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs transition-all shadow-md active:scale-95"
                  >
                    تأكيد السحب اليدوي الآن
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsWithdrawModalOpen(false)}
                    className="py-3 px-4 rounded-xl bg-slate-100 text-slate-700 font-extrabold text-xs hover:bg-slate-200 transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
