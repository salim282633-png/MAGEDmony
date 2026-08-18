/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Transaction, AccountItem } from '../types';
import { TableView } from './TableView';
import { MetricCard } from './MetricCard';
import { ArrowLeftRight, Plus, Trash2, History, ArrowRight } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { useFinanceData } from '../lib/useFinanceData';
import { useToast } from '../lib/toast';

interface TransferViewProps {
  transactions: Transaction[];
  accounts?: AccountItem[];
}

export function TransferView({ transactions, accounts = [] }: TransferViewProps) {
  const toast = useToast();
  const { addTransferTransactional, deleteTransferTransactional } = useFinanceData();
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState<Partial<Transaction>>({
    fromAccount: '',
    toAccount: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const defaultAccountNames = ['الراتب', 'الادخار', 'الطوارئ', 'المصروفات', 'الديون'];
  const accountList = accounts.length > 0 ? accounts.map(a => a.name) : defaultAccountNames;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.fromAccount || !newItem.toAccount || !newItem.amount) {
      toast.warning('يرجى تحديد الحسابات والمبلغ');
      return;
    }
    if (newItem.fromAccount === newItem.toAccount) {
      toast.warning('لا يمكن التحويل لنفس الحساب');
      return;
    }
    
    try {
      await addTransferTransactional({
        fromAccount: newItem.fromAccount,
        toAccount: newItem.toAccount,
        amount: newItem.amount,
        date: newItem.date || new Date().toISOString().split('T')[0],
        notes: newItem.notes || ''
      });

      toast.success(
        'تم تنفيذ التحويل بنجاح',
        `تم تحويل ${formatCurrency(newItem.amount)} من ${newItem.fromAccount} إلى ${newItem.toAccount}`
      );

      setNewItem({ 
        fromAccount: '', 
        toAccount: '', 
        amount: 0, 
        date: new Date().toISOString().split('T')[0], 
        notes: '' 
      });
      setIsAdding(false);
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء إجراء التحويل: ' + (err instanceof Error ? err.message : ''));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTransferTransactional(id);
      toast.success('تم حذف التحويل واسترجاع الأرصدة بنجاح');
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء حذف التحويل: ' + (err instanceof Error ? err.message : ''));
    }
  };

  const sortedTransactions = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6">
      {/* Quick Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MetricCard title="عدد التحويلات المسجلة" value={transactions.length} icon={History} color="blue" />
        <MetricCard 
          title="إجمالي المبالغ المحولة" 
          value={transactions.reduce((acc, curr) => acc + (curr.amount || 0), 0)} 
          icon={ArrowLeftRight} 
          color="blue" 
        />
      </div>

      {isAdding && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-lg mb-6">
          <h4 className="text-base sm:text-lg font-black text-slate-900 mb-4">تحويل جديد بين الحسابات</h4>
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">من حساب (المرسل)</label>
              <select 
                required 
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-bold text-slate-800 bg-white"
                value={newItem.fromAccount} 
                onChange={e => setNewItem({...newItem, fromAccount: e.target.value})}
              >
                <option value="">اختر الحساب</option>
                {accountList.map(acc => <option key={acc} value={acc}>{acc}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">إلى حساب (المستلم)</label>
              <select 
                required 
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-bold text-slate-800 bg-white"
                value={newItem.toAccount} 
                onChange={e => setNewItem({...newItem, toAccount: e.target.value})}
              >
                <option value="">اختر الحساب</option>
                {accountList.map(acc => <option key={acc} value={acc}>{acc}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">المبلغ (ريال)</label>
              <input 
                type="number" 
                step="any"
                required 
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-black text-slate-900" 
                value={newItem.amount || ""} 
                onChange={e => setNewItem({...newItem, amount: parseFloat(e.target.value) || 0})} 
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">التاريخ</label>
              <input 
                type="date" 
                required 
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-bold text-slate-800" 
                value={newItem.date} 
                onChange={e => setNewItem({...newItem, date: e.target.value})} 
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-slate-700">ملاحظات (اختياري)</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-medium text-slate-800" 
                placeholder="مثلاً: تحويل للادخار أو إعادة توزيع الميزانية..." 
                value={newItem.notes} 
                onChange={e => setNewItem({...newItem, notes: e.target.value})} 
              />
            </div>

            <div className="md:col-span-3 flex items-center justify-end gap-3 pt-2">
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
                تأكيد التحويل
              </button>
            </div>
          </form>
        </div>
      )}

      <TableView 
        title="سجل التحويلات المالية" 
        description="جميع عمليات التحويل بين الحسابات والصناديق المختلفة"
        headers={['التاريخ', 'من حساب', 'إلى حساب', 'المبلغ', 'ملاحظات', 'إجراءات']}
        isEmpty={sortedTransactions.length === 0}
        emptyState={
          <div className="py-12 text-center text-slate-400">
            <ArrowLeftRight className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <h4 className="text-sm font-bold text-slate-700">لا توجد تحويلات مسجلة</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              اضغط على زر تحويل جديد لإجراء ونقل المبالغ بين الحسابات والصناديق.
            </p>
          </div>
        }
        action={
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-black text-xs shadow-md shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>تحويل جديد</span>
          </button>
        }
        mobileCards={
          <div className="p-4 space-y-3">
            {sortedTransactions.map((item) => (
              <div key={item.id} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col gap-2.5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                      <ArrowLeftRight className="w-4 h-4" />
                    </span>
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <span className="text-rose-600">{item.fromAccount}</span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <span className="text-emerald-600">{item.toAccount}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">{item.date}</span>
                    </div>
                  </div>

                  <span className="text-sm font-black text-slate-900 dir-ltr">
                    {formatCurrency(item.amount)}
                  </span>
                </div>

                {item.notes && (
                  <p className="text-[11px] text-slate-500 font-medium bg-slate-50 p-2 rounded-xl border border-slate-100">
                    {item.notes}
                  </p>
                )}

                <div className="flex justify-end pt-1 border-t border-slate-100">
                  <button 
                    onClick={() => handleDelete(item.id!)} 
                    className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                    title="حذف واسترجاع"
                    aria-label="حذف واسترجاع"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        }
      >
        {sortedTransactions.map((item) => (
          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
            <td className="px-6 py-4 text-slate-500 text-xs font-bold">{item.date}</td>
            <td className="px-6 py-4 font-bold text-xs text-rose-600">{item.fromAccount}</td>
            <td className="px-6 py-4 font-bold text-xs text-emerald-600">{item.toAccount}</td>
            <td className="px-6 py-4 font-black text-sm text-slate-900">{formatCurrency(item.amount)}</td>
            <td className="px-6 py-4 text-slate-500 text-xs font-medium">{item.notes || '-'}</td>
            <td className="px-6 py-4">
              <button 
                onClick={() => handleDelete(item.id!)} 
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                title="حذف التحويل واسترجاع الأرصدة"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </td>
          </tr>
        ))}
      </TableView>
    </div>
  );
}
