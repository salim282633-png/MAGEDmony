/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  FinancialProjectionResult,
  ProjectedMonth,
  ProjectedYearSummary,
  SimulationMilestones,
  DebtItem,
  AccountItem
} from '../types';

export interface CurrentRealityParams {
  currentSavings: number;
  currentEmergency: number;
  currentDebtFund: number;
  currentOtherAssets: number;
  totalRemainingDebt: number;
  baseSalary: number;
  emergencyCapMonths?: number;
}

export interface ScenarioSimulationOptions {
  annualSalaryGrowthPct?: number; // e.g. 0% to 20% (default 0%)
  extraMonthlyIncome?: number; // e.g. 0 to 5000 (default 0)
  annualInvestmentReturnPct?: number; // e.g. 0% to 15% (default 0%, strictly estimated)
  totalMonths?: number; // default 120 (10 years)
  startDate?: Date; // default current date
}

const ARABIC_MONTH_NAMES = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

/**
 * Formats month index into Arabic month and year label
 */
export function formatArabicMonthYear(startDate: Date, monthIndex: number): string {
  // monthIndex: 0 = start month, 1 = start month + 1, etc.
  const d = new Date(startDate.getFullYear(), startDate.getMonth() + monthIndex, 1);
  const monthName = ARABIC_MONTH_NAMES[d.getMonth()];
  const year = d.getFullYear();
  return `${monthName} ${year}`;
}

/**
 * Canonical Emergency Target Calculation
 * Rule: 3 × Monthly Living Allocation (where living allocation = 46% of salary)
 */
export function calculateEmergencyTarget(
  monthlySalary: number,
  emergencyCapMonths: number = 3
): number {
  const safeSalary = Math.max(0, monthlySalary);
  const monthlyLivingAllocation = Math.round(safeSalary * 0.46);
  return monthlyLivingAllocation * emergencyCapMonths;
}

/**
 * Canonical Smart Redirect Allocation Rule for a Single Month/Salary
 */
export function calculateSmartSalaryAllocation(params: {
  salary: number;
  isDebtFree: boolean;
  isEmergencyComplete: boolean;
}) {
  const { salary, isDebtFree, isEmergencyComplete } = params;
  const safeSalary = Math.max(0, salary);

  let debtPct = 26;
  let emergencyPct = 16;
  let savingsPct = 12;
  const livingPct = 46;

  if (isDebtFree && isEmergencyComplete) {
    debtPct = 0;
    emergencyPct = 0;
    savingsPct = 54;
  } else if (isDebtFree) {
    debtPct = 0;
    emergencyPct = 16 + 26; // 42%
    savingsPct = 12;
  } else if (isEmergencyComplete) {
    debtPct = 26;
    emergencyPct = 0;
    savingsPct = 12 + 16; // 28%
  }

  const debtAmount = Math.round(safeSalary * (debtPct / 100));
  const emergencyAmount = Math.round(safeSalary * (emergencyPct / 100));
  const savingsAmount = Math.round(safeSalary * (savingsPct / 100));
  const operationalAmount = safeSalary - debtAmount - emergencyAmount - savingsAmount;
  const operationalPct = safeSalary > 0 ? Math.round((operationalAmount / safeSalary) * 100) : livingPct;

  return {
    debtPct,
    emergencyPct,
    savingsPct,
    livingPct: operationalPct,
    debtAmount,
    emergencyAmount,
    savingsAmount,
    operationalAmount
  };
}

/**
 * Extracts current financial reality snapshot from user's accounts, debts, and settings
 */
export function extractCurrentReality(params: {
  accounts: AccountItem[];
  debts: DebtItem[];
  baseSalary: number;
  emergencyCapMonths?: number;
}): CurrentRealityParams {
  const { accounts, debts, baseSalary, emergencyCapMonths = 3 } = params;

  // 1. Savings / Investment Accounts
  const savingsAccounts = accounts.filter(a => 
    !a.isArchived && (
      a.name.includes('الادخار') || 
      a.name.includes('استثمار') || 
      a.type === 'المحافظ الاستثمارية'
    )
  );
  const currentSavings = savingsAccounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

  // 2. Emergency Account
  const emergencyAccount = accounts.find(a => 
    !a.isArchived && (a.name.includes('طوارئ') || a.name.includes('الطوارئ'))
  );
  const currentEmergency = Number(emergencyAccount?.balance) || 0;

  // 3. Debt Fund Account
  const debtFundAccount = accounts.find(a => 
    !a.isArchived && (a.name.includes('الديون') || a.name.includes('ديون'))
  );
  const currentDebtFund = Number(debtFundAccount?.balance) || 0;

  // 4. Other liquid accounts (Main bank, Cash, Wallets)
  const otherAccounts = accounts.filter(a => 
    !a.isArchived && 
    a !== emergencyAccount && 
    a !== debtFundAccount && 
    !savingsAccounts.includes(a)
  );
  const currentOtherAssets = otherAccounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

  // 5. Total remaining debt: sum of (totalAmount - paidAmount) across all debts
  const totalDebtsRaw = debts.reduce((sum, d) => {
    const remaining = Math.max(0, (Number(d.totalAmount) || 0) - (Number(d.paidAmount) || 0));
    return sum + remaining;
  }, 0);

  // Net remaining debt taking into account already accumulated debt fund balance
  const totalRemainingDebt = Math.max(0, totalDebtsRaw - currentDebtFund);

  return {
    currentSavings: Math.max(0, currentSavings),
    currentEmergency: Math.max(0, currentEmergency),
    currentDebtFund: Math.max(0, currentDebtFund),
    currentOtherAssets: Math.max(0, currentOtherAssets),
    totalRemainingDebt,
    baseSalary: Math.max(0, baseSalary),
    emergencyCapMonths
  };
}

/**
 * Core 120-Month Financial Projection Simulation Engine
 * Executes month-by-month financial waterfall matching real MAGEDmony business logic.
 */
export function simulateFinancialProjection(
  reality: CurrentRealityParams,
  options: ScenarioSimulationOptions = {}
): FinancialProjectionResult {
  const {
    annualSalaryGrowthPct = 0,
    extraMonthlyIncome = 0,
    annualInvestmentReturnPct = 0,
    totalMonths = 120,
    startDate = new Date()
  } = options;

  const emergencyCapMonths = reality.emergencyCapMonths || 3;
  const initialRemainingDebt = reality.totalRemainingDebt;
  const initialEmergency = reality.currentEmergency;
  const initialSavings = reality.currentSavings;
  const initialOtherAssets = reality.currentOtherAssets;

  // Year 0 reality metrics
  const initialLiquidAssets = initialSavings + initialEmergency + initialOtherAssets;
  const initialNetWorth = initialLiquidAssets - initialRemainingDebt;
  const initialEmergencyTarget = calculateEmergencyTarget(reality.baseSalary, emergencyCapMonths);

  const isAlreadyDebtFree = initialRemainingDebt <= 0;
  const isAlreadyEmergencyComplete = initialEmergency >= initialEmergencyTarget;

  let runningDebt = initialRemainingDebt;
  let runningEmergency = initialEmergency;
  let runningSavings = initialSavings;

  let debtFreeMonth: number | null = isAlreadyDebtFree ? 0 : null;
  let emergencyCompleteMonth: number | null = isAlreadyEmergencyComplete ? 0 : null;
  let savings54Month: number | null = (isAlreadyDebtFree && isAlreadyEmergencyComplete) ? 0 : null;

  const timelineMonths: ProjectedMonth[] = [];
  const monthlyRate = annualInvestmentReturnPct > 0 
    ? Math.pow(1 + annualInvestmentReturnPct / 100, 1 / 12) - 1 
    : 0;

  for (let m = 1; m <= totalMonths; m++) {
    // Determine annual salary growth based on completed years
    const yearIndex = Math.floor((m - 1) / 12) + 1; // 1 to 10
    const completedYears = Math.floor((m - 1) / 12);
    
    const currentYearSalary = Math.round(
      reality.baseSalary * Math.pow(1 + annualSalaryGrowthPct / 100, completedYears)
    );
    const totalMonthlyIncome = currentYearSalary + extraMonthlyIncome;

    // 1. Living Allocation (46%)
    const livingAllocation = Math.round(totalMonthlyIncome * 0.46);
    const distributablePool = totalMonthlyIncome - livingAllocation; // ~54%

    // 2. Emergency Target for current year salary
    const currentEmergencyTarget = calculateEmergencyTarget(currentYearSalary, emergencyCapMonths);

    // 3. Base percentages & pool breakdown
    const baseDebtAllocation = Math.round(totalMonthlyIncome * 0.26);
    const baseEmergencyAllocation = Math.round(totalMonthlyIncome * 0.16);
    const baseSavingsAllocation = distributablePool - baseDebtAllocation - baseEmergencyAllocation;

    // 4. Waterfall resolution
    // Step A: Debt
    let actualDebtAllocation = 0;
    let debtSurplus = 0;

    if (runningDebt > 0) {
      actualDebtAllocation = Math.min(baseDebtAllocation, runningDebt);
      runningDebt -= actualDebtAllocation;
      debtSurplus = baseDebtAllocation - actualDebtAllocation;
    } else {
      actualDebtAllocation = 0;
      debtSurplus = baseDebtAllocation;
    }

    // Step B: Emergency
    let actualEmergencyAllocation = 0;
    let emergencySurplus = 0;
    const availableForEmergency = baseEmergencyAllocation + debtSurplus;
    const emergencyNeeded = Math.max(0, currentEmergencyTarget - runningEmergency);

    if (emergencyNeeded > 0) {
      actualEmergencyAllocation = Math.min(availableForEmergency, emergencyNeeded);
      runningEmergency += actualEmergencyAllocation;
      emergencySurplus = availableForEmergency - actualEmergencyAllocation;
    } else {
      actualEmergencyAllocation = 0;
      emergencySurplus = availableForEmergency;
    }

    // Step C: Savings & Investment
    const actualSavingsAllocation = baseSavingsAllocation + emergencySurplus;
    
    // Step D: Investment Gains (optional, strictly on savings balance)
    let investmentGains = 0;
    if (monthlyRate > 0) {
      investmentGains = Math.round(runningSavings * monthlyRate);
    }
    runningSavings += actualSavingsAllocation + investmentGains;

    // Track Milestone Triggers
    const isDebtFreeNow = runningDebt <= 0;
    const isEmergencyCompleteNow = runningEmergency >= currentEmergencyTarget;
    const is54SavingsNow = isDebtFreeNow && isEmergencyCompleteNow;

    if (isDebtFreeNow && debtFreeMonth === null) {
      debtFreeMonth = m;
    }
    if (isEmergencyCompleteNow && emergencyCompleteMonth === null) {
      emergencyCompleteMonth = m;
    }
    if (is54SavingsNow && savings54Month === null) {
      savings54Month = m;
    }

    // Balances and Metrics
    const liquidAssets = runningSavings + runningEmergency + initialOtherAssets;
    const netWorth = liquidAssets - runningDebt;
    const cumulativeDebtPaid = Math.max(0, initialRemainingDebt - runningDebt);

    // Active percentages for this specific month
    const debtPct = totalMonthlyIncome > 0 ? Math.round((actualDebtAllocation / totalMonthlyIncome) * 100) : 0;
    const emergencyPct = totalMonthlyIncome > 0 ? Math.round((actualEmergencyAllocation / totalMonthlyIncome) * 100) : 0;
    const savingsPct = totalMonthlyIncome > 0 ? Math.round((actualSavingsAllocation / totalMonthlyIncome) * 100) : 0;
    const livingPct = totalMonthlyIncome > 0 ? Math.round((livingAllocation / totalMonthlyIncome) * 100) : 46;

    const dateLabel = formatArabicMonthYear(startDate, m);

    timelineMonths.push({
      monthIndex: m,
      yearIndex,
      dateLabel,
      salary: currentYearSalary,
      extraIncome: extraMonthlyIncome,
      totalIncome: totalMonthlyIncome,
      livingAllocation,
      debtAllocation: actualDebtAllocation,
      emergencyAllocation: actualEmergencyAllocation,
      savingsAllocation: actualSavingsAllocation,
      investmentGains,
      livingPct,
      debtPct,
      emergencyPct,
      savingsPct,
      remainingDebt: runningDebt,
      cumulativeDebtPaid,
      emergencyBalance: runningEmergency,
      savingsBalance: runningSavings,
      liquidAssets,
      netWorth,
      isDebtFreeMonth: debtFreeMonth === m,
      isEmergencyCompleteMonth: emergencyCompleteMonth === m,
      is54SavingsMonth: savings54Month === m
    });
  }

  // Generate Year 0 to 10 Rollup Summaries
  const timelineYears: ProjectedYearSummary[] = [];

  // Year 0: Exact current reality
  const year0Salary = reality.baseSalary;
  const year0Smart = calculateSmartSalaryAllocation({
    salary: year0Salary,
    isDebtFree: isAlreadyDebtFree,
    isEmergencyComplete: isAlreadyEmergencyComplete
  });

  timelineYears.push({
    year: 0,
    yearLabel: 'اليوم',
    monthsCount: 0,
    annualSalary: year0Salary * 12,
    netWorth: initialNetWorth,
    liquidAssets: initialLiquidAssets,
    savingsBalance: initialSavings,
    emergencyBalance: initialEmergency,
    remainingDebt: initialRemainingDebt,
    cumulativeDebtPaid: 0,
    livingPct: year0Smart.livingPct,
    debtPct: year0Smart.debtPct,
    emergencyPct: year0Smart.emergencyPct,
    savingsPct: year0Smart.savingsPct
  });

  // Years 1 to 10
  for (let y = 1; y <= 10; y++) {
    const monthEndIndex = y * 12;
    const monthData = timelineMonths[monthEndIndex - 1];

    timelineYears.push({
      year: y,
      yearLabel: `سنة ${y}`,
      monthsCount: monthEndIndex,
      annualSalary: monthData.salary * 12,
      netWorth: monthData.netWorth,
      liquidAssets: monthData.liquidAssets,
      savingsBalance: monthData.savingsBalance,
      emergencyBalance: monthData.emergencyBalance,
      remainingDebt: monthData.remainingDebt,
      cumulativeDebtPaid: monthData.cumulativeDebtPaid,
      livingPct: monthData.livingPct,
      debtPct: monthData.debtPct,
      emergencyPct: monthData.emergencyPct,
      savingsPct: monthData.savingsPct
    });
  }

  // Milestones formatting
  const milestones: SimulationMilestones = {
    debtFreeMonth,
    debtFreeDate: debtFreeMonth !== null && debtFreeMonth > 0 
      ? formatArabicMonthYear(startDate, debtFreeMonth) 
      : (isAlreadyDebtFree ? 'الديون مكتملة حالياً' : null),
    isAlreadyDebtFree,

    emergencyCompleteMonth,
    emergencyCompleteDate: emergencyCompleteMonth !== null && emergencyCompleteMonth > 0 
      ? formatArabicMonthYear(startDate, emergencyCompleteMonth) 
      : (isAlreadyEmergencyComplete ? 'صندوق الطوارئ مكتمل حالياً' : null),
    isAlreadyEmergencyComplete,

    savings54Month,
    savings54Date: savings54Month !== null && savings54Month > 0 
      ? formatArabicMonthYear(startDate, savings54Month) 
      : ((isAlreadyDebtFree && isAlreadyEmergencyComplete) ? 'مفعل حالياً (54%)' : null)
  };

  const finalMonth = timelineMonths[timelineMonths.length - 1];

  return {
    timelineMonths,
    timelineYears,
    milestones,
    initialReality: {
      savingsBalance: initialSavings,
      emergencyBalance: initialEmergency,
      debtFundBalance: reality.currentDebtFund,
      otherAssetsBalance: initialOtherAssets,
      initialRemainingDebt,
      initialLiquidAssets,
      initialNetWorth,
      emergencyTarget: initialEmergencyTarget
    },
    final10Year: {
      netWorth: finalMonth.netWorth,
      liquidAssets: finalMonth.liquidAssets,
      savingsBalance: finalMonth.savingsBalance,
      emergencyBalance: finalMonth.emergencyBalance,
      remainingDebt: finalMonth.remainingDebt,
      totalDebtPaid: finalMonth.cumulativeDebtPaid,
      finalSavingsPct: finalMonth.savingsPct
    }
  };
}
