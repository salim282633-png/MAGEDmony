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
  initialized?: boolean;
  onboardingCompleted?: boolean;
  bankAccountMigrationVersion?: number;
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
  accountId?: string; // Linked Account ID
  tags?: string[]; // الوسوم
  location?: string; // الموقع (اختياري)
  notes?: string;
  referenceId?: string; // Unique reference for batch or linked processes
  idempotencyKey?: string;
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
  paymentAccountId?: string;
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
  isPrimaryBank?: boolean;
  role?: 'primary_bank' | 'dedicated_fund' | 'wallet' | 'other';
  notes?: string;
  icon?: string;
  color?: string;
}

export interface Transaction {
  id?: string;
  userId: string;
  fromAccount: string;
  fromAccountId?: string;
  toAccount: string;
  toAccountId?: string;
  amount: number;
  date: string;
  notes?: string;
  referenceId?: string;
  idempotencyKey?: string;
}

/**
 * Standard resolver for the Single Primary Bank Account ("بنك الشامل")
 */
export function getPrimaryBankAccount(accounts: AccountItem[]): AccountItem | undefined {
  return (
    accounts.find(a => a.isPrimaryBank && !a.isArchived) ||
    accounts.find(a => a.name === 'بنك الشامل' && !a.isArchived) ||
    accounts.find(a => a.isPrimaryBank) ||
    accounts.find(a => a.name === 'بنك الشامل') ||
    accounts.find(a => a.type === 'الحساب البنكي' && !a.isArchived) ||
    accounts.find(a => a.type === 'الحساب البنكي') ||
    accounts.find(a => a.name.includes('الرئيسي') && !a.isArchived) ||
    accounts.find(a => a.name.includes('الرئيسي'))
  );
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

export interface SalaryDistributionRecord {
  id?: string;
  userId: string;
  month: string; // YYYY-MM
  salaryAmount: number;
  allocations: {
    debtAmount: number;
    debtPct: number;
    emergencyAmount: number;
    emergencyPct: number;
    savingsAmount: number;
    savingsPct: number;
    operationalAmount: number;
    operationalPct: number;
  };
  createdAt: string;
  referenceId: string;
}

export interface ProjectedMonth {
  monthIndex: number; // 1 to 120
  yearIndex: number; // 1 to 10
  dateLabel: string; // e.g. "أكتوبر 2026"
  salary: number;
  extraIncome: number;
  totalIncome: number;
  
  // Allocations for this specific month
  livingAllocation: number;
  debtAllocation: number;
  emergencyAllocation: number;
  savingsAllocation: number;
  investmentGains: number;

  // Active percentage rates for this month
  livingPct: number;
  debtPct: number;
  emergencyPct: number;
  savingsPct: number;

  // End of month balances
  remainingDebt: number;
  cumulativeDebtPaid: number;
  emergencyBalance: number;
  savingsBalance: number;
  liquidAssets: number;
  netWorth: number;

  // Milestone flags reached in this month
  isDebtFreeMonth: boolean;
  isEmergencyCompleteMonth: boolean;
  is54SavingsMonth: boolean;
}

export interface ProjectedYearSummary {
  year: number; // 0 to 10
  yearLabel: string; // "اليوم", "سنة 1", "سنة 2", etc.
  monthsCount: number; // 0, 12, 24, ..., 120
  annualSalary: number;
  netWorth: number;
  liquidAssets: number;
  savingsBalance: number;
  emergencyBalance: number;
  remainingDebt: number;
  cumulativeDebtPaid: number;
  
  // Stage percentages for this year snapshot
  livingPct: number;
  debtPct: number;
  emergencyPct: number;
  savingsPct: number;
}

export interface SimulationMilestones {
  debtFreeMonth: number | null; // Month index or null if not within 120 months (0 if already free)
  debtFreeDate: string | null;
  isAlreadyDebtFree: boolean;

  emergencyCompleteMonth: number | null;
  emergencyCompleteDate: string | null;
  isAlreadyEmergencyComplete: boolean;

  savings54Month: number | null;
  savings54Date: string | null;
}

export interface FinancialProjectionResult {
  timelineMonths: ProjectedMonth[];
  timelineYears: ProjectedYearSummary[];
  milestones: SimulationMilestones;
  
  // Initial Year 0 State
  initialReality: {
    savingsBalance: number;
    emergencyBalance: number;
    debtFundBalance: number;
    otherAssetsBalance: number;
    initialRemainingDebt: number;
    initialLiquidAssets: number;
    initialNetWorth: number;
    emergencyTarget: number;
  };

  // Final 10-Year (Month 120) Snapshot
  final10Year: {
    netWorth: number;
    liquidAssets: number;
    savingsBalance: number;
    emergencyBalance: number;
    remainingDebt: number;
    totalDebtPaid: number;
    finalSavingsPct: number;
  };
}

