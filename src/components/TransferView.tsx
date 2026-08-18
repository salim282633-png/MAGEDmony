/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Transaction, AccountItem } from '../types';
import { TableView } from './TableView';
import { MetricCard } from './MetricCard';
import { ArrowLeftRight, Plus, Trash2, History } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { useFinanceData } from '../lib/useFinanceData';

interface TransferViewProps {
  transactions: Transaction[];
  accounts?: AccountItem[];
}

export function TransferView({ transactions, accounts = [] }: TransferViewProps) {
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
    if (!newItem.fromAccount || !newItem.toAccount || !newItem.amount) return;
    if (newItem.fromAccount === newItem.toAccount) {
      alert('لا يمكن التحويل لنفس الحساب');
      return;
    }
    
    await addTransferTransactional({
      fromAccount: newItem.fromAccount,
      toAccount: newItem.toAccount,
      amount: newItem.amount,
      date: newItem.date || new Date().toISOString().split('T')[0],
      notes: newItem.notes || ''
    });

    setNewItem({ 
      fromAccount: '', 
      toAccount: '', 
      amount: 0, 
      date: new Date().toISOString().split('T')[0], 
      notes: '' 
    });
    setIsAdding(false);
  };

  const handleDelete = async (id: string) => {
    await deleteTransferTransactional(id);
  };

  return (
    <div className="space-y-8">
      {/* Quick Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title="عدد التحويلات" value={transactions.length} icon={History} color="blue" />
        <MetricCard title="إجمالي المبالغ المحولة" value={transactions.reduce((acc, curr) => acc + (curr.amount || 0), 0) || ""} icon={ArrowLeftRight} color="blue" />
      </div>

      {isAdding && (
        <div className="bg-white p-8 rounded-3xl border-2 border-blue-100 shadow-xl mb-8">
          <h4 className="text-lg font-bold text-slate-800 mb-6">تحويل جديد بين الحسابات</h4>
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">من حساب</label>
              <select 
                required 
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                value={newItem.fromAccount} 
                onChange={e => setNewItem({...newItem, fromAccount: e.target.value})}
              >
                <option value="">اختر الحساب</option>
                {accountList.map(acc => <option key={acc} value={acc}>{acc}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">إلى حساب</label>
              <select 
                required 
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                value={newItem.toAccount} 
                onChange={e => setNewItem({...newItem, toAccount: e.target.value})}
              >
                <option value="">اختر الحساب</option>
                {accountList.map(acc => <option key={acc} value={acc}>{acc}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">المبلغ</label>
              <input type="number" required className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" value={newItem.amount || ""} onChange={e => setNewItem({...newItem, amount: parseFloat(e.target.value)})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">التاريخ</label>
              <input type="date" required className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" value={newItem.date} onChange={e => setNewItem({...newItem, date: e.target.value})} />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-bold text-slate-700">ملاحظات</label>
              <input type="text" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="مثلاً: تحويل للادخار الإضافي..." value={newItem.notes} onChange={e => setNewItem({...newItem, notes: e.target.value})} />
            </div>
            <div className="flex items-end gap-3">
              <button type="submit" className="flex-1 bg-blue-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-blue-700 transition-colors">تأكيد التحويل</button>
              <button type="button" onClick={() => setIsAdding(false)} className="px-6 py-3 text-slate-500 font-medium hover:bg-slate-100 rounded-xl transition-colors">إلغاء</button>
            </div>
          </form>
        </div>
      )}

      <TableView 
        title="سجل التحويلات المالية" 
        headers={['التاريخ', 'من', 'إلى', 'المبلغ', 'ملاحظات', 'إجراءات']}
        action={
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
          >
            <ArrowLeftRight className="w-5 h-5" />
            <span>تحويل جديد</span>
          </button>
        }
      >
        {transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((item) => (
          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
            <td className="px-6 py-4 text-slate-500 text-sm">{item.date}</td>
            <td className="px-6 py-4 font-bold text-red-600">{item.fromAccount}</td>
            <td className="px-6 py-4 font-bold text-green-600">{item.toAccount}</td>
            <td className="px-6 py-4 font-black text-slate-800">{formatCurrency(item.amount)}</td>
            <td className="px-6 py-4 text-slate-500 text-sm">{item.notes || '-'}</td>
            <td className="px-6 py-4">
              <button onClick={() => handleDelete(item.id!)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                <Trash2 className="w-4 h-4" />
              </button>
            </td>
          </tr>
        ))}
      </TableView>
    </div>
  );
}
