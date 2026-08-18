/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { useFinanceData } from './lib/useFinanceData';
import { Login } from './components/Login';
import { QuickAddModal } from './components/QuickAddModal';
import { 
  LayoutDashboard, 
  Wallet, 
  CreditCard, 
  PiggyBank, 
  Receipt, 
  BarChart3,
  Target,
  ArrowLeftRight,
  Landmark,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowDownToLine,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
  Plus,
  Sparkles,
  ChevronDown,
  ChevronLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { auth } from './lib/firebase';
import { signOut } from 'firebase/auth';

// Component imports
import { DashboardView } from './components/DashboardView';
import { BudgetView } from './components/BudgetView';
import { DebtView } from './components/DebtView';
import { SavingsView } from './components/SavingsView';
import { ExpenseView } from './components/ExpenseView';
import { ReportsView } from './components/ReportsView';
import { TransferView } from './components/TransferView';
import { AccountsView } from './components/AccountsView';
import { SettingsView } from './components/SettingsView';
import { SalaryDistributor } from './components/SalaryDistributor';
import { TenYearJourneyView } from './components/TenYearJourneyView';

type TabType = 
  | 'dashboard' 
  | 'salary'
  | 'journey'
  | 'expenses'
  | 'transfers'
  | 'debt'
  | 'accounts'
  | 'reports'
  | 'settings';

export default function App() {
  const financeData = useFinanceData();
  const { 
    user, 
    loading, 
    settings, 
    budget, 
    debts, 
    savings, 
    expenses, 
    goals, 
    transactions, 
    accounts, 
    subscriptions,
    monthlyClosures 
  } = financeData;

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isTransactionsOpen, setIsTransactionsOpen] = useState(true);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddType, setQuickAddType] = useState<'income' | 'expense'>('income');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dir-rtl">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-600"></div>
          <span className="text-xs font-bold text-slate-500">جاري تحميل بياناتك المالية...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const handleOpenQuickAdd = (type: 'income' | 'expense' = 'income') => {
    setQuickAddType(type);
    setIsQuickAddOpen(true);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': 
        return (
          <DashboardView 
            settings={settings} 
            budget={budget} 
            debts={debts} 
            savings={savings} 
            expenses={expenses} 
            goals={goals} 
            subscriptions={subscriptions} 
            accounts={accounts} 
            transactions={transactions} 
            monthlyClosures={monthlyClosures}
            onQuickAdd={handleOpenQuickAdd}
            onNavigateTab={(tab) => {
              if (['dashboard', 'salary', 'journey', 'expenses', 'transfers', 'debt', 'accounts', 'reports', 'settings'].includes(tab)) {
                setActiveTab(tab as TabType);
              }
            }}
          />
        );
      case 'salary':
        return <SalaryDistributor settings={settings} budget={budget} accounts={accounts} expenses={expenses} transactions={transactions} debts={debts} />;
      case 'journey':
        return (
          <TenYearJourneyView 
            settings={settings} 
            accounts={accounts} 
            expenses={expenses} 
            transactions={transactions} 
            debts={debts} 
            savings={savings} 
          />
        );
      case 'expenses': 
        return <ExpenseView expenses={expenses} accounts={accounts} settings={settings} debts={debts} initialTypeFilter="الكل" />;
      case 'transfers':
        return <TransferView transactions={transactions} accounts={accounts} />;
      case 'debt': 
        return <DebtView debts={debts} settings={settings} accounts={accounts} />;
      case 'accounts': 
        return <AccountsView accounts={accounts} transactions={transactions} expenses={expenses} />;
      case 'reports': 
        return <ReportsView settings={settings} expenses={expenses} accounts={accounts} transactions={transactions} budget={budget} monthlyClosures={monthlyClosures} />;
      case 'settings': 
        return (
          <SettingsView 
            settings={settings} 
            expenses={expenses}
            transactions={transactions}
            accounts={accounts}
            debts={debts}
            budget={budget}
            onNavigateToBackup={() => setActiveTab('reports')} 
          />
        );
      default: 
        return null;
    }
  };

  const getTabTitle = (tab: TabType): string => {
    switch (tab) {
      case 'dashboard': return '🏠 الرئيسية (كم أستطيع أن أصرف؟)';
      case 'salary': return '💰 الراتب وتوزيعه';
      case 'journey': return '🎯 رحلتي المالية – 10 سنوات';
      case 'expenses': return '💸 المصروفات والدخل';
      case 'transfers': return '🔄 التحويلات بين الحسابات';
      case 'debt': return '💳 الديون القائمة';
      case 'accounts': return '🏦 الحسابات والصناديق';
      case 'reports': return '📊 تقارير بسيطة';
      case 'settings': return '⚙️ الإعدادات';
      default: return 'الخبير المالي';
    }
  };

  const isTransactionActive = activeTab === 'income' || activeTab === 'expenses';

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 flex font-sans text-right">
      
      {/* Mobile Backdrop Overlay */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          className="lg:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 transition-opacity"
        />
      )}

      {/* Mobile Sidebar Toggle Button */}
      <div className="lg:hidden fixed top-4 right-4 z-50">
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2.5 bg-white rounded-xl shadow-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
        >
          {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar Navigation (Right-aligned in RTL) */}
      <aside className={cn(
        "fixed lg:static inset-y-0 right-0 z-40 w-72 bg-white border-l border-slate-200/80 transition-transform duration-300 lg:translate-x-0 flex flex-col shadow-sm shrink-0",
        isSidebarOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="h-full flex flex-col p-5 overflow-y-auto scrollbar-thin">
          
          {/* App Header Logo */}
          <div className="flex items-center gap-3 mb-6 px-2 pt-2">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-md shadow-emerald-200">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-lg font-black text-slate-900 tracking-tight">الخبير المالي</span>
              <p className="text-[10px] font-bold text-emerald-600">كم أستطيع أن أصرف الآن؟</p>
            </div>
          </div>

          {/* Quick Add Button */}
          <button
            onClick={() => handleOpenQuickAdd('income')}
            className="w-full mb-6 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md shadow-emerald-200 flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>تسجيل حركة جديدة ⚡</span>
          </button>

          {/* Nav Items */}
          <nav className="flex-1 space-y-1.5">
            
            {/* 1. الرئيسية */}
            <button
              onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 font-bold text-xs",
                activeTab === 'dashboard' 
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-200" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>الرئيسية</span>
            </button>

            {/* 2. الراتب */}
            <button
              onClick={() => { setActiveTab('salary'); setIsSidebarOpen(false); }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 font-bold text-xs",
                activeTab === 'salary' 
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-200" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <ArrowDownToLine className="w-4 h-4" />
              <span>💰 الراتب</span>
            </button>

            {/* 3. المصروفات */}
            <button
              onClick={() => { setActiveTab('expenses'); setIsSidebarOpen(false); }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 font-bold text-xs",
                activeTab === 'expenses' 
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-200" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <Receipt className="w-4 h-4" />
              <span>💸 المصروفات</span>
            </button>

            {/* 4. التحويلات بين الحسابات */}
            <button
              onClick={() => { setActiveTab('transfers'); setIsSidebarOpen(false); }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 font-bold text-xs",
                activeTab === 'transfers' 
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-200" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>🔄 التحويلات المالية</span>
            </button>

            {/* 5. الديون */}
            <button
              onClick={() => { setActiveTab('debt'); setIsSidebarOpen(false); }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 font-bold text-xs",
                activeTab === 'debt' 
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-200" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <CreditCard className="w-4 h-4" />
              <span>💳 الديون</span>
            </button>

            {/* 6. الحسابات والصناديق */}
            <button
              onClick={() => { setActiveTab('accounts'); setIsSidebarOpen(false); }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 font-bold text-xs",
                activeTab === 'accounts' 
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-200" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <Landmark className="w-4 h-4" />
              <span>🏦 الحسابات والصناديق</span>
            </button>

            {/* 7. تقارير بسيطة */}
            <button
              onClick={() => { setActiveTab('reports'); setIsSidebarOpen(false); }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 font-bold text-xs",
                activeTab === 'reports' 
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-200" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <BarChart3 className="w-4 h-4" />
              <span>📊 تقارير بسيطة</span>
            </button>

            {/* 8. الإعدادات */}
            <button
              onClick={() => { setActiveTab('settings'); setIsSidebarOpen(false); }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 font-bold text-xs",
                activeTab === 'settings' 
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-200" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <SettingsIcon className="w-4 h-4" />
              <span>⚙️ الإعدادات</span>
            </button>

            {/* 9. رحلتي المالية – 10 سنوات (ذيل القائمة) */}
            <button
              onClick={() => { setActiveTab('journey'); setIsSidebarOpen(false); }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 font-bold text-xs border-t border-slate-100 pt-3 mt-1",
                activeTab === 'journey' 
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-200" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <Target className="w-4 h-4" />
              <span>🎯 رحلتي المالية – 10 سنوات</span>
            </button>
          </nav>

          {/* User footer */}
          <div className="pt-4 mt-4 border-t border-slate-100">
            <div className="flex items-center gap-3 mb-3 px-2">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
                {(user.displayName || user.email || 'م')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{user.displayName || 'المستخدم'}</p>
                <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
              </div>
            </div>
            <button 
              onClick={() => signOut(auth)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200/80 flex items-center justify-between px-6 lg:px-10 flex-shrink-0">
          <h2 className="text-sm md:text-base font-black text-slate-800">
            {getTabTitle(activeTab)}
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleOpenQuickAdd('income')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200 hover:bg-emerald-100 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة سريعة</span>
            </button>
            <span className="text-xs font-bold text-slate-400">
              {new Date().toLocaleDateString('ar-SA-u-nu-latn', { weekday: 'long', month: 'long', day: 'numeric' })}
            </span>
          </div>
        </header>

        {/* View Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Quick Add Modal */}
      <QuickAddModal 
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        initialType={quickAddType}
      />
    </div>
  );
}
