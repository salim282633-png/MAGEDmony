import { getPrimaryBankAccount } from '../types';
import React, { useState, useEffect } from 'react';
import { 
  Coins, 
  Calendar, 
  Bell, 
  CloudDownload, 
  ShieldCheck, 
  Lock, 
  Eye, 
  EyeOff, 
  Save, 
  Check, 
  Globe, 
  Clock, 
  Sparkles,
  AlertTriangle,
  Database,
  ArrowRight,
  FileSpreadsheet,
  Download,
  FileText,
  CreditCard,
  Building2,
  PieChart
} from 'lucide-react';
import { UserSettings, Expense, Transaction, AccountItem, DebtItem, BudgetItem } from '../types';
import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

interface SettingsViewProps {
  settings: UserSettings | null;
  expenses?: Expense[];
  transactions?: Transaction[];
  accounts?: AccountItem[];
  debts?: DebtItem[];
  budget?: BudgetItem[];
  onNavigateToBackup?: () => void;
}

export function SettingsView({ 
  settings, 
  expenses = [], 
  transactions = [], 
  accounts = [], 
  debts = [], 
  budget = [], 
  onNavigateToBackup 
}: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<'currency' | 'fiscal' | 'backup' | 'privacy'>('currency');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states initialized with current settings or defaults
  const [salary, setSalary] = useState<number>(settings?.salary || 2500);
  const [currency, setCurrency] = useState<string>(settings?.currency || 'ر.س');
  const [language, setLanguage] = useState<'ar' | 'en'>(settings?.language || 'ar');
  const [payDay, setPayDay] = useState<number>(settings?.payDay || 27);
  const [emergencyCapMonths, setEmergencyCapMonths] = useState<number>(settings?.emergencyCapMonths ?? 3);
  
  const [fiscalYearStart, setFiscalYearStart] = useState<string>(settings?.fiscalYearStart || '01');
  const [calendarType, setCalendarType] = useState<'gregorian' | 'hijri'>(settings?.calendarType || 'gregorian');

  // Privacy state
  const [hideBalances, setHideBalances] = useState<boolean>(settings?.privacy?.hideBalances ?? false);
  const [pinEnabled, setPinEnabled] = useState<boolean>(settings?.privacy?.pinEnabled ?? false);
  const [pinCode, setPinCode] = useState<string>(settings?.privacy?.pinCode || '');
  const [autoLockMinutes, setAutoLockMinutes] = useState<number>(settings?.privacy?.autoLockMinutes ?? 5);
  const [showPinInput, setShowPinInput] = useState<boolean>(false);

  useEffect(() => {
    if (settings) {
      setSalary(settings.salary || 2500);
      setCurrency(settings.currency || 'ر.س');
      setLanguage(settings.language || 'ar');
      setPayDay(settings.payDay || 27);
      setEmergencyCapMonths(settings.emergencyCapMonths ?? 3);
      setFiscalYearStart(settings.fiscalYearStart || '01');
      setCalendarType(settings.calendarType || 'gregorian');

      if (settings.privacy) {
        setHideBalances(settings.privacy.hideBalances);
        setPinEnabled(settings.privacy.pinEnabled);
        setPinCode(settings.privacy.pinCode || '');
        setAutoLockMinutes(settings.privacy.autoLockMinutes);
      }
    }
  }, [settings]);

  const handleSaveSettings = async () => {
    if (!settings?.userId) return;
    setSaving(true);
    try {
      const updatedSettings: UserSettings = {
        userId: settings.userId,
        salary,
        currency,
        language,
        payDay,
        emergencyCapMonths,
        fiscalYearStart,
        calendarType,
        privacy: {
          hideBalances,
          pinEnabled,
          pinCode,
          autoLockMinutes,
        },
      };

      await setDoc(doc(db, 'settings', settings.userId), updatedSettings);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const currencyOptions = [
    { value: 'ر.س', label: 'ريال سعودي (SAR / ر.س)' },
    { value: '$', label: 'دولار أمريكي (USD / $)' },
    { value: '€', label: 'يورو أوروبي (EUR / €)' },
    { value: 'د.إ', label: 'درهم إماراتي (AED / د.إ)' },
    { value: 'د.ك', label: 'دينار كويتي (KWD / د.ك)' },
    { value: 'ج.م', label: 'جنيه مصري (EGP / ج.م)' },
    { value: 'د.ب', label: 'دينار بحريني (BHD / د.ب)' },
    { value: 'ر.ق', label: 'ريال قطري (QAR / ر.ق)' },
    { value: 'ر.ع', label: 'ريال عماني (OMR / ر.ع)' },
  ];

  const monthOptions = [
    { value: '01', label: 'يناير (الشهر 1 - بداية السنة القياسية)' },
    { value: '02', label: 'فبراير (الشهر 2)' },
    { value: '03', label: 'مارس (الشهر 3)' },
    { value: '04', label: 'أبريل (الشهر 4)' },
    { value: '05', label: 'مايو (الشهر 5)' },
    { value: '06', label: 'يونيو (الشهر 6)' },
    { value: '07', label: 'يوليو (الشهر 7 - بداية النصف الثاني)' },
    { value: '08', label: 'أغسطس (الشهر 8)' },
    { value: '09', label: 'سبتمبر (الشهر 9)' },
    { value: '10', label: 'أكتوبر (الشهر 10)' },
    { value: '11', label: 'نوفمبر (الشهر 11)' },
    { value: '12', label: 'ديسمبر (الشهر 12)' },
    { value: 'hijri_muharram', label: 'غرة محرم (بداية السنة الهجرية)' },
  ];

  // CSV Export Handler
  const downloadCSV = (filename: string, headers: string[], rows: (string | number | undefined)[][]) => {
    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvContent = '\uFEFF' + [
      headers.map(escapeCSV).join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExpensesCSV = () => {
    const headers = ['التاريخ', 'النوع', 'التصنيف', 'البيان / الوصف', 'المبلغ', 'الحساب / طريقة الدفع', 'الملاحظات'];
    const rows = expenses.map(exp => [
      exp.date || '',
      exp.type || 'مصروف',
      exp.category || '',
      exp.description || '',
      exp.amount || 0,
      exp.paymentMethod || '',
      exp.notes || ''
    ]);
    const dateStr = new Date().toISOString().split('T')[0];
    downloadCSV(`ماليتي_العمليات_المالية_${dateStr}.csv`, headers, rows);
  };

  const handleExportTransfersCSV = () => {
    const headers = ['التاريخ', 'من حساب', 'إلى حساب', 'المبلغ', 'الملاحظات'];
    const rows = transactions.map(trans => [
      trans.date || '',
      trans.fromAccount || '',
      trans.toAccount || '',
      trans.amount || 0,
      trans.notes || ''
    ]);
    const dateStr = new Date().toISOString().split('T')[0];
    downloadCSV(`ماليتي_التحويلات_${dateStr}.csv`, headers, rows);
  };

  const handleExportAccountsCSV = () => {
    const headers = ['اسم الحساب / الصندوق', 'النوع', 'الرصيد الفعلي', 'الملاحظات'];
    const rows = accounts.map(acc => [
      acc.name || '',
      acc.type || '',
      acc.balance || 0,
      acc.notes || ''
    ]);
    const dateStr = new Date().toISOString().split('T')[0];
    downloadCSV(`ماليتي_الحسابات_والأرصدة_${dateStr}.csv`, headers, rows);
  };

  const handleExportBudgetCSV = () => {
    const headers = ['البند / الفئة', 'المبلغ المخطط', 'المبلغ الفعلي', 'الشهر / الملاحظات'];
    const currentSalary = salary || settings?.salary || 2500;

    // Find actual accounts for auto deductions
    const debtAcc = accounts.find(a => a.name.includes('الديون'));
    const emergencyAcc = accounts.find(a => a.name.includes('الطوارئ'));
    const savingsAcc = accounts.find(a => a.name.includes('الادخار'));
    const mainAcc = getPrimaryBankAccount(accounts);

    const debtPlanned = Math.round(currentSalary * 0.26); // 650
    const emergencyPlanned = Math.round(currentSalary * 0.16); // 400
    const savingsPlanned = Math.round(currentSalary * 0.12); // 300
    const operationalPlanned = currentSalary - (debtPlanned + emergencyPlanned + savingsPlanned); // 1150

    const debtActual = debtAcc ? (debtAcc.balance || 0) : debtPlanned;
    const emergencyActual = emergencyAcc ? (emergencyAcc.balance || 0) : emergencyPlanned;
    const savingsActual = savingsAcc ? (savingsAcc.balance || 0) : savingsPlanned;
    const operationalActual = mainAcc ? (mainAcc.balance || 0) : operationalPlanned;

    const defaultDistributionRows = [
      ['الراتب الافتراضي الإجمالي', currentSalary, currentSalary, 'الراتب المعتمد المحول للحساب البنكي'],
      ['استقطاع سداد الديون (26%)', debtPlanned, debtActual, 'استقطاع آلي موزّع في صندوق سداد الديون'],
      ['استقطاع صندوق الطوارئ (16%)', emergencyPlanned, emergencyActual, 'استقطاع آلي موزّع في صندوق الطوارئ'],
      ['استقطاع الادخار والاستثمار (12%)', savingsPlanned, savingsActual, 'استقطاع آلي موزّع في صندوق الادخار والاستثمار'],
      ['المصاريف التشغيلية المعيشية (46%)', operationalPlanned, operationalActual, 'الصافي المتاح للمعيشة بالحساب الرئيسي'],
    ];

    const budgetRows = budget.map(b => [
      b.name || '',
      b.planned || 0,
      b.actual || 0,
      b.month || b.notes || ''
    ]);

    const dateStr = new Date().toISOString().split('T')[0];
    downloadCSV(`ماليتي_الميزانية_والتوزيع_${dateStr}.csv`, headers, [...defaultDistributionRows, ...budgetRows]);
  };

  const handleExportAllCSV = () => {
    handleExportExpensesCSV();
    setTimeout(() => handleExportTransfersCSV(), 300);
    setTimeout(() => handleExportAccountsCSV(), 600);
    setTimeout(() => handleExportBudgetCSV(), 900);
  };

  return (
    <div className="space-y-6 pb-12 dir-rtl">
      {/* Top Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Globe className="w-6 h-6" />
            </span>
            إعدادات النظام والتفضيلات المالية
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            خصص تفضيلات العملة، بداية السنة المالية، التنبيهات الذكية، الخصوصية والمزامنة السحابية
          </p>
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 active:scale-95 transition-all shadow-sm disabled:opacity-50"
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : savedSuccess ? (
            <>
              <Check className="w-5 h-5 text-emerald-300" />
              <span>تم الحفظ بنجاح</span>
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              <span>حفظ جميع التغييرات</span>
            </>
          )}
        </button>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('currency')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
            activeTab === 'currency'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>العملة واللغة</span>
        </button>

        <button
          onClick={() => setActiveTab('fiscal')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
            activeTab === 'fiscal'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>بداية السنة المالية</span>
        </button>

        <button
          onClick={() => setActiveTab('backup')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
            activeTab === 'backup'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <CloudDownload className="w-4 h-4" />
          <span>النسخ الاحتياطي والمزامنة</span>
        </button>

        <button
          onClick={() => setActiveTab('privacy')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
            activeTab === 'privacy'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>الخصوصية والأمان</span>
        </button>
      </div>

      {/* Tab 1: Currency & Language */}
      {activeTab === 'currency' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Coins className="w-5 h-5 text-blue-600" />
              العملة الرئيسية والدخل التلقائي
            </h2>
            <p className="text-slate-500 text-sm mt-0.5">
              تحديد العملة الافتراضية لعرض الإحصائيات والحسابات، مع تحديد الراتب الشهرية
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">العملة الرئيسية للتطبيق</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-slate-800 font-medium"
              >
                {currencyOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1.5">
                تطبق هذه العملة كرمز افتراضي في جميع التقارير والميزانيات
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">الراتب / الدخل الشهري الثابت ({currency})</label>
              <input
                type="number"
                value={salary}
                onChange={(e) => setSalary(Number(e.target.value))}
                className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-slate-800 font-semibold"
                placeholder="مثال: 2500"
              />
              <p className="text-xs text-slate-500 font-medium mt-1.5">
                قاعدة التوزيع المعتمدة: يتم تقسيم الراتب تلقائياً إلى 3 اقتطاعات ثابتة، والباقي للمصاريف التشغيلية.
              </p>

              {/* Live Preview Card */}
              <div className="mt-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 text-xs">
                <span className="font-bold text-slate-700 block">معاينة التوزيع التلقائي للراتب ({salary.toLocaleString()} {currency}):</span>
                <div className="grid grid-cols-2 gap-2 text-slate-800 font-semibold">
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    💳 سداد الديون (26%): <span className="font-black text-rose-600">{Math.round(salary * 0.26).toLocaleString()} {currency}</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    🚨 صندوق الطوارئ (16%): <span className="font-black text-purple-600">{Math.round(salary * 0.16).toLocaleString()} {currency}</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    💰 الادخار والاستثمار (12%): <span className="font-black text-blue-600">{Math.round(salary * 0.12).toLocaleString()} {currency}</span>
                  </div>
                  <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-200">
                    🏠 المصاريف التشغيلية والأساسية (46% = الباقي): <span className="font-black text-emerald-700">{(salary - Math.round(salary * 0.54)).toLocaleString()} {currency}</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 font-bold text-center pt-1 border-t border-slate-200/60 mt-1">
                  ⚡ <b>إعادة حساب تلقائية:</b> عند تغيير الراتب (سواء بالزيادة أو النقصان)، يعيد التطبيق حساب المبالغ تلقائياً وفق النسب المحددة دون الحاجة لإعادة ضبط الخطة يدويًا.
                </p>
              </div>
            </div>

            {/* Emergency Cap Shift Config Section */}
            <div className="md:col-span-2 p-5 rounded-2xl bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border border-purple-200/80 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-600 text-white rounded-xl shadow-sm">
                  🛡️
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">إعدادات هدف صندوق الطوارئ</h3>
                  <p className="text-xs text-slate-600">تحديد عدد أشهر التغطية المطلوبة لتأمين الأمان المالي</p>
                </div>
              </div>

              <div className="pt-1">
                <label className="block text-xs font-bold text-slate-800 mb-1.5">هدف تغطية الطوارئ المكتمل</label>
                <select
                  value={emergencyCapMonths}
                  onChange={(e) => setEmergencyCapMonths(Number(e.target.value))}
                  className="w-full p-3 border border-purple-200 rounded-xl bg-white focus:ring-2 focus:ring-purple-500 outline-none text-slate-800 font-bold text-sm"
                >
                  <option value={3}>3 أشهر مصاريف أساسية (تأمين الأمان المالي القياسي)</option>
                  <option value={6}>6 أشهر مصاريف أساسية (الأمان المالي الأقصى)</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1.5 font-medium">
                  المبلغ المستهدف الحسابي = {Math.round(salary * 0.46 * emergencyCapMonths).toLocaleString()} {currency} (تغطية {emergencyCapMonths} أشهر)
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">يوم إيداع الراتب الشهري</label>
              <select
                value={payDay}
                onChange={(e) => setPayDay(Number(e.target.value))}
                className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-slate-800 font-medium"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <option key={day} value={day}>
                    يوم {day} من كل شهر {day === 27 ? '(الموعد القياسي بالمملكة)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">لغة واجهة التطبيق</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setLanguage('ar')}
                  className={`p-3 rounded-xl border font-medium text-sm text-center transition-all ${
                    language === 'ar'
                      ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  العربية (افتراضي)
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`p-3 rounded-xl border font-medium text-sm text-center transition-all ${
                    language === 'en'
                      ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  English
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Fiscal Year Start */}
      {activeTab === 'fiscal' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              تحديد بداية السنة المالية وتفضيلات التقويم
            </h2>
            <p className="text-slate-500 text-sm mt-0.5">
              تحديد بداية الدورة المالية لتنظيم التقارير السنوية وحساب الميزانيات المجمعة
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">بداية السنة المالية</label>
              <select
                value={fiscalYearStart}
                onChange={(e) => setFiscalYearStart(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-slate-800 font-medium"
              >
                {monthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1.5">
                تُبنى جميع التقارير والمقارنات السنوية بناءً على هذا الشهر
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">نوع التقويم المعتمد</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCalendarType('gregorian')}
                  className={`p-3 rounded-xl border font-medium text-sm text-center transition-all ${
                    calendarType === 'gregorian'
                      ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  التقويم الميلادي
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarType('hijri')}
                  className={`p-3 rounded-xl border font-medium text-sm text-center transition-all ${
                    calendarType === 'hijri'
                      ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  التقويم الهجري
                </button>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-amber-800 text-sm">
            <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">تنبيه ذكي:</span> تغيير بداية السنة المالية سيقسّم تقارير الأداء السنوي تلقائياً وفق الفترات الجديدة دون التأثير على أرصدة حساباتك الحالية.
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Backup & Sync */}
      {activeTab === 'backup' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <CloudDownload className="w-5 h-5 text-blue-600" />
              حالة النسخ الاحتياطي والمزامنة السحابية
            </h2>
            <p className="text-slate-500 text-sm mt-0.5">
              بياناتك المالية محمية ومحفوظة سحابياً بشكل فوري ومستمر
            </p>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping"></span>
                  <h3 className="font-bold text-emerald-900 text-sm">المزامنة السحابية الفورية نشطة</h3>
                </div>
                <p className="text-xs text-emerald-700 mt-1">
                  تتم المزامنة تلقائياً مع قاعدة بيانات Firestore المشفرة
                </p>
              </div>
            </div>

            {onNavigateToBackup && (
              <button
                onClick={onNavigateToBackup}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-700 text-white font-medium rounded-xl hover:bg-emerald-800 text-sm transition-all shadow-sm"
              >
                <span>الانتقال لصفحة النسخ المتقدمة</span>
                <ArrowRight className="w-4 h-4 rotate-180" />
              </button>
            )}
          </div>

          <div className="p-4 border border-slate-100 rounded-xl bg-slate-50 space-y-3">
            <h3 className="font-bold text-slate-800 text-sm">نقطة مزامنة شفرية فورية</h3>
            <p className="text-xs text-slate-500">
              يمكنك حفظ حالة النظام الفورية والمزامنة السحابية اليدوية بنقرة زر واحدة.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={handleSaveSettings}
                className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-all shadow-sm"
              >
                حفظ نقطة مزامنة فورية
              </button>
            </div>
          </div>

          {/* CSV Export Section */}
          <div className="p-5 border border-slate-200 rounded-2xl bg-slate-50/70 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  <span>تصدير البيانات المالية إلى CSV (Excel / الجدول)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  قم بتصدير جميع العمليات المالية، التحويلات بين الحسابات، الأرصدة، وتخطيط الميزانية إلى ملفات CSV بأحرف عربية آمنة (UTF-8) للأرشفة الخارجية.
                </p>
              </div>

              <button
                onClick={handleExportAllCSV}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 active:scale-95 transition-all shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>تصدير جميع الملفات دفعة واحدة</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
              {/* Export Expenses */}
              <div className="p-4 bg-white rounded-xl border border-slate-200 flex flex-col justify-between gap-3 shadow-xs hover:border-emerald-300 transition-all">
                <div className="flex items-center gap-2.5 text-slate-800">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs">المصروفات والدخل</h4>
                    <p className="text-[11px] text-slate-400 font-medium">{expenses.length} سجل عملية</p>
                  </div>
                </div>
                <button
                  onClick={handleExportExpensesCSV}
                  className="w-full py-2 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تصدير CSV</span>
                </button>
              </div>

              {/* Export Transfers */}
              <div className="p-4 bg-white rounded-xl border border-slate-200 flex flex-col justify-between gap-3 shadow-xs hover:border-blue-300 transition-all">
                <div className="flex items-center gap-2.5 text-slate-800">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs">التحويلات المالية</h4>
                    <p className="text-[11px] text-slate-400 font-medium">{transactions.length} حركة تحويل</p>
                  </div>
                </div>
                <button
                  onClick={handleExportTransfersCSV}
                  className="w-full py-2 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تصدير CSV</span>
                </button>
              </div>

              {/* Export Accounts */}
              <div className="p-4 bg-white rounded-xl border border-slate-200 flex flex-col justify-between gap-3 shadow-xs hover:border-purple-300 transition-all">
                <div className="flex items-center gap-2.5 text-slate-800">
                  <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs">الأرصدة والحسابات</h4>
                    <p className="text-[11px] text-slate-400 font-medium">{accounts.length} حساب وصندوق</p>
                  </div>
                </div>
                <button
                  onClick={handleExportAccountsCSV}
                  className="w-full py-2 bg-slate-100 hover:bg-purple-50 hover:text-purple-700 text-slate-700 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تصدير CSV</span>
                </button>
              </div>

              {/* Export Budget */}
              <div className="p-4 bg-white rounded-xl border border-slate-200 flex flex-col justify-between gap-3 shadow-xs hover:border-amber-300 transition-all">
                <div className="flex items-center gap-2.5 text-slate-800">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                    <PieChart className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs">الميزانية والتوزيع</h4>
                    <p className="text-[11px] text-slate-400 font-medium">{budget.length + 5} بند توزيع</p>
                  </div>
                </div>
                <button
                  onClick={handleExportBudgetCSV}
                  className="w-full py-2 bg-slate-100 hover:bg-amber-50 hover:text-amber-700 text-slate-700 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تصدير CSV</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Privacy & Security */}
      {activeTab === 'privacy' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              إعدادات الخصوصية والأمان
            </h2>
            <p className="text-slate-500 text-sm mt-0.5">
              حماية معلوماتك المالية وإخفاء الأرصدة الحساسة لمنع التطفل
            </p>
          </div>

          <div className="space-y-5">
            {/* Hide Balances */}
            <div className="p-4 border border-slate-100 rounded-xl bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  {hideBalances ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">إخفاء الأرصدة والمبالغ المالية</h3>
                  <p className="text-xs text-slate-500">استبدال المبالغ بـ (••••••) لحفظ الخصوصية للأماكن العامة</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={hideBalances}
                  onChange={(e) => setHideBalances(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* PIN Passcode Lock */}
            <div className="p-4 border border-slate-100 rounded-xl bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">قفل التطبيق برمز سري (PIN Code)</h3>
                    <p className="text-xs text-slate-500">اشتراط رمز مكون من 4 أرقام عند فتح التطبيق</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pinEnabled}
                    onChange={(e) => {
                      setPinEnabled(e.target.checked);
                      if (e.target.checked) setShowPinInput(true);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {pinEnabled && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-3 border-t border-slate-200/60">
                  <span className="text-xs font-medium text-slate-700">تعيين الرمز السري (4 أرقام):</span>
                  <input
                    type="password"
                    maxLength={4}
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value)}
                    placeholder="••••"
                    className="p-2 border border-slate-300 rounded-lg text-center font-bold tracking-widest text-slate-800 w-28 bg-white"
                  />
                </div>
              )}
            </div>

            {/* Auto-Lock timer */}
            <div className="p-4 border border-slate-100 rounded-xl bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">القفل التلقائي بعد مدة عدم نشاط</h3>
                <p className="text-xs text-slate-500">مدة الخمول المطلوبة قبل إغلاق الواجهة</p>
              </div>
              <select
                value={autoLockMinutes}
                onChange={(e) => setAutoLockMinutes(Number(e.target.value))}
                className="p-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-800 font-medium"
              >
                <option value={1}>دقيقة واحدة</option>
                <option value={5}>5 دقائق</option>
                <option value={15}>15 دقيقة</option>
                <option value={0}>إيقاف القفل التلقائي</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
