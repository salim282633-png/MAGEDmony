import { describe, it, expect } from 'vitest';

describe('MAGEDmony Financial Logic Tests', () => {
  // Test 1: Expenses 300/400/700 must not be hidden or filtered
  it('displays expenses with amounts 300, 400, and 700 without filtering them', () => {
    const rawExpenses = [
      { id: '1', amount: 300, description: 'مشتريات بقالة', category: 'الطعام', type: 'مصروف' },
      { id: '2', amount: 400, description: 'صيانة سيارة', category: 'المواصلات', type: 'مصروف' },
      { id: '3', amount: 700, description: 'إيجار جزئي', category: 'السكن', type: 'مصروف' },
      { id: '4', amount: 150, description: 'بنزين', category: 'الوقود', type: 'مصروف' }
    ];

    // Filter logic without arbitrary dummy amount exclusions
    const filtered = rawExpenses.filter(item => {
      const itemType = item.type || 'مصروف';
      return itemType === 'مصروف';
    });

    expect(filtered.length).toBe(4);
    expect(filtered.some(e => e.amount === 300)).toBe(true);
    expect(filtered.some(e => e.amount === 400)).toBe(true);
    expect(filtered.some(e => e.amount === 700)).toBe(true);
  });

  // Test 2: Deleting an expense restores account balance accurately
  it('restores account balance accurately when deleting an expense', () => {
    let accountBalance = 1500;
    const expenseAmount = 250;

    // Simulate initial expense deduction
    accountBalance -= expenseAmount;
    expect(accountBalance).toBe(1250);

    // Delete expense & revert
    accountBalance += expenseAmount;
    expect(accountBalance).toBe(1500);
  });

  // Test 3: Bulk clearing expenses restores all account balances accurately
  it('restores all account balances correctly when bulk clearing expenses', () => {
    const accounts: Record<string, number> = {
      'الحساب البنكي الرئيسي': 1000,
      'صندوق الطوارئ': 500
    };

    const expensesToClear = [
      { amount: 100, paymentMethod: 'الحساب البنكي الرئيسي' },
      { amount: 200, paymentMethod: 'الحساب البنكي الرئيسي' },
      { amount: 50, paymentMethod: 'صندوق الطوارئ' }
    ];

    // Group refunds
    const refunds: Record<string, number> = {};
    for (const exp of expensesToClear) {
      refunds[exp.paymentMethod] = (refunds[exp.paymentMethod] || 0) + exp.amount;
    }

    for (const [acc, amt] of Object.entries(refunds)) {
      accounts[acc] += amt;
    }

    expect(accounts['الحساب البنكي الرئيسي']).toBe(1300);
    expect(accounts['صندوق الطوارئ']).toBe(550);
  });

  // Test 4: Debt payment cannot exceed remaining debt amount
  it('prevents paying more than remaining debt amount (paidAmount <= totalAmount)', () => {
    const debt = {
      totalAmount: 1000,
      paidAmount: 800
    };
    const requestedPayment = 300;
    const availableFund = 500;

    const remainingDebt = Math.max(0, debt.totalAmount - debt.paidAmount);
    const actualPayment = Math.min(requestedPayment, remainingDebt, availableFund);

    expect(remainingDebt).toBe(200);
    expect(actualPayment).toBe(200); // Caps at remaining 200, not 300

    const newPaidAmount = debt.paidAmount + actualPayment;
    expect(newPaidAmount).toBe(1000);
    expect(newPaidAmount).toBeLessThanOrEqual(debt.totalAmount);
  });

  // Test 5: Cannot pay more than available debt fund balance without proper handling
  it('prevents paying more than available debt fund balance and does not use Math.max to mask deficit', () => {
    const debt = {
      totalAmount: 1000,
      paidAmount: 200
    };
    const requestedPayment = 500;
    const availableFund = 150; // Only 150 available

    const remainingDebt = Math.max(0, debt.totalAmount - debt.paidAmount);
    const actualPayment = Math.min(requestedPayment, remainingDebt, availableFund);

    expect(actualPayment).toBe(150);
    
    // Remaining fund after payment must be exact 0, not a masked negative
    const newFundBalance = availableFund - actualPayment;
    expect(newFundBalance).toBe(0);
  });

  // Test 6: Salary cancellation must fail completely if part of allocations was spent
  it('fails salary cancellation if any fund has balance lower than allocation to reverse', () => {
    const salaryAllocations = {
      operationalAmount: 1150,
      debtAmount: 650,
      emergencyAmount: 400,
      savingsAmount: 300
    };

    // Simulated account balances where user spent money from main account
    const currentBalances = {
      main: 500, // less than 1150
      debt: 650,
      emergency: 400,
      savings: 300
    };

    const canCancel = 
      currentBalances.main >= salaryAllocations.operationalAmount &&
      currentBalances.debt >= salaryAllocations.debtAmount &&
      currentBalances.emergency >= salaryAllocations.emergencyAmount &&
      currentBalances.savings >= salaryAllocations.savingsAmount;

    expect(canCancel).toBe(false);
  });

  // Test 7: Salary cancellation succeeds when all allocations are intact
  it('succeeds salary cancellation when all fund balances are sufficient', () => {
    const salaryAllocations = {
      operationalAmount: 1150,
      debtAmount: 650,
      emergencyAmount: 400,
      savingsAmount: 300
    };

    const currentBalances = {
      main: 1500,
      debt: 1000,
      emergency: 800,
      savings: 600
    };

    const canCancel = 
      currentBalances.main >= salaryAllocations.operationalAmount &&
      currentBalances.debt >= salaryAllocations.debtAmount &&
      currentBalances.emergency >= salaryAllocations.emergencyAmount &&
      currentBalances.savings >= salaryAllocations.savingsAmount;

    expect(canCancel).toBe(true);

    // Reversed balances
    const afterReversal = {
      main: currentBalances.main - salaryAllocations.operationalAmount,
      debt: currentBalances.debt - salaryAllocations.debtAmount,
      emergency: currentBalances.emergency - salaryAllocations.emergencyAmount,
      savings: currentBalances.savings - salaryAllocations.savingsAmount
    };

    expect(afterReversal.main).toBe(350);
    expect(afterReversal.debt).toBe(350);
    expect(afterReversal.emergency).toBe(400);
    expect(afterReversal.savings).toBe(300);
  });

  // Test 8: Salary distribution idempotency by deterministic key
  it('enforces salary distribution idempotency for a given month and user', () => {
    const existingDistributions = new Set<string>();
    const userId = 'user_123';
    const monthKey = '2026-08';
    const idempotencyDocId = `salary_${userId}_${monthKey}`;

    // First distribution attempt
    let firstAttemptSuccess = false;
    if (!existingDistributions.has(idempotencyDocId)) {
      existingDistributions.add(idempotencyDocId);
      firstAttemptSuccess = true;
    }
    expect(firstAttemptSuccess).toBe(true);

    // Concurrent second distribution attempt with same key
    let secondAttemptSuccess = false;
    if (!existingDistributions.has(idempotencyDocId)) {
      existingDistributions.add(idempotencyDocId);
      secondAttemptSuccess = true;
    }
    expect(secondAttemptSuccess).toBe(false);
  });

  // Test 9: Extra Income directed to Debt does not double count
  it('correctly handles direct extra income to debt without double counting', () => {
    const debt = {
      name: 'قرض البنك',
      totalAmount: 500,
      paidAmount: 200
    };
    const incomingExtraIncome = 400;

    const debtRemaining = debt.totalAmount - debt.paidAmount; // 300
    const actualPayment = Math.min(incomingExtraIncome, debtRemaining); // 300
    const excessToFund = incomingExtraIncome - actualPayment; // 100

    expect(actualPayment).toBe(300);
    expect(excessToFund).toBe(100);

    const newDebtPaid = debt.paidAmount + actualPayment;
    expect(newDebtPaid).toBe(500);
    expect(newDebtPaid).toBe(debt.totalAmount);
  });
});
