/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PrivacySettings {
  hideBalances: boolean;
  pinEnabled: boolean;
  pinCode?: string;
  autoLockMinutes: number;
}

export interface UserSettings {
  userId: string;
  salary: number;
  currency: string;
  language?: 'ar' | 'en';
  fiscalYearStart?: string;
  calendarType?: 'gregorian' | 'hijri';
  payDay?: number;
  emergencyCapMonths?: number; // Target months for emergency fund (3 or 6)
  privacy?: PrivacySettings;
}

export interface BudgetItem {
  id?: string;
  userId: string;
  month: string; // YYYY-MM
  name: string;
  planned: number;
  actual: number;
  notes?: string;
}

export interface DebtItem {
  id?: string;
  userId: string;
  name: string;
  totalAmount: number;
  paidAmount: number;
  monthlyPayment?: number;
  status: 'تم' | 'متأخر' | 'قيد الانتظار';
  dueDate?: string;
}

export interface SavingsRecord {
  id?: string;
  userId: string;
  month: string;
  savingsPlanned: number;
  savingsActual: number;
  emergencyPlanned: number;
  emergencyActual: number;
}

export type TransactionType = 'دخل' | 'مصروف';

export type IncomeCategory = 'الراتب' | 'دخل إضافي' | 'عمل إضافي' | 'عمولة' | 'مكافأة' | 'الأرباح' | 'المكافآت' | 'الهدايا' | 'مصادر أخرى';

export type ExpenseCategory = 
  | 'الطعام' 
  | 'السكن' 
  | 'المواصلات' 
  | 'الوقود' 
  | 'التسوق' 
  | 'الصحة' 
  | 'التعليم' 
  | 'الترفيه' 
  | 'الفواتير' 
  | 'الاشتراكات' 
  | 'السفر' 
  | 'أخرى';

export type ExtraIncomeAllocation = 
  | 'living' 
  | 'debt' 
  | 'emergency' 
  | 'savings' 
  | 'salary_split' 
  | 'unallocated';

export interface Expense {
  id?: string;
  userId: string;
  type?: TransactionType; // 'دخل' | 'مصروف' (defaults to 'مصروف')
  date: string;
  category: IncomeCategory | ExpenseCategory | string;
  description: string;
  amount: number;
  paymentMethod: string; // Account Name
  tags?: string[]; // الوسوم
  location?: string; // الموقع (اختياري)
  notes?: string;
  extraIncomeAllocation?: ExtraIncomeAllocation;
  allocatedAmounts?: {
    living?: number;
    debt?: number;
    emergency?: number;
    savings?: number;
    unallocated?: number;
  };
}

export type InvestmentType = 'الأسهم' | 'الصناديق' | 'العملات الرقمية' | 'الذهب' | 'العقار';

export interface InvestmentItem {
  id?: string;
  userId: string;
  name: string;
  type: InvestmentType;
  cost: number; // التكلفة
  currentValue: number; // القيمة الحالية
  annualReturn: number; // العائد السنوي %
  quantity?: number; // الكمية / عدد الأسهم أو الوحدات (اختياري)
  currency: string; // العملة
  notes?: string;
}

export type BillCategory = 'الكهرباء' | 'الماء' | 'الإنترنت' | 'الهاتف' | 'نتفليكس' | 'ChatGPT' | 'التأمين' | 'الإيجار' | 'اشتراك آخر';
export type BillingCycle = 'شهري' | 'سنوي' | 'أسبوعي' | 'مرة واحدة';
export type PaymentStatus = 'مدفوع' | 'غير مدفوع' | 'مستحق قريباً';

export interface SubscriptionBill {
  id?: string;
  userId: string;
  name: string; // اسم الفاتورة أو الاشتراك
  category: BillCategory;
  amount: number;
  currency: string;
  dueDate: string; // تاريخ الاستحقاق YYYY-MM-DD
  cycle: BillingCycle;
  status: PaymentStatus;
  reminderDaysBefore: number; // تذكير قبل كم يوم
  isReminderActive: boolean;
  paymentAccount?: string; // الحساب الافتراضي للدفع
  lastPaidDate?: string;
  notes?: string;
}

export type TaskStatus = 'لم يبدأ' | 'جاري التنفيذ' | 'مكتمل' | 'مؤجل';
export type TaskPriority = 'عالية' | 'متوسطة' | 'منخفضة';

export interface Task {
  id?: string;
  userId: string;
  title: string;
  date: string;
  deadline?: string;
  priority: TaskPriority;
  status: TaskStatus;
  completion: number;
  notes?: string;
}

export type AccountType = 'نقد' | 'الحساب البنكي' | 'جاري' | 'المحافظ الإلكترونية' | 'البطاقات الائتمانية' | 'المحافظ الاستثمارية' | 'حسابات العملات المختلفة' | 'صندوق مخصص';

export interface AccountItem {
  id?: string;
  userId: string;
  name: string;
  type: AccountType;
  balance: number;
  openingBalance?: number;
  openingDate?: string;
  currency: string;
  accountNumber?: string;
  isArchived: boolean;
  notes?: string;
  icon?: string;
  color?: string;
}

export interface Transaction {
  id?: string;
  userId: string;
  fromAccount: string;
  toAccount: string;
  amount: number;
  date: string;
  notes?: string;
}

export interface FinancialGoal {
  id?: string;
  userId: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  status: 'لم يبدأ' | 'جاري التنفيذ' | 'مكتمل';
}

export interface FinancialEvent {
  id?: string;
  userId: string;
  title: string;
  date: string;
  amount?: number;
  type?: string;
  notes?: string;
}

export interface DashboardStats {
  totalSalary: number;
  totalExpenses: number;
  remaining: number;
  totalDebt: number;
  debtRepaid: number;
  debtRepaymentPercent: number;
  totalSavings: number;
  totalEmergency: number;
  adherenceRate: number;
}

export type SurplusAllocationChoice = 'rollover' | 'emergency' | 'savings' | 'debt';

export interface MonthlyClosure {
  id?: string;
  userId: string;
  month: string; // e.g. "2026-08"
  closedAt: string;
  salary: number;
  totalIncome?: number;
  livingBudget: number;
  baseLivingBudget?: number;
  extraIncomeTotal?: number;
  extraIncomeLiving?: number;
  actualExpenses: number;
  surplusOrDeficit: number;
  isDeficit: boolean;
  allocationChoice?: SurplusAllocationChoice | null;
  allocationAmount?: number;
  allocationNotes?: string;
  fundBalances?: Record<string, number>;
  status: 'closed';
}
