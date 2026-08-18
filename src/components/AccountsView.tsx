import { PRIMARY_BANK_NAME } from '../lib/constants';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AccountItem, AccountType, Transaction, Expense } from '../types';
import { MetricCard } from './MetricCard';
import { 
  Landmark, 
  Wallet, 
  CreditCard, 
  TrendingUp, 
  Globe, 
  Coins, 
  Banknote,
  PiggyBank,
  ShieldCheck,
  Smartphone,
  CircleDollarSign,
  Receipt,
  ShoppingBag,
  Briefcase,
  Building2,
  Gem,
  Plus, 
  Archive, 
  Eye, 
  EyeOff, 
  Pencil, 
  Trash2, 
  ArrowLeftRight,
  History,
  CheckCircle,
  Sparkles,
  X,
  Check
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { addDoc, collection, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';

// Available Lucide Icons for accounts
export const ACCOUNT_ICONS_LIST = [
  { id: 'Landmark', label: 'بنك ومصرف', icon: Landmark },
  { id: 'CreditCard', label: 'بطاقة بنكية', icon: CreditCard },
  { id: 'Wallet', label: 'محفظة', icon: Wallet },
  { id: 'Coins', label: 'كاش ونقد', icon: Coins },
  { id: 'Banknote', label: 'أوراق نقدية', icon: Banknote },
  { id: 'PiggyBank', label: 'حصالة ادخار', icon: PiggyBank },
  { id: 'TrendingUp', label: 'استثمار ونمو', icon: TrendingUp },
  { id: 'Smartphone', label: 'محفظة رقمية', icon: Smartphone },
  { id: 'ShieldCheck', label: 'طوارئ وأمان', icon: ShieldCheck },
  { id: 'Globe', label: 'عملات دولية', icon: Globe },
  { id: 'CircleDollarSign', label: 'عملات أجنبية', icon: CircleDollarSign },
  { id: 'Building2', label: 'مؤسسة / عقار', icon: Building2 },
  { id: 'Briefcase', label: 'راتب وأعمال', icon: Briefcase },
  { id: 'ShoppingBag', label: 'تسوق ومصاريف', icon: ShoppingBag },
  { id: 'Gem', label: 'ذهب وأصول', icon: Gem },
  { id: 'Receipt', label: 'فواتير والتزامات', icon: Receipt },
];

// Color themes for accounts
export const ACCOUNT_COLORS_LIST = [
  { id: 'blue', label: 'أزرق', badge: 'bg-blue-50 text-blue-700 border-blue-200', bgBtn: 'bg-blue-600', ring: 'ring-blue-500' },
  { id: 'emerald', label: 'أخضر', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', bgBtn: 'bg-emerald-600', ring: 'ring-emerald-500' },
  { id: 'purple', label: 'بنفسجي', badge: 'bg-purple-50 text-purple-700 border-purple-200', bgBtn: 'bg-purple-600', ring: 'ring-purple-500' },
  { id: 'amber', label: 'ذهبي', badge: 'bg-amber-50 text-amber-700 border-amber-200', bgBtn: 'bg-amber-600', ring: 'ring-amber-500' },
  { id: 'rose', label: 'وردي', badge: 'bg-rose-50 text-rose-700 border-rose-200', bgBtn: 'bg-rose-600', ring: 'ring-rose-500' },
  { id: 'indigo', label: 'نيلي', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200', bgBtn: 'bg-indigo-600', ring: 'ring-indigo-500' },
  { id: 'cyan', label: 'سماوي', badge: 'bg-cyan-50 text-cyan-700 border-cyan-200', bgBtn: 'bg-cyan-600', ring: 'ring-cyan-500' },
  { id: 'slate', label: 'رمادي', badge: 'bg-slate-100 text-slate-700 border-slate-200', bgBtn: 'bg-slate-700', ring: 'ring-slate-500' },
];

export const getAccountIconComponent = (iconName?: string, type?: AccountType) => {
  if (iconName) {
    const found = ACCOUNT_ICONS_LIST.find(i => i.id === iconName);
    if (found) return found.icon;
  }
  switch (type) {
    case 'نقد': return Coins;
    case 'الحساب البنكي': return Landmark;
    case 'المحافظ الإلكترونية': return Wallet;
    case 'البطاقات الائتمانية': return CreditCard;
    case 'المحافظ الاستثمارية': return TrendingUp;
    case 'حسابات العملات المختلفة': return Globe;
    case 'صندوق مخصص': return PiggyBank;
    default: return Landmark;
  }
};

export const getAccountColorClasses = (colorName?: string, type?: AccountType) => {
  if (colorName) {
    const found = ACCOUNT_COLORS_LIST.find(c => c.id === colorName);
    if (found) return found.badge;
  }
  switch (type) {
    case 'نقد': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'الحساب البنكي': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'المحافظ الإلكترونية': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'البطاقات الائتمانية': return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'المحافظ الاستثمارية': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'حسابات العملات المختلفة': return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    case 'صندوق مخصص': return 'bg-purple-50 text-purple-700 border-purple-200';
    default: return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

interface AccountsViewProps {
  accounts: AccountItem[];
  transactions: Transaction[];
  expenses: Expense[];
}

export function AccountsView({ accounts, transactions, expenses }: AccountsViewProps) {
  const [activeType, setActiveType] = useState<string>('الكل');
  const [showArchived, setShowArchived] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountItem | null>(null);
  const [selectedAccountForHistory, setSelectedAccountForHistory] = useState<AccountItem | null>(null);

  const [formData, setFormData] = useState<Partial<AccountItem>>({
    name: '',
    type: 'الحساب البنكي',
    balance: 0,
    openingBalance: 0,
    openingDate: new Date().toISOString().split('T')[0],
    currency: 'ريال',
    accountNumber: '',
    isArchived: false,
    notes: '',
    icon: 'Landmark',
    color: 'blue'
  });

  const accountTypes: { label: string; value: AccountType | 'الكل'; icon: any }[] = [
    { label: 'الكل', value: 'الكل', icon: Sparkles },
    { label: 'نقد', value: 'نقد', icon: Coins },
    { label: 'الحساب البنكي', value: 'الحساب البنكي', icon: Landmark },
    { label: 'المحافظ الإلكترونية', value: 'المحافظ الإلكترونية', icon: Wallet },
    { label: 'البطاقات الائتمانية', value: 'البطاقات الائتمانية', icon: CreditCard },
    { label: 'المحافظ الاستثمارية', value: 'المحافظ الاستثمارية', icon: TrendingUp },
    { label: 'عملات مختلفة', value: 'حسابات العملات المختلفة', icon: Globe },
    { label: 'صندوق مخصص', value: 'صندوق مخصص', icon: PiggyBank },
  ];

  // Filter accounts
  const filteredAccounts = accounts.filter(acc => {
    const matchesArchived = showArchived ? true : !acc.isArchived;
    const matchesType = activeType === 'الكل' || acc.type === activeType;
    return matchesArchived && matchesType;
  });

  // Totals
  const activeAccounts = accounts.filter(a => !a.isArchived);
  const totalSARBalance = activeAccounts
    .filter(a => {
      const cur = (a.currency || '').trim().toLowerCase();
      return cur === 'ريال' || cur === 'sar' || cur === 'ريال سعودي';
    })
    .reduce((acc, curr) => acc + curr.balance, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    if (editingAccount && editingAccount.id) {
      await updateDoc(doc(db, 'accounts', editingAccount.id), {
        ...formData
      });
    } else {
      await addDoc(collection(db, 'accounts'), {
        ...formData,
        userId: auth.currentUser.uid,
      });
    }

    closeModal();
  };

  const openAddModal = () => {
    setEditingAccount(null);
    setFormData({
      name: '',
      type: 'المحافظ الإلكترونية',
      balance: 0,
      openingBalance: 0,
      openingDate: new Date().toISOString().split('T')[0],
      currency: 'ريال',
      accountNumber: '',
      isArchived: false,
      notes: '',
      icon: 'Wallet',
      color: 'blue'
    });
    setIsModalOpen(true);
  };

  const openEditModal = (acc: AccountItem) => {
    setEditingAccount(acc);
    setFormData({
      name: acc.name,
      type: acc.type,
      balance: acc.balance,
      openingBalance: acc.openingBalance || 0,
      openingDate: acc.openingDate || new Date().toISOString().split('T')[0],
      currency: acc.currency,
      accountNumber: acc.accountNumber || '',
      isArchived: acc.isArchived,
      notes: acc.notes || '',
      icon: acc.icon || (acc.type === 'نقد' ? 'Coins' : acc.type === 'البطاقات الائتمانية' ? 'CreditCard' : acc.type === 'المحافظ الإلكترونية' ? 'Wallet' : acc.type === 'المحافظ الاستثمارية' ? 'TrendingUp' : 'Landmark'),
      color: acc.color || (acc.type === 'نقد' ? 'amber' : acc.type === 'البطاقات الائتمانية' ? 'rose' : acc.type === 'المحافظ الإلكترونية' ? 'emerald' : acc.type === 'المحافظ الاستثمارية' ? 'indigo' : 'blue')
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingAccount(null);
  };

  const toggleArchive = async (acc: AccountItem) => {
    if (!acc.id) return;
    await updateDoc(doc(db, 'accounts', acc.id), {
      isArchived: !acc.isArchived
    });
  };

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, 'accounts', id));
  };

  // Get recent operations for a specific account
  const getAllOperations = (account: AccountItem) => {
    const transfers = transactions.filter(
      t => t.fromAccount === account.name || t.toAccount === account.name
    ).map(t => ({
      id: t.id,
      date: t.date,
      title: t.fromAccount === account.name ? `تحويل إلى: ${t.toAccount}` : `تحويل من: ${t.fromAccount}`,
      amount: t.fromAccount === account.name ? -t.amount : t.amount,
      type: 'تحويل',
      notes: t.notes
    }));

    const accountExpenses = expenses.filter(
      e => e.paymentMethod === account.name || e.paymentMethod === account.type
    ).map(e => ({
      id: e.id,
      date: e.date,
      title: `${e.category}: ${e.description}`,
      amount: e.type === 'دخل' ? e.amount : -e.amount,
      type: e.type === 'دخل' ? 'إيداع' : 'صرف',
      notes: e.notes
    }));

    return [...transfers, ...accountExpenses]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  // Selected icon component for modal preview
  const SelectedModalIcon = getAccountIconComponent(formData.icon, formData.type);
  const selectedModalColorClass = getAccountColorClasses(formData.color, formData.type);

  return (
    <div className="space-y-8">
      {/* Top Bar Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          title="إجمالي الحسابات النشطة" 
          value={activeAccounts.length} 
          icon={Landmark} 
          color="blue" 
          isCurrency={false}
          subtext="جميع الحسابات غير المؤرشفة"
        />
        <MetricCard 
          title="إجمالي الأموال الفعلية (بالريال)" 
          value={totalSARBalance} 
          icon={Coins} 
          color="emerald" 
          subtext="شامل جميع الحسابات والصناديق"
        />
        <MetricCard 
          title="الحسابات المؤرشفة" 
          value={accounts.filter(a => a.isArchived).length} 
          icon={Archive} 
          color="purple" 
          isCurrency={false}
          subtext="حسابات خاملة أو مخفية"
        />
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-950 p-6 rounded-2xl shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 -mt-8 -ml-8 w-32 h-32 bg-white/60 rounded-full blur-2xl pointer-events-none" />
          <div className="flex justify-between items-start relative z-10">
            <span className="text-xs font-bold text-emerald-800">إدارة الحسابات</span>
            <Sparkles className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="relative z-10">
            <p className="text-xs text-emerald-700 font-medium mb-3">تتبع جميع محفظتك المالية والعملات بدقة</p>
            <button 
              onClick={openAddModal}
              className="w-full bg-emerald-600 text-white hover:bg-emerald-700 font-bold py-2.5 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة حساب جديد</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filters & Actions Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {accountTypes.map(tab => {
            const IconComponent = tab.icon;
            const isActive = activeType === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setActiveType(tab.value)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all",
                  isActive 
                    ? "bg-slate-800 text-white shadow-md" 
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100"
                )}
              >
                <IconComponent className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Controls */}
        <div className="flex items-center justify-between lg:justify-end gap-3 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all",
              showArchived 
                ? "bg-purple-50 text-purple-700 border-purple-200" 
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            )}
          >
            {showArchived ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            <span>{showArchived ? "إخفاء الحسابات المؤرشفة" : "إظهار الحسابات المؤرشفة"}</span>
          </button>

          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>حساب جديد</span>
          </button>
        </div>
      </div>

      {/* Accounts Grid */}
      {filteredAccounts.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
            <Landmark className="w-8 h-8" />
          </div>
          <h4 className="text-base font-bold text-slate-700 mb-1">لا توجد حسابات مضافة</h4>
          <p className="text-xs text-slate-400 mb-6">قم بإضافة حساباتك النقدية والبنكية والمحافظ الإلكترونية لتتبع أرصدتك.</p>
          <button 
            onClick={openAddModal}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة حسابك الأول</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAccounts.map((account) => {
            const IconComponent = getAccountIconComponent(account.icon, account.type);
            const colorClasses = getAccountColorClasses(account.color, account.type);
            const recentOps = getAllOperations(account).slice(0, 10);

            return (
              <motion.div
                key={account.id}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "bg-white rounded-3xl border p-6 shadow-sm flex flex-col justify-between relative transition-all hover:shadow-md",
                  account.isArchived ? "opacity-60 bg-slate-50 border-slate-200" : "border-slate-100"
                )}
              >
                {/* Header info */}
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn("p-3 rounded-2xl border shadow-sm transition-transform hover:scale-105", colorClasses)}>
                        <IconComponent className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-base leading-snug">{account.name}</h4>
                        <span className="inline-block text-[11px] font-bold text-slate-400">
                          {account.type}
                        </span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span className={cn(
                      "text-[10px] font-bold px-2.5 py-1 rounded-full border",
                      account.isArchived 
                        ? "bg-slate-100 text-slate-500 border-slate-200" 
                        : "bg-emerald-50 text-emerald-600 border-emerald-200"
                    )}>
                      {account.isArchived ? "مؤرشف" : "نشط"}
                    </span>
                  </div>

                  {/* Account Number / IBAN */}
                  {account.accountNumber && (
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 mb-4 flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium">رقم الحساب/IBAN</span>
                      <span className="font-mono text-slate-700 font-bold tracking-wider dir-ltr">{account.accountNumber}</span>
                    </div>
                  )}

                  {/* Current Balance */}
                  <div className="bg-slate-50 text-slate-900 border border-slate-200 p-5 rounded-2xl mb-4">
                    <span className="text-xs text-slate-500 font-bold block mb-1">الرصيد الحالي</span>
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-black tracking-tight dir-ltr">
                        {account.balance.toLocaleString('en-US')}
                      </span>
                      <span className="text-sm font-bold bg-slate-200/80 px-2.5 py-1 rounded-lg text-slate-800">
                        {account.currency}
                      </span>
                    </div>
                  </div>

                  {/* Notes */}
                  {account.notes && (
                    <p className="text-xs text-slate-500 font-medium mb-4 line-clamp-2">
                      💡 {account.notes}
                    </p>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => setSelectedAccountForHistory(account)}
                    className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-all"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>آخر العمليات ({recentOps.length})</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleArchive(account)}
                      title={account.isArchived ? "إلغاء الأرشفة" : "أرشفة الحساب"}
                      className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
                    >
                      {account.isArchived ? <Eye className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => openEditModal(account)}
                      title="تعديل الحساب"
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(account.id!)}
                      title="حذف الحساب"
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto"
            >
              <button 
                onClick={closeModal}
                className="absolute top-6 left-6 p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-all"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-2">
                <div className={cn("p-2.5 rounded-2xl border", selectedModalColorClass)}>
                  <SelectedModalIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800">
                    {editingAccount ? "تعديل بيانات الحساب" : "إضافة حساب جديد"}
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    خصّص أيقونة الحساب وتفاصيله لتنظيم محفظتك بدقة.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                {/* Custom Icon Selection Section */}
                <div className="space-y-2 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      <span>أيقونة الحساب (من مكتبة Lucide)</span>
                    </label>
                    <span className="text-[11px] text-slate-500 font-medium">
                      المختارة: {ACCOUNT_ICONS_LIST.find(i => i.id === (formData.icon || 'Landmark'))?.label || 'بنك'}
                    </span>
                  </div>

                  {/* Icon Grid */}
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 pt-1 max-h-36 overflow-y-auto p-1 bg-white rounded-xl border border-slate-200">
                    {ACCOUNT_ICONS_LIST.map((item) => {
                      const IconComp = item.icon;
                      const isSelected = (formData.icon || 'Landmark') === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, icon: item.id })}
                          title={item.label}
                          className={cn(
                            "flex flex-col items-center justify-center p-2 rounded-xl border transition-all text-xs font-medium relative group",
                            isSelected 
                              ? "bg-blue-50 text-blue-700 border-blue-400 shadow-sm ring-2 ring-blue-400/30 scale-105" 
                              : "bg-white text-slate-600 hover:bg-slate-50 border-slate-100 hover:border-slate-300"
                          )}
                        >
                          <IconComp className="w-5 h-5" />
                          <span className="text-[9px] mt-1 line-clamp-1 truncate w-full text-center">{item.label.split(' ')[0]}</span>
                          {isSelected && (
                            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-blue-600 text-white rounded-full flex items-center justify-center">
                              <Check className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Color Palette Selector */}
                  <div className="pt-2">
                    <label className="text-[11px] font-bold text-slate-600 block mb-1.5">لون بطاقة الأيقونة:</label>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {ACCOUNT_COLORS_LIST.map((col) => {
                        const isColSelected = (formData.color || 'blue') === col.id;
                        return (
                          <button
                            key={col.id}
                            type="button"
                            onClick={() => setFormData({ ...formData, color: col.id })}
                            className={cn(
                              "px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1",
                              isColSelected 
                                ? `${col.badge} ring-2 ring-offset-1 ${col.ring} shadow-sm font-black` 
                                : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                            )}
                          >
                            <span className={cn("w-2 h-2 rounded-full", col.bgBtn)} />
                            <span>{col.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">اسم الحساب</label>
                  <input
                    type="text"
                    required
                    placeholder="مثلاً: بنك الراجحي الأساسي أو محفظة STC Pay"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold"
                    value={formData.name || ''}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">نوع الحساب</label>
                    <select
                      required
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold"
                      value={formData.type || 'المحافظ الإلكترونية'}
                      onChange={e => setFormData({ ...formData, type: e.target.value as AccountType })}
                    >
                      {formData.type === 'الحساب البنكي' && editingAccount && (
                        <option value="الحساب البنكي">الحساب البنكي (رئيسي)</option>
                      )}
                      <option value="نقد">نقد (كاش)</option>
                      <option value="المحافظ الإلكترونية">المحافظ الإلكترونية</option>
                      <option value="البطاقات الائتمانية">البطاقات الائتمانية</option>
                      <option value="المحافظ الاستثمارية">المحافظ الاستثمارية</option>
                      <option value="حسابات العملات المختلفة">عملات مختلفة</option>
                      <option value="صندوق مخصص">صندوق مخصص</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">العملة</label>
                    <select
                      required
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold"
                      value={formData.currency || 'ريال'}
                      onChange={e => setFormData({ ...formData, currency: e.target.value })}
                    >
                      <option value="ريال">ريال سعودي (SAR)</option>
                      <option value="USD">دولار أمريكي (USD)</option>
                      <option value="EUR">يورو (EUR)</option>
                      <option value="AED">درهم إماراتي (AED)</option>
                      <option value="KWD">دينار كويتي (KWD)</option>
                      <option value="EGP">جنيه مصري (EGP)</option>
                      <option value="GBP">جنيه استرليني (GBP)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">الرصيد الحالي</label>
                    <input
                      type="number"
                      step="any"
                      required
                      placeholder="0.00"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold"
                      value={formData.balance ?? 0}
                      onChange={e => setFormData({ ...formData, balance: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">رقم الحساب / IBAN (اختياري)</label>
                    <input
                      type="text"
                      placeholder="SA..."
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono dir-ltr"
                      value={formData.accountNumber || ''}
                      onChange={e => setFormData({ ...formData, accountNumber: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">الرصيد الافتتاحي (اختياري)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="0.00"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold"
                      value={formData.openingBalance ?? 0}
                      onChange={e => setFormData({ ...formData, openingBalance: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">تاريخ الرصيد الافتتاحي</label>
                    <input
                      type="date"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold"
                      value={formData.openingDate || new Date().toISOString().split('T')[0]}
                      onChange={e => setFormData({ ...formData, openingDate: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">ملاحظات (اختياري)</label>
                  <input
                    type="text"
                    placeholder="مثلاً: الحد الائتماني أو غرض الحساب..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
                    value={formData.notes || ''}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-600">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                      checked={formData.isArchived || false}
                      onChange={e => setFormData({ ...formData, isArchived: e.target.checked })}
                    />
                    <span>أرشفة هذا الحساب (إخفاؤه من القائمة الرئيسية)</span>
                  </label>
                </div>

                <div className="flex items-center gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-blue-100"
                  >
                    {editingAccount ? "حفظ التعديلات" : "إضافة الحساب"}
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Recent Operations History Drawer/Modal */}
      <AnimatePresence>
        {selectedAccountForHistory && (() => {
              const allOps = getAllOperations(selectedAccountForHistory);
              const totalDeposits = allOps.filter(o => o.amount > 0).reduce((acc, curr) => acc + (curr.amount || 0), 0);
              const totalWithdrawals = allOps.filter(o => o.amount < 0).reduce((acc, curr) => acc + Math.abs(curr.amount), 0);
              
              return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 max-w-xl w-full shadow-2xl border border-slate-100 relative max-h-[85vh] flex flex-col"
            >
              <button 
                onClick={() => setSelectedAccountForHistory(null)}
                className="absolute top-6 left-6 p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-all"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-6">
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full mb-2 inline-block">
                  {selectedAccountForHistory.type}
                </span>
                <h3 className="text-xl font-black text-slate-800">
                  آخر العمليات: {selectedAccountForHistory.name}
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-1 mb-4">
                  الرصيد الحالي: <span className="font-bold text-slate-700">{selectedAccountForHistory.balance.toLocaleString('en-US')} {selectedAccountForHistory.currency}</span>
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 p-3 rounded-2xl border border-green-100">
                    <span className="text-xs text-green-600 font-bold block">إجمالي الإيداعات</span>
                    <span className="text-sm font-black text-green-700 dir-ltr block mt-1">{totalDeposits.toLocaleString('en-US')} {selectedAccountForHistory.currency}</span>
                  </div>
                  <div className="bg-red-50 p-3 rounded-2xl border border-red-100">
                    <span className="text-xs text-red-600 font-bold block">إجمالي المصروفات</span>
                    <span className="text-sm font-black text-red-700 dir-ltr block mt-1">{totalWithdrawals.toLocaleString('en-US')} {selectedAccountForHistory.currency}</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {allOps.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 rounded-2xl border border-slate-100">
                    <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-400">لا توجد عمليات مسجلة لهذا الحساب حالياً</p>
                  </div>
                ) : (
                  allOps.slice(0, 50).map((op, idx) => (
                    <div 
                      key={idx}
                      className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2.5 rounded-xl text-white font-bold",
                          op.amount >= 0 ? "bg-green-600" : "bg-red-500"
                        )}>
                          <ArrowLeftRight className="w-4 h-4" />
                        </div>
                        <div>
                          <h5 className="text-xs font-bold text-slate-800">{op.title}</h5>
                          <p className="text-[11px] text-slate-400 font-medium">{op.date} • {op.type}</p>
                        </div>
                      </div>
                      <div className="text-left">
                        <span className={cn(
                          "text-sm font-black dir-ltr block",
                          op.amount >= 0 ? "text-green-600" : "text-slate-800"
                        )}>
                          {op.amount > 0 ? `+${op.amount}` : op.amount} {selectedAccountForHistory.currency}
                        </span>
                        {op.notes && (
                          <span className="text-[10px] text-slate-400 font-medium">{op.notes}</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 text-center">
                <button
                  onClick={() => setSelectedAccountForHistory(null)}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl text-xs transition-all"
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          </div>
        );
      })()}
      </AnimatePresence>
    </div>
  );
}
