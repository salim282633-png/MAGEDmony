/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  AccountItem, 
  Expense, 
  Transaction, 
  SubscriptionBill, 
  UserSettings,
  getPrimaryBankAccount
} from '../types';
import { 
  Firestore, 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  runTransaction 
} from 'firebase/firestore';

export const PRIMARY_BANK_NAME = 'بنك الشامل';
export const CURRENT_BANK_MIGRATION_VERSION = 1;

/**
 * Predicate to identify bank accounts (operational bank accounts),
 * strictly excluding dedicated funds (debts, emergency, savings, investments, cash wallets).
 */
export function isBankAccount(acc: { 
  name?: string; 
  type?: string; 
  isPrimaryBank?: boolean;
}): boolean {
  if (acc.isPrimaryBank) return true;
  const name = acc.name || '';
  const type = acc.type || '';

  // Guard: explicitly exclude dedicated funds and non-bank categories
  if (
    name.includes('الديون') || 
    name.includes('ديون') ||
    name.includes('طوارئ') || 
    name.includes('الطوارئ') ||
    name.includes('الادخار') || 
    name.includes('ادخار') || 
    name.includes('استثمار') || 
    name.includes('المحفظة النقدية') || 
    name.includes('كاش') ||
    type === 'نقد' ||
    type === 'صندوق مخصص' ||
    type === 'المحافظ الاستثمارية' ||
    type === 'المحافظ الإلكترونية' ||
    type === 'البطاقات الائتمانية'
  ) {
    return false;
  }

  return (
    type === 'الحساب البنكي' ||
    type === 'جاري' ||
    name === PRIMARY_BANK_NAME ||
    name === 'بنك الشامل' ||
    name === 'الحساب البنكي' ||
    name.includes('بنك') ||
    name.includes('البنك') ||
    name.includes('مصرف')
  );
}

export interface PureMigrationResult {
  migratedAccounts: AccountItem[];
  primaryBank: AccountItem;
  deletedAccountIds: string[];
  updatedExpenses: Expense[];
  updatedTransactions: Transaction[];
  updatedSubscriptions: SubscriptionBill[];
  totalMoneyBefore: number;
  totalMoneyAfter: number;
  isBalancePreserved: boolean;
}

/**
 * Pure, deterministic migration function for merging all bank accounts into "بنك الشامل"
 * Guarantees zero balance loss and idempotency.
 */
export function migrateBankAccountsPure(
  accounts: AccountItem[],
  expenses: Expense[] = [],
  transactions: Transaction[] = [],
  subscriptions: SubscriptionBill[] = [],
  userId: string = 'user_default'
): PureMigrationResult {
  const totalMoneyBefore = accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

  const bankAccounts = accounts.filter(isBankAccount);
  const nonBankAccounts = accounts.filter(a => !isBankAccount(a));

  // Calculate sum of all bank account balances
  const totalBankBalance = bankAccounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

  // Identify preferred primary bank document
  const existingShamel = bankAccounts.find(a => a.name === PRIMARY_BANK_NAME || a.isPrimaryBank);
  const primaryBankSource = existingShamel || bankAccounts[0];

  const primaryBankId = primaryBankSource?.id || `acc_shamel_${Date.now()}`;
  const oldBankNames = new Set(bankAccounts.map(b => b.name));
  const oldBankIds = new Set(bankAccounts.map(b => b.id).filter(Boolean) as string[]);

  // Construct single primary bank "بنك الشامل"
  const primaryBank: AccountItem = {
    id: primaryBankId,
    userId: primaryBankSource?.userId || userId,
    name: PRIMARY_BANK_NAME,
    type: 'الحساب البنكي',
    balance: totalBankBalance,
    openingBalance: primaryBankSource?.openingBalance ?? totalBankBalance,
    openingDate: primaryBankSource?.openingDate || new Date().toISOString().split('T')[0],
    currency: primaryBankSource?.currency || 'ريال سعودي',
    accountNumber: primaryBankSource?.accountNumber || '',
    isArchived: false,
    isPrimaryBank: true,
    role: 'primary_bank',
    notes: primaryBankSource?.notes || 'بنك الشامل والوحيد في النظام'
  };

  const deletedAccountIds = bankAccounts
    .filter(a => a.id && a.id !== primaryBankId)
    .map(a => a.id as string);

  const migratedAccounts: AccountItem[] = [
    primaryBank,
    ...nonBankAccounts
  ];

  const totalMoneyAfter = migratedAccounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  const isBalancePreserved = Math.abs(totalMoneyBefore - totalMoneyAfter) < 0.001;

  // Link historical records
  const updatedExpenses = expenses.map(exp => {
    const isOldBank = 
      oldBankNames.has(exp.paymentMethod) || 
      exp.paymentMethod === 'الحساب البنكي' || 
      exp.paymentMethod === 'بنك الشامل' ||
      (exp.accountId && oldBankIds.has(exp.accountId));

    if (isOldBank) {
      return {
        ...exp,
        paymentMethod: PRIMARY_BANK_NAME,
        accountId: primaryBankId
      };
    }
    return exp;
  });

  const updatedTransactions = transactions.map(t => {
    let fromAcc = t.fromAccount;
    let fromId = t.fromAccountId;
    let toAcc = t.toAccount;
    let toId = t.toAccountId;

    if (oldBankNames.has(fromAcc) || fromAcc === 'الحساب البنكي' || fromAcc === 'بنك الشامل' || (fromId && oldBankIds.has(fromId))) {
      fromAcc = PRIMARY_BANK_NAME;
      fromId = primaryBankId;
    }
    if (oldBankNames.has(toAcc) || toAcc === 'الحساب البنكي' || toAcc === 'بنك الشامل' || (toId && oldBankIds.has(toId))) {
      toAcc = PRIMARY_BANK_NAME;
      toId = primaryBankId;
    }

    return {
      ...t,
      fromAccount: fromAcc,
      fromAccountId: fromId,
      toAccount: toAcc,
      toAccountId: toId
    };
  });

  const updatedSubscriptions = subscriptions.map(sub => {
    if (sub.paymentAccount && (oldBankNames.has(sub.paymentAccount) || sub.paymentAccount === 'الحساب البنكي' || sub.paymentAccount === 'بنك الشامل')) {
      return {
        ...sub,
        paymentAccount: PRIMARY_BANK_NAME,
        paymentAccountId: primaryBankId
      };
    }
    return sub;
  });

  return {
    migratedAccounts,
    primaryBank,
    deletedAccountIds,
    updatedExpenses,
    updatedTransactions,
    updatedSubscriptions,
    totalMoneyBefore,
    totalMoneyAfter,
    isBalancePreserved
  };
}

/**
 * Executes migration atomically via Firestore runTransaction.
 * Idempotent: checks settings.bankAccountMigrationVersion before doing any modifications.
 */
export async function executeBankMigrationTransactional(
  db: Firestore,
  userId: string
): Promise<{ success: boolean; message: string; version: number }> {
  if (!userId) return { success: false, message: 'No authenticated user', version: 0 };

  const settingsDocRef = doc(db, 'settings', userId);

  // 1. Fetch current collections for userId
  const [accSnap, expSnap, transSnap, subSnap] = await Promise.all([
    getDocs(query(collection(db, 'accounts'), where('userId', '==', userId))),
    getDocs(query(collection(db, 'expenses'), where('userId', '==', userId))),
    getDocs(query(collection(db, 'transactions'), where('userId', '==', userId))),
    getDocs(query(collection(db, 'subscriptions'), where('userId', '==', userId)))
  ]);

  const rawAccounts = accSnap.docs.map(d => ({ id: d.id, ...d.data() } as AccountItem));
  // Note: expenses, transactions, subscriptions are only updated for their names/IDs, not balances, so outside fetch is ok for them.
  // BUT we must fetch accounts inside tx to get accurate balances.
  
  const rawExpenses = expSnap.docs.map(d => ({ id: d.id, ...d.data() } as Expense));
  const rawTransactions = transSnap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
  const rawSubscriptions = subSnap.docs.map(d => ({ id: d.id, ...d.data() } as SubscriptionBill));

  return await runTransaction(db, async (tx) => {
    // Check Settings idempotency inside transaction
    const settingsSnap = await tx.get(settingsDocRef);
    const settingsData = settingsSnap.exists() ? (settingsSnap.data() as UserSettings) : null;
    
    // Read all account documents inside transaction to get latest balances
    const accountRefs = rawAccounts.map(a => doc(db, 'accounts', a.id!));
    const txAccountSnaps = await Promise.all(accountRefs.map(ref => tx.get(ref)));
    const txAccounts = txAccountSnaps.map(snap => ({ id: snap.id, ...snap.data() } as AccountItem));

    
    if (settingsData && (settingsData.bankAccountMigrationVersion || 0) >= CURRENT_BANK_MIGRATION_VERSION) {
      return { success: true, message: 'Already migrated', version: settingsData.bankAccountMigrationVersion || 1 };
    }

    // Run pure calculation
    const migration = migrateBankAccountsPure(
      txAccounts,
      rawExpenses,
      rawTransactions,
      rawSubscriptions,
      userId
    );

    // Writes
    // 1. Primary Bank account
    const primaryBankDocRef = doc(db, 'accounts', migration.primaryBank.id!);
    tx.set(primaryBankDocRef, {
      userId,
      name: PRIMARY_BANK_NAME,
      type: 'الحساب البنكي',
      balance: migration.primaryBank.balance,
      openingBalance: migration.primaryBank.openingBalance ?? migration.primaryBank.balance,
      openingDate: migration.primaryBank.openingDate,
      currency: migration.primaryBank.currency,
      accountNumber: migration.primaryBank.accountNumber || '',
      isArchived: false,
      isPrimaryBank: true,
      role: 'primary_bank',
      notes: 'بنك الشامل والوحيد في النظام'
    }, { merge: true });

    // 2. Delete redundant bank accounts
    for (const delId of migration.deletedAccountIds) {
      tx.delete(doc(db, 'accounts', delId));
    }

    // 3. Update expenses
    for (const exp of migration.updatedExpenses) {
      if (exp.id && (exp.paymentMethod === PRIMARY_BANK_NAME || exp.accountId === migration.primaryBank.id)) {
        tx.update(doc(db, 'expenses', exp.id), {
          paymentMethod: PRIMARY_BANK_NAME,
          accountId: migration.primaryBank.id
        });
      }
    }

    // 4. Update transactions
    for (const t of migration.updatedTransactions) {
      if (t.id && (t.fromAccount === PRIMARY_BANK_NAME || t.toAccount === PRIMARY_BANK_NAME)) {
        tx.update(doc(db, 'transactions', t.id), {
          fromAccount: t.fromAccount,
          fromAccountId: t.fromAccountId,
          toAccount: t.toAccount,
          toAccountId: t.toAccountId
        });
      }
    }

    // 5. Update subscriptions
    for (const sub of migration.updatedSubscriptions) {
      if (sub.id && sub.paymentAccount === PRIMARY_BANK_NAME) {
        tx.update(doc(db, 'subscriptions', sub.id), {
          paymentAccount: PRIMARY_BANK_NAME,
          paymentAccountId: migration.primaryBank.id
        });
      }
    }

    // 6. Update user settings with migration version
    tx.set(settingsDocRef, {
      bankAccountMigrationVersion: CURRENT_BANK_MIGRATION_VERSION
    }, { merge: true });

    return { 
      success: true, 
      message: `تم دمج الحسابات البنكية في ${PRIMARY_BANK_NAME} بنجاح وحفظ الرصيد بالكامل.`,
      version: CURRENT_BANK_MIGRATION_VERSION 
    };
  });
}
