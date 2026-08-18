/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  simulateFinancialProjection,
  calculateEmergencyTarget,
  calculateSmartSalaryAllocation,
  extractCurrentReality
} from './financialProjection';

describe('Financial Projection Engine', () => {
  it('1. Debt 10,000 and salary 2,500: Debt allocation stops after debt is paid', () => {
    // Salary 2,500 -> 26% debt allocation = 650/month
    // Initial debt = 10,000
    // Months to pay: 10,000 / 650 = 15.38 -> Month 16
    const result = simulateFinancialProjection({
      baseSalary: 2500,
      totalRemainingDebt: 10000,
      currentEmergency: 0,
      currentSavings: 0,
      currentDebtFund: 0,
      currentOtherAssets: 0,
      emergencyCapMonths: 3
    });

    expect(result.milestones.debtFreeMonth).toBe(16);
    // In month 16, debt remaining should be 0
    expect(result.timelineMonths[15].remainingDebt).toBe(0);
    // In month 17, debt allocation should be 0
    expect(result.timelineMonths[16].debtAllocation).toBe(0);
  });

  it('2. After debt is paid, 26% redirects to Emergency fund if not complete', () => {
    // Initial: debt = 1,300 (paid in 2 months at 650/mo), emergency = 0
    // Salary 2,500 -> 26% = 650, 16% = 400
    // In month 3, emergency should receive base 400 + redirected 650 = 1050 (42%)
    const result = simulateFinancialProjection({
      baseSalary: 2500,
      totalRemainingDebt: 1300,
      currentEmergency: 0,
      currentSavings: 0,
      currentDebtFund: 0,
      currentOtherAssets: 0,
      emergencyCapMonths: 3
    });

    expect(result.timelineMonths[0].debtAllocation).toBe(650);
    expect(result.timelineMonths[1].debtAllocation).toBe(650);
    expect(result.timelineMonths[1].remainingDebt).toBe(0);

    // Month 3: Debt is 0, Emergency gets 26% + 16% = 42% = 1050
    expect(result.timelineMonths[2].debtAllocation).toBe(0);
    expect(result.timelineMonths[2].emergencyAllocation).toBe(1050);
  });

  it('3. After emergency fund is complete, 16% redirects to savings', () => {
    // Target emergency = 3 * (2500 * 0.46) = 3 * 1150 = 3450
    // Start with emergency already full (3500), debt = 2000
    const result = simulateFinancialProjection({
      baseSalary: 2500,
      totalRemainingDebt: 2000,
      currentEmergency: 3450,
      currentSavings: 1000,
      currentDebtFund: 0,
      currentOtherAssets: 0,
      emergencyCapMonths: 3
    });

    // Emergency should receive 0, and savings should receive 12% (300) + 16% (400) = 700 (28%)
    expect(result.timelineMonths[0].emergencyAllocation).toBe(0);
    expect(result.timelineMonths[0].savingsAllocation).toBe(700);
    expect(result.timelineMonths[0].debtAllocation).toBe(650);
  });

  it('4. After both debt and emergency are complete, savings becomes 54%', () => {
    // Both 0 debt and full emergency
    const result = simulateFinancialProjection({
      baseSalary: 2500,
      totalRemainingDebt: 0,
      currentEmergency: 3450,
      currentSavings: 5000,
      currentDebtFund: 0,
      currentOtherAssets: 0,
      emergencyCapMonths: 3
    });

    // Living = 46% (1150), Savings = 54% (1350)
    expect(result.timelineMonths[0].livingAllocation).toBe(1150);
    expect(result.timelineMonths[0].debtAllocation).toBe(0);
    expect(result.timelineMonths[0].emergencyAllocation).toBe(0);
    expect(result.timelineMonths[0].savingsAllocation).toBe(1350);
    expect(result.timelineMonths[0].savingsPct).toBe(54);
  });

  it('5. Debt payment does not exceed remaining debt and redirects intra-month surplus', () => {
    // Debt = 200, Base debt = 650 -> Only 200 is paid, 450 surplus moves to emergency
    const result = simulateFinancialProjection({
      baseSalary: 2500,
      totalRemainingDebt: 200,
      currentEmergency: 0,
      currentSavings: 0,
      currentDebtFund: 0,
      currentOtherAssets: 0,
      emergencyCapMonths: 3
    });

    expect(result.timelineMonths[0].debtAllocation).toBe(200);
    expect(result.timelineMonths[0].remainingDebt).toBe(0);
    // Emergency gets base 400 + surplus 450 = 850
    expect(result.timelineMonths[0].emergencyAllocation).toBe(850);
  });

  it('6. Emergency fund does not exceed target without redirecting surplus to savings', () => {
    // Target = 3450, Current = 3400 (needs only 50)
    // Available for emergency = 400 -> 50 used for emergency, 350 surplus sent to savings
    const result = simulateFinancialProjection({
      baseSalary: 2500,
      totalRemainingDebt: 0,
      currentEmergency: 3400,
      currentSavings: 0,
      currentDebtFund: 0,
      currentOtherAssets: 0,
      emergencyCapMonths: 3
    });

    expect(result.timelineMonths[0].emergencyAllocation).toBe(50);
    expect(result.timelineMonths[0].emergencyBalance).toBe(3450);
    // Savings gets base 300 + debt surplus 650 + emg surplus 350 = 1300 (52%)
    expect(result.timelineMonths[0].savingsAllocation).toBe(1300);
  });

  it('7. Starts from current real balances (Year 0 snapshot)', () => {
    const result = simulateFinancialProjection({
      baseSalary: 3000,
      totalRemainingDebt: 5000,
      currentEmergency: 2000,
      currentSavings: 4000,
      currentDebtFund: 500,
      currentOtherAssets: 1000,
      emergencyCapMonths: 3
    });

    expect(result.timelineYears[0].year).toBe(0);
    expect(result.timelineYears[0].savingsBalance).toBe(4000);
    expect(result.timelineYears[0].emergencyBalance).toBe(2000);
    expect(result.timelineYears[0].remainingDebt).toBe(5000);
    expect(result.timelineYears[0].liquidAssets).toBe(4000 + 2000 + 1000);
    expect(result.timelineYears[0].netWorth).toBe(7000 - 5000);
  });

  it('8. Net worth increases as debt is paid down', () => {
    const result = simulateFinancialProjection({
      baseSalary: 2500,
      totalRemainingDebt: 5000,
      currentEmergency: 0,
      currentSavings: 0,
      currentDebtFund: 0,
      currentOtherAssets: 0
    });

    const month0NetWorth = result.initialReality.initialNetWorth; // -5000
    const month1NetWorth = result.timelineMonths[0].netWorth;
    const month12NetWorth = result.timelineMonths[11].netWorth;

    expect(month1NetWorth).toBeGreaterThan(month0NetWorth);
    expect(month12NetWorth).toBeGreaterThan(month1NetWorth);
  });

  it('9. Progress does not decrease when debt fund is used in extraction', () => {
    // If total debts raw = 10,000 and debt fund = 2,000, net remaining debt is 8,000
    const reality = extractCurrentReality({
      accounts: [
        { userId: 'u1', name: 'صندوق سداد الديون', type: 'صندوق مخصص', balance: 2000, currency: 'ريال سعودي', isArchived: false },
        { userId: 'u1', name: 'صندوق الادخار', type: 'صندوق مخصص', balance: 1000, currency: 'ريال سعودي', isArchived: false }
      ],
      debts: [
        { userId: 'u1', name: 'قرض', totalAmount: 10000, paidAmount: 0, status: 'قيد الانتظار' }
      ],
      baseSalary: 2500
    });

    expect(reality.totalRemainingDebt).toBe(8000);
    expect(reality.currentDebtFund).toBe(2000);
  });

  it('10. Annual salary growth applies correctly in subsequent years', () => {
    const result = simulateFinancialProjection(
      {
        baseSalary: 1000,
        totalRemainingDebt: 0,
        currentEmergency: 2000,
        currentSavings: 0,
        currentDebtFund: 0,
        currentOtherAssets: 0
      },
      { annualSalaryGrowthPct: 10 }
    );

    // Year 1 (Months 1-12): Salary = 1000
    expect(result.timelineMonths[0].salary).toBe(1000);
    expect(result.timelineMonths[11].salary).toBe(1000);

    // Year 2 (Months 13-24): Salary = 1000 * 1.10 = 1100
    expect(result.timelineMonths[12].salary).toBe(1100);

    // Year 3 (Months 25-36): Salary = 1000 * 1.10^2 = 1210
    expect(result.timelineMonths[24].salary).toBe(1210);
  });

  it('11. Extra monthly income is properly accounted for in waterfall', () => {
    const result = simulateFinancialProjection(
      {
        baseSalary: 2000,
        totalRemainingDebt: 0,
        currentEmergency: 3000,
        currentSavings: 0,
        currentDebtFund: 0,
        currentOtherAssets: 0
      },
      { extraMonthlyIncome: 500 }
    );

    // Total income = 2500
    // Living (46%) = 1150, Savings (54%) = 1350
    expect(result.timelineMonths[0].totalIncome).toBe(2500);
    expect(result.timelineMonths[0].livingAllocation).toBe(1150);
    expect(result.timelineMonths[0].savingsAllocation).toBe(1350);
  });

  it('12. 0% investment return produces no artificial gains', () => {
    const result = simulateFinancialProjection(
      {
        baseSalary: 2500,
        totalRemainingDebt: 0,
        currentEmergency: 3450,
        currentSavings: 10000,
        currentDebtFund: 0,
        currentOtherAssets: 0
      },
      { annualInvestmentReturnPct: 0 }
    );

    expect(result.timelineMonths[0].investmentGains).toBe(0);
    expect(result.timelineMonths[11].investmentGains).toBe(0);
  });
});
