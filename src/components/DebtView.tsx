/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DebtItem, UserSettings, AccountItem } from '../types';
import { TableView } from './TableView';
import { formatCurrency, cn } from '../lib/utils';
import { Plus, Trash2, CheckCircle2, Clock, Landmark, Wallet, ShieldAlert, Sparkles, Check } from 'lucide-react';
import React, { useState } from 'react';
import { addDoc, collection, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { motion } from 'motion/react';
import { MetricCard } from './MetricCard';
import { useFinanceData } from '../lib/useFinanceData';
import { useToast } from '../lib/toast';

interface DebtViewProps {
  debts: DebtItem[];
  settings?: UserSettings | null;
  accounts: AccountItem[];
}

export function DebtView({ debts, settings, accounts }: DebtViewProps) {
  const toast = useToast();
  const { payDebtPart } = useFinanceData();
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
    if (!newItem.name || !newItem.totalAmount) {
      toast.warning('يرجى كتابة اسم جهة الدين والمبلغ الإجمالي');
      return;
    }
    
    try {
      await addDoc(collection(db, 'debts'), {
        ...newItem,
        userId: auth.currentUser.uid,
      });
      toast.success('تمت إضافة الدين بنجاح', `تم تسجيل ${newItem.name} بمبلغ ${formatCurrency(newItem.totalAmount)}`);
      setNewItem({ name: '', totalAmount: 0, paidAmount: 0, status: 'قيد الانتظار', dueDate: new Date().toISOString().split('T')[0] });
      setIsAdding(false);
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء إضافة الدين');
    }
  };

  const [payingDebtId, setPayingDebtId] = useState<string | null>(null);
  const [payAmountInput, setPayAmountInput] = useState<string>('');

  const handleUpdatePaidSubmit = async (id: string, currentPaid: number, total: number) => {
    const paid = parseFloat(payAmountInput);
    if (isNaN(paid) || paid <= 0) {
      toast.warning('يرجى إدخال مبلغ سداد صحيح');
      return;
    }

    try {
      await payDebtPart(id, paid);
      toast.success('تم تسجيل دفعة السداد بنجاح', `تم سداد ${formatCurrency(paid)}`);
      setPayingDebtId(null);
      setPayAmountInput('');
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء تسجيل الدفعة');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'debts', id));
      toast.success('تم حذف سجل الدين بنجاح');
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء حذف الدين');
    }
  };

  const debtFund = accounts.find(a => a.name === 'صندوق سداد الديون' || a.name.includes('الديون'));
  const debtFundBalance = debtFund?.balance || 0;
  
  const totalDebt = debts.reduce((sum, d) => sum + (d.totalAmount || 0), 0);
  const totalPaid = debts.reduce((sum, d) => sum + (d.paidAmount || 0), 0);
  const totalRemaining = Math.max(0, totalDebt - totalPaid - debtFundBalance);

  const completedDebts = debts.filter(d => d.status === 'تم' || d.paidAmount >= d.totalAmount);
  const activeDebts = debts.filter(d => (d.totalAmount - d.paidAmount) > 0);
  const sortedActiveDebts = [...activeDebts].sort((a, b) => (a.totalAmount - a.paidAmount) - (b.totalAmount - b.paidAmount));
  const nextTargetDebt = sortedActiveDebts[0];

  const handleApplySnowball = async (targetDebtId: string, amount: number) => {
    const target = debts.find(d => d.id === targetDebtId);
    if (!target || !target.id) return;
    
    try {
      await payDebtPart(target.id, amount);
      toast.success(
        '🎉 تم تطبيق استراتيجية كرة الثلج (Snowball)',
        `تم تحويل ${formatCurrency(amount)} لسداد ${target.name}`
      );
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء تطبيق كرة الثلج');
    }
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
      <div className="bg-white text-slate-800 rounded-3xl p-6 md:p-8 shadow-xs border border-slate-200 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-xs font-black flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                سداد الديون (أسرع وتيرة)
              </span>
              <span className="px-3 py-1 bg-slate-50 text-slate-600 border border-slate-200 rounded-full text-xs font-black flex items-center gap-1.5">
                26% مقتطع إلزامي
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900">خطة التسريع لسداد الديون – {formatCurrency(debtDeduction)} شهرياً</h3>
            <p className="text-slate-600 text-xs sm:text-sm max-w-2xl font-bold leading-relaxed">
              اقتطاع مخصص إلزامي شهري بـ {formatCurrency(debtDeduction)} (26% من الراتب {formatCurrency(salary)}) موجه لتسديد الدين الإجمالي بأعلى كفاءة وأسرع وتيرة زمنية ممكنة.
            </p>
          </div>
          <div className="bg-rose-50 px-6 py-4 rounded-2xl border border-rose-100 text-center flex-shrink-0">
            <span className="text-xs font-bold text-rose-700 block mb-1">المقتطع الشهري لسداد الدين</span>
            <span className="text-2xl sm:text-3xl font-black text-rose-800">{formatCurrency(debtDeduction)}</span>
            <span className="text-[11px] text-rose-600 font-bold block mt-1">26% من الراتب المباشر ({formatCurrency(salary)})</span>
          </div>
        </div>
      </div>

      {/* Debt Acceleration Snowball Recommendation Banner */}
      {completedDebts.length > 0 && nextTargetDebt && (
        <div className="p-6 rounded-3xl bg-amber-50 border border-amber-200 text-slate-900 space-y-3 shadow-xs">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="text-3xl shrink-0">🚀</span>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900 font-black text-[11px]">
                    كرة الثلج لتسريع السداد (Debt Snowball)
                  </span>
                  <span className="text-xs font-black text-amber-700">
                    تم إغلاق {completedDebts.length} دين/ديون بنجاح!
                  </span>
                </div>
                <p className="text-xs text-slate-700 font-bold max-w-xl">
                  توصية مالية ذكية: توجيه مبالغ الأقساط المنتهية مباشرة نحو الدين النشط الأصغر القادم ({nextTargetDebt.name}) لتسديده فوراً.
                </p>
              </div>
            </div>

            {debtFundBalance > 0 && (
              <button
                onClick={() => handleApplySnowball(nextTargetDebt.id!, Math.min(debtFundBalance, (nextTargetDebt.totalAmount - nextTargetDebt.paidAmount)))}
                className="px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-black text-xs shadow-md transition-all cursor-pointer shrink-0"
              >
                تطبيق كرة الثلج على ({nextTargetDebt.name})
              </button>
            )}
          </div>
        </div>
      )}

      {isAdding && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-lg mb-6">
          <h4 className="text-base sm:text-lg font-black text-slate-900 mb-4">إضافة التزام أو دين جديد</h4>
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">اسم جهة الدين</label>
              <input 
                type="text" 
                required 
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-bold" 
                placeholder="مثلاً: قرض بنكي أو شخصي"
                value={newItem.name} 
                onChange={e => setNewItem({...newItem, name: e.target.value})} 
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">المبلغ الإجمالي (ريال)</label>
              <input 
                type="number" 
                required 
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-black" 
                value={newItem.totalAmount || ""} 
                onChange={e => setNewItem({...newItem, totalAmount: parseFloat(e.target.value) || 0})} 
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">المبلغ المسدد مسبقاً (ريال)</label>
              <input 
                type="number" 
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-bold" 
                value={newItem.paidAmount || ""} 
                onChange={e => setNewItem({...newItem, paidAmount: parseFloat(e.target.value) || 0})} 
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">تاريخ السداد المتوقع</label>
              <input 
                type="date" 
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-bold" 
                value={newItem.dueDate} 
                onChange={e => setNewItem({...newItem, dueDate: e.target.value})} 
              />
            </div>

            <div className="md:col-span-4 flex items-center justify-end gap-3 pt-2">
              <button 
                type="button" 
                onClick={() => setIsAdding(false)} 
                className="px-5 py-3 text-slate-500 font-bold text-xs hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button 
                type="submit" 
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-3 px-6 rounded-xl shadow-md shadow-emerald-200 transition-colors cursor-pointer"
              >
                حفظ الدين
              </button>
            </div>
          </form>
        </div>
      )}

      <TableView 
        title="سجل الديون والالتزامات" 
        description="تتبع المبالغ المستحقة والتقدم المحرز في السداد."
        headers={['جهة الدين', 'المبلغ الإجمالي', 'المسدد', 'المتبقي', 'نسبة الإنجاز', 'تاريخ السداد', 'الحالة', 'إجراءات']}
        isEmpty={debts.length === 0}
        emptyState={
          <div className="py-12 text-center text-slate-400">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-300" />
            <h4 className="text-sm font-bold text-slate-700">لا توجد ديون مسجلة!</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              سجل خالي من الديون والالتزامات، أو اضغط إضافة دين لتسجيل التزام جديد.
            </p>
          </div>
        }
        action={
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-black text-xs shadow-md shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة دين</span>
          </button>
        }
        mobileCards={
          <div className="p-4 space-y-3">
            {debts.map((item) => {
              const remaining = item.totalAmount - item.paidAmount;
              const progress = (item.paidAmount / item.totalAmount) * 100;
              const isCompleted = item.status === 'تم' || item.paidAmount >= item.totalAmount;

              return (
                <div key={item.id} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-black text-slate-900">{item.name}</h4>
                      <span className="text-[10px] text-slate-400">{item.dueDate || 'بدون تاريخ'}</span>
                    </div>

                    <span className={cn(
                      "px-2.5 py-0.5 rounded-full text-[10px] font-black border",
                      isCompleted 
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    )}>
                      {isCompleted ? "تم السداد" : "قيد السداد"}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">الإجمالي</span>
                      <span className="text-xs font-black text-slate-800 dir-ltr">{formatCurrency(item.totalAmount)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-600 block font-bold">المسدد</span>
                      <span className="text-xs font-black text-emerald-600 dir-ltr">{formatCurrency(item.paidAmount)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-rose-600 block font-bold">المتبقي</span>
                      <span className="text-xs font-black text-rose-600 dir-ltr">{formatCurrency(remaining)}</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold text-slate-500">
                      <span>نسبة الإنجاز</span>
                      <span>{progress.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.min(100, progress)}%` }} />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    {payingDebtId === item.id ? (
                      <div className="flex items-center gap-1.5 w-full">
                        <input 
                          type="number" 
                          placeholder="المبلغ" 
                          value={payAmountInput}
                          onChange={(e) => setPayAmountInput(e.target.value)}
                          className="flex-1 px-3 py-1.5 text-xs border border-emerald-300 rounded-xl focus:outline-none"
                        />
                        <button
                          onClick={() => handleUpdatePaidSubmit(item.id!, item.paidAmount, item.totalAmount)}
                          className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-black cursor-pointer"
                        >
                          تأكيد
                        </button>
                        <button
                          onClick={() => setPayingDebtId(null)}
                          className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold cursor-pointer"
                        >
                          إلغاء
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => { setPayingDebtId(item.id!); setPayAmountInput(''); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>تسجيل دفعة</span>
                        </button>

                        <button 
                          onClick={() => handleDelete(item.id!)} 
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                          title="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        }
      >
        {debts.map((item) => {
          const remaining = item.totalAmount - item.paidAmount;
          const progress = (item.paidAmount / item.totalAmount) * 100;
          return (
            <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
              <td className="px-6 py-4 font-black text-xs text-slate-800">{item.name}</td>
              <td className="px-6 py-4 text-slate-600 font-bold text-xs">{formatCurrency(item.totalAmount)}</td>
              <td className="px-6 py-4 text-emerald-600 font-bold text-xs">{formatCurrency(item.paidAmount)}</td>
              <td className="px-6 py-4 text-rose-600 font-black text-xs">{formatCurrency(remaining)}</td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden min-w-[60px]">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="text-xs font-bold text-slate-500">{progress.toFixed(0)}%</span>
                </div>
              </td>
              <td className="px-6 py-4 text-slate-400 text-xs font-medium">{item.dueDate || '-'}</td>
              <td className="px-6 py-4">
                <span className={cn(
                  "px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit",
                  item.status === 'تم' ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : 
                  item.status === 'متأخر' ? "bg-rose-50 text-rose-600 border border-rose-200" : "bg-amber-50 text-amber-600 border border-amber-200"
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
                        className="w-20 px-2 py-1 text-xs border border-emerald-300 rounded focus:outline-none"
                      />
                      <button
                        onClick={() => handleUpdatePaidSubmit(item.id!, item.paidAmount, item.totalAmount)}
                        className="px-2 py-1 bg-emerald-600 text-white rounded text-xs font-bold cursor-pointer"
                      >
                        سداد
                      </button>
                      <button
                        onClick={() => setPayingDebtId(null)}
                        className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-xs font-bold cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => { setPayingDebtId(item.id!); setPayAmountInput(''); }}
                      className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                      title="تسجيل دفعة"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => handleDelete(item.id!)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all" title="حذف الدين">
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
