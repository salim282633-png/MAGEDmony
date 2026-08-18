/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  addDoc,
  runTransaction,
  writeBatch,
  getDocs,
  getDoc
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { 
  BudgetItem, 
  DebtItem, 
  SavingsRecord, 
  Expense, 
  Task, 
  UserSettings,
  FinancialGoal,
  Transaction,
  AccountItem,
  InvestmentItem,
  SubscriptionBill,
  FinancialEvent,
  MonthlyClosure
} from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Generate unique reference ID
export function generateReferenceId(prefix: string = 'tx'): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${timestamp}_${randomPart}`;
}

export function useFinanceData() {
  const [user, setUser] = useState(auth.currentUser);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [budget, setBudget] = useState<BudgetItem[]>([]);
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [savings, setSavings] = useState<SavingsRecord[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [investments, setInvestments] = useState<InvestmentItem[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionBill[]>([]);
  const [financialEvents, setFinancialEvents] = useState<FinancialEvent[]>([]);
  const [monthlyClosures, setMonthlyClosures] = useState<MonthlyClosure[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
      if (!u) {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    const userId = user.uid;

    // 1. Settings & Initial Setup (Only runs once on brand new user profile)
    const unsubSettings = onSnapshot(doc(db, 'settings', userId), async (settingsDoc) => {
      if (settingsDoc.exists()) {
        const data = settingsDoc.data() as UserSettings;
        setSettings(data);
      } else {
        // First-time onboarding for this user
        const initialSettings: UserSettings = {
          userId,
          salary: 2500,
          currency: 'ريال سعودي',
          initialized: true,
          onboardingCompleted: true
        };
        await setDoc(doc(db, 'settings', userId), initialSettings).catch(console.error);

        // Seed initial default accounts once
        const defaultAccounts: Omit<AccountItem, 'id'>[] = [
          { userId, name: 'الحساب البنكي الرئيسي', type: 'الحساب البنكي', balance: 1150, currency: 'ريال سعودي', isArchived: false, notes: 'حساب تحويل الراتب الرئيسي ومخصص المعيشة' },
          { userId, name: 'صندوق سداد الديون', type: 'صندوق مخصص', balance: 650, currency: 'ريال سعودي', isArchived: false, notes: 'مخصص سداد الديون (26%)' },
          { userId, name: 'صندوق الطوارئ', type: 'صندوق مخصص', balance: 400, currency: 'ريال سعودي', isArchived: false, notes: 'مخصص الطوارئ (16%)' },
          { userId, name: 'صندوق الادخار والاستثمار', type: 'صندوق مخصص', balance: 300, currency: 'ريال سعودي', isArchived: false, notes: 'مخصص الادخار والاستثمار (12%)' },
          { userId, name: 'المحفظة النقدية', type: 'نقد', balance: 0, currency: 'ريال سعودي', isArchived: false, notes: 'كاش للمصاريف اليومية' }
        ];
        for (const acc of defaultAccounts) {
          await addDoc(collection(db, 'accounts'), acc).catch(console.error);
        }

        // Seed initial default debt once
        const defaultDebt: Omit<DebtItem, 'id'> = {
          userId,
          name: 'دين المعيشة',
          totalAmount: 10750,
          paidAmount: 0,
          status: 'قيد الانتظار',
          dueDate: new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0]
        };
        await addDoc(collection(db, 'debts'), defaultDebt).catch(console.error);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'settings'));

    // 2. Budgets
    const unsubBudget = onSnapshot(query(collection(db, 'budgets'), where('userId', '==', userId)), (snap) => {
      setBudget(snap.docs.map(d => ({ id: d.id, ...d.data() } as BudgetItem)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'budgets'));

    // 3. Debts
    const unsubDebts = onSnapshot(query(collection(db, 'debts'), where('userId', '==', userId)), (snap) => {
      setDebts(snap.docs.map(d => ({ id: d.id, ...d.data() } as DebtItem)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'debts'));

    // 4. Savings
    const unsubSavings = onSnapshot(query(collection(db, 'savings'), where('userId', '==', userId)), (snap) => {
      setSavings(snap.docs.map(d => ({ id: d.id, ...d.data() } as SavingsRecord)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'savings'));

    // 5. Expenses & Income (No hardcoded filtering or deletion)
    const unsubExpenses = onSnapshot(query(collection(db, 'expenses'), where('userId', '==', userId)), (snap) => {
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Expense)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'expenses'));

    // 6. Tasks
    const unsubTasks = onSnapshot(query(collection(db, 'tasks'), where('userId', '==', userId)), (snap) => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'tasks'));

    // 7. Goals
    const unsubGoals = onSnapshot(query(collection(db, 'goals'), where('userId', '==', userId)), (snap) => {
      setGoals(snap.docs.map(d => ({ id: d.id, ...d.data() } as FinancialGoal)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'goals'));

    // 8. Transactions (No hardcoded filtering or deletion)
    const unsubTrans = onSnapshot(query(collection(db, 'transactions'), where('userId', '==', userId)), (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'transactions'));

    // 9. Accounts (Zero is a completely valid balance - never auto-refill on zero)
    const unsubAccounts = onSnapshot(query(collection(db, 'accounts'), where('userId', '==', userId)), (snap) => {
      setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() } as AccountItem)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'accounts'));

    // 10. Investments
    const unsubInvestments = onSnapshot(query(collection(db, 'investments'), where('userId', '==', userId)), (snap) => {
      setInvestments(snap.docs.map(d => ({ id: d.id, ...d.data() } as InvestmentItem)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'investments'));

    // 11. Subscriptions & Bills
    const unsubSubscriptions = onSnapshot(query(collection(db, 'subscriptions'), where('userId', '==', userId)), (snap) => {
      setSubscriptions(snap.docs.map(d => ({ id: d.id, ...d.data() } as SubscriptionBill)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'subscriptions'));

    // 12. Events
    const unsubEvents = onSnapshot(query(collection(db, 'financial_events'), where('userId', '==', userId)), (snap) => {
      setFinancialEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as FinancialEvent)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'financial_events'));

    // 13. Monthly Closures
    const unsubMonthlyClosures = onSnapshot(query(collection(db, 'monthly_closures'), where('userId', '==', userId)), (snap) => {
      setMonthlyClosures(snap.docs.map(d => ({ id: d.id, ...d.data() } as MonthlyClosure)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'monthly_closures'));

    setLoading(false);

    return () => {
      unsubSettings();
      unsubBudget();
      unsubDebts();
      unsubSavings();
      unsubExpenses();
      unsubTasks();
      unsubGoals();
      unsubTrans();
      unsubAccounts();
      unsubInvestments();
      unsubSubscriptions();
      unsubEvents();
      unsubMonthlyClosures();
    };
  }, [user]);

  // Helper to find matching account
  const findAccountByMethod = (method?: string) => {
    if (!method || method === 'الحساب البنكي' || method === 'الحساب البنكي الرئيسي') {
      return accounts.find(a => a.name.includes('الرئيسي') || a.name.includes('المصاريف') || a.type === 'الحساب البنكي');
    }
    return accounts.find(a => 
      a.name === method || 
      a.name.includes(method) || 
      method.includes(a.name)
    );
  };

  // =========================================================================
  // TRANSACTIONAL OPERATIONS (Atomic Firestore Transactions)
  // =========================================================================

  /**
   * Add Expense or Income + update account balance atomically
   */
  const addTransaction = async (expense: Omit<Expense, 'id' | 'userId'>) => {
    if (!user) return;
    try {
      const refId = expense.referenceId || generateReferenceId(expense.type === 'دخل' ? 'inc' : 'exp');
      const targetAcc = findAccountByMethod(expense.paymentMethod);
      const accRef = targetAcc?.id ? doc(db, 'accounts', targetAcc.id) : null;
      const newExpenseRef = doc(collection(db, 'expenses'));

      await runTransaction(db, async (tx) => {
        let currentBalance = targetAcc?.balance || 0;
        if (accRef) {
          const accSnap = await tx.get(accRef);
          if (accSnap.exists()) {
            currentBalance = Number(accSnap.data().balance) || 0;
          }
        }

        const delta = expense.type === 'دخل' ? (expense.amount || 0) : -(expense.amount || 0);
        const newBalance = currentBalance + delta;

        // Write expense
        tx.set(newExpenseRef, {
          ...expense,
          userId: user.uid,
          referenceId: refId
        });

        // Write account balance
        if (accRef) {
          tx.update(accRef, { balance: newBalance });
        }
      });

      return newExpenseRef.id;
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'expenses');
    }
  };

  /**
   * Delete Expense or Income + revert account balance atomically
   */
  const deleteTransaction = async (id: string) => {
    if (!user) return;
    try {
      const expenseRef = doc(db, 'expenses', id);

      await runTransaction(db, async (tx) => {
        const expenseSnap = await tx.get(expenseRef);
        if (!expenseSnap.exists()) return;

        const expenseData = expenseSnap.data() as Expense;
        const targetAcc = findAccountByMethod(expenseData.paymentMethod);
        const accRef = targetAcc?.id ? doc(db, 'accounts', targetAcc.id) : null;

        let currentBalance = 0;
        if (accRef) {
          const accSnap = await tx.get(accRef);
          if (accSnap.exists()) {
            currentBalance = Number(accSnap.data().balance) || 0;
          }
        }

        // Revert delta: if was income, subtract; if was expense, add back
        const delta = expenseData.type === 'دخل' ? -(expenseData.amount || 0) : (expenseData.amount || 0);
        const newBalance = currentBalance + delta;

        tx.delete(expenseRef);
        if (accRef) {
          tx.update(accRef, { balance: newBalance });
        }
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'expenses');
    }
  };

  /**
   * Update Expense + adjust account balance delta atomically
   */
  const updateExpenseTransactional = async (id: string, updatedData: Partial<Expense>) => {
    if (!user) return;
    try {
      const expenseRef = doc(db, 'expenses', id);

      await runTransaction(db, async (tx) => {
        const expenseSnap = await tx.get(expenseRef);
        if (!expenseSnap.exists()) return;

        const oldData = expenseSnap.data() as Expense;
        const oldAmount = oldData.amount || 0;
        const newAmount = updatedData.amount !== undefined ? updatedData.amount : oldAmount;
        const oldType = oldData.type || 'مصروف';
        const newType = updatedData.type || oldType;
        const oldMethod = oldData.paymentMethod;
        const newMethod = updatedData.paymentMethod || oldMethod;

        const oldAcc = findAccountByMethod(oldMethod);
        const newAcc = findAccountByMethod(newMethod);

        // Reads
        let oldAccBalance = 0;
        let newAccBalance = 0;
        const oldAccRef = oldAcc?.id ? doc(db, 'accounts', oldAcc.id) : null;
        const newAccRef = newAcc?.id ? doc(db, 'accounts', newAcc.id) : null;

        if (oldAccRef) {
          const snap = await tx.get(oldAccRef);
          if (snap.exists()) oldAccBalance = Number(snap.data().balance) || 0;
        }

        if (newAccRef && newAccRef.id !== oldAccRef?.id) {
          const snap = await tx.get(newAccRef);
          if (snap.exists()) newAccBalance = Number(snap.data().balance) || 0;
        } else if (newAccRef && newAccRef.id === oldAccRef?.id) {
          newAccBalance = oldAccBalance;
        }

        // Calculate balance adjustments
        if (oldAccRef?.id === newAccRef?.id && oldAccRef) {
          // Same account
          const oldDelta = oldType === 'دخل' ? oldAmount : -oldAmount;
          const newDelta = newType === 'دخل' ? newAmount : -newAmount;
          const netChange = newDelta - oldDelta;
          tx.update(oldAccRef, { balance: oldAccBalance + netChange });
        } else {
          // Different accounts: revert old, apply new
          if (oldAccRef) {
            const revertDelta = oldType === 'دخل' ? -oldAmount : oldAmount;
            tx.update(oldAccRef, { balance: oldAccBalance + revertDelta });
          }
          if (newAccRef) {
            const applyDelta = newType === 'دخل' ? newAmount : -newAmount;
            tx.update(newAccRef, { balance: newAccBalance + applyDelta });
          }
        }

        tx.update(expenseRef, { ...updatedData });
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'expenses');
    }
  };

  /**
   * Transfer Funds between two accounts atomically
   */
  const transferFunds = async (fromAccName: string, toAccName: string, amount: number, notes?: string) => {
    if (!user || amount <= 0) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const fromAcc = accounts.find(a => a.name === fromAccName);
      const toAcc = accounts.find(a => a.name === toAccName);

      if (!fromAcc?.id || !toAcc?.id) {
        throw new Error('الحسابات المحددة غير موجودة.');
      }

      const fromAccRef = doc(db, 'accounts', fromAcc.id);
      const toAccRef = doc(db, 'accounts', toAcc.id);
      const newTxRef = doc(collection(db, 'transactions'));
      const refId = generateReferenceId('trf');

      await runTransaction(db, async (tx) => {
        const fromSnap = await tx.get(fromAccRef);
        const toSnap = await tx.get(toAccRef);

        if (!fromSnap.exists() || !toSnap.exists()) {
          throw new Error('أحد الحسابات غير متوفر في قاعدة البيانات.');
        }

        const fromBalance = Number(fromSnap.data().balance) || 0;
        const toBalance = Number(toSnap.data().balance) || 0;

        tx.update(fromAccRef, { balance: fromBalance - amount });
        tx.update(toAccRef, { balance: toBalance + amount });

        tx.set(newTxRef, {
          userId: user.uid,
          fromAccount: fromAccName,
          toAccount: toAccName,
          amount,
          date: today,
          notes: notes || 'تحويل بين الحسابات',
          referenceId: refId
        });
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'transactions');
    }
  };

  const addTransferTransactional = async (transfer: { fromAccount: string; toAccount: string; amount: number; date?: string; notes?: string }) => {
    return transferFunds(transfer.fromAccount, transfer.toAccount, transfer.amount, transfer.notes);
  };

  /**
   * Delete Transfer and reverse balances atomically
   */
  const deleteTransferTransactional = async (txId: string) => {
    if (!user) return;
    try {
      const txRef = doc(db, 'transactions', txId);
      await runTransaction(db, async (tx) => {
        const txSnap = await tx.get(txRef);
        if (!txSnap.exists()) return;
        const txData = txSnap.data() as Transaction;
        const fromAcc = accounts.find(a => a.name === txData.fromAccount);
        const toAcc = accounts.find(a => a.name === txData.toAccount);
        if (fromAcc?.id && toAcc?.id) {
          const fromRef = doc(db, 'accounts', fromAcc.id);
          const toRef = doc(db, 'accounts', toAcc.id);
          const fromSnap = await tx.get(fromRef);
          const toSnap = await tx.get(toRef);
          if (fromSnap.exists() && toSnap.exists()) {
            const fromBal = Number(fromSnap.data().balance) || 0;
            const toBal = Number(toSnap.data().balance) || 0;
            tx.update(fromRef, { balance: fromBal + (txData.amount || 0) });
            tx.update(toRef, { balance: toBal - (txData.amount || 0) });
          }
        }
        tx.delete(txRef);
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'transactions');
    }
  };

  /**
   * Clear all user expenses and atomically reverse account balances
   */
  const clearExpensesTransactional = async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'expenses'),
        where('userId', '==', user.uid)
      );
      const snap = await getDocs(q);
      const expensesToDelete = snap.docs.filter(d => {
        const data = d.data() as Expense;
        return data.type === 'مصروف' || !data.type;
      });

      if (expensesToDelete.length === 0) return;

      // Group refunds by payment method account
      const refundsByAccount: Record<string, number> = {};
      for (const d of expensesToDelete) {
        const exp = d.data() as Expense;
        const method = exp.paymentMethod || 'الحساب البنكي الرئيسي';
        refundsByAccount[method] = (refundsByAccount[method] || 0) + (exp.amount || 0);
      }

      await runTransaction(db, async (tx) => {
        // 1. Reads
        const accMap: Record<string, { ref: any; balance: number }> = {};
        for (const accName of Object.keys(refundsByAccount)) {
          const acc = findAccountByMethod(accName);
          if (acc?.id) {
            const accRef = doc(db, 'accounts', acc.id);
            const accSnap = await tx.get(accRef);
            if (accSnap.exists()) {
              accMap[accName] = {
                ref: accRef,
                balance: Number(accSnap.data().balance) || 0
              };
            }
          }
        }

        // 2. Writes - restore balances
        for (const [accName, refundAmt] of Object.entries(refundsByAccount)) {
          const item = accMap[accName];
          if (item) {
            tx.update(item.ref, { balance: item.balance + refundAmt });
          }
        }

        // 3. Delete expense documents
        for (const d of expensesToDelete) {
          tx.delete(d.ref);
        }
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'expenses');
      throw e;
    }
  };

  /**
   * Quick Add Expense Transactional
   */
  const quickAddExpenseTransactional = async (
    amount: number,
    description: string,
    accountName: string,
    category: string = 'الطعام',
    date?: string
  ) => {
    if (!user || amount <= 0) return;
    const today = date || new Date().toISOString().split('T')[0];
    const acc = findAccountByMethod(accountName);
    const accRef = acc?.id ? doc(db, 'accounts', acc.id) : null;
    const newExpRef = doc(collection(db, 'expenses'));
    const refId = generateReferenceId('exp');

    await runTransaction(db, async (tx) => {
      let currentBalance = 0;
      if (accRef) {
        const snap = await tx.get(accRef);
        if (snap.exists()) {
          currentBalance = Number(snap.data().balance) || 0;
        }
      }

      tx.set(newExpRef, {
        userId: user.uid,
        type: 'مصروف',
        amount,
        description: description || 'مصروف عام',
        category,
        paymentMethod: accountName,
        date: today,
        referenceId: refId
      });

      if (accRef) {
        tx.update(accRef, { balance: currentBalance - amount });
      }
    });
  };

  /**
   * Quick Add Income: Living Budget (adds to main bank account)
   */
  const quickAddIncomeLivingTransactional = async (
    amount: number,
    description?: string,
    date?: string
  ) => {
    if (!user || amount <= 0) return;
    const today = date || new Date().toISOString().split('T')[0];
    const mainAcc = accounts.find(a => a.name === 'الحساب البنكي الرئيسي' || a.type === 'الحساب البنكي');
    const mainRef = mainAcc?.id ? doc(db, 'accounts', mainAcc.id) : doc(collection(db, 'accounts'));
    const newExpRef = doc(collection(db, 'expenses'));
    const refId = generateReferenceId('inc_liv');

    await runTransaction(db, async (tx) => {
      let currentBalance = 0;
      if (mainAcc?.id) {
        const snap = await tx.get(mainRef);
        if (snap.exists()) currentBalance = Number(snap.data().balance) || 0;
      }

      tx.set(newExpRef, {
        userId: user.uid,
        type: 'دخل',
        date: today,
        category: 'دخل إضافي',
        description: description || 'دخل إضافي (مخصص للمعيشة)',
        amount,
        paymentMethod: 'الحساب البنكي الرئيسي',
        extraIncomeAllocation: 'living',
        allocatedAmounts: { living: amount },
        notes: 'موجه لميزانية المعيشة للشهر الحالي فقط',
        referenceId: refId
      });

      if (mainAcc?.id) {
        tx.update(mainRef, { balance: currentBalance + amount });
      } else {
        tx.set(mainRef, {
          userId: user.uid,
          name: 'الحساب البنكي الرئيسي',
          type: 'الحساب البنكي',
          balance: amount,
          currency: 'ريال سعودي',
          isArchived: false,
          notes: 'حساب الراتب والمصاريف المعيشية'
        });
      }
    });
  };

  /**
   * Quick Add Income: Emergency Fund
   */
  const quickAddIncomeEmergencyTransactional = async (
    amount: number,
    description?: string,
    date?: string
  ) => {
    if (!user || amount <= 0) return;
    const today = date || new Date().toISOString().split('T')[0];
    const emgAcc = accounts.find(a => a.name.includes('طوارئ') || a.name.includes('الطوارئ'));
    const emgRef = emgAcc?.id ? doc(db, 'accounts', emgAcc.id) : doc(collection(db, 'accounts'));
    const newExpRef = doc(collection(db, 'expenses'));
    const refId = generateReferenceId('inc_emg');

    await runTransaction(db, async (tx) => {
      let currentBalance = 0;
      if (emgAcc?.id) {
        const snap = await tx.get(emgRef);
        if (snap.exists()) currentBalance = Number(snap.data().balance) || 0;
      }

      tx.set(newExpRef, {
        userId: user.uid,
        type: 'دخل',
        date: today,
        category: 'دخل إضافي',
        description: description || 'دخل إضافي (طوارئ)',
        amount,
        paymentMethod: emgAcc?.name || 'صندوق الطوارئ',
        extraIncomeAllocation: 'emergency',
        allocatedAmounts: { emergency: amount },
        notes: 'موجه لصندوق الطوارئ',
        referenceId: refId
      });

      if (emgAcc?.id) {
        tx.update(emgRef, { balance: currentBalance + amount });
      } else {
        tx.set(emgRef, {
          userId: user.uid,
          name: 'صندوق الطوارئ',
          type: 'صندوق مخصص',
          balance: amount,
          currency: 'ريال سعودي',
          isArchived: false,
          notes: 'مخصص الطوارئ'
        });
      }
    });
  };

  /**
   * Quick Add Income: Savings & Investment Fund
   */
  const quickAddIncomeSavingsTransactional = async (
    amount: number,
    description?: string,
    date?: string
  ) => {
    if (!user || amount <= 0) return;
    const today = date || new Date().toISOString().split('T')[0];
    const savAcc = accounts.find(a => a.name.includes('الادخار') || a.name.includes('استثمار'));
    const savRef = savAcc?.id ? doc(db, 'accounts', savAcc.id) : doc(collection(db, 'accounts'));
    const newExpRef = doc(collection(db, 'expenses'));
    const refId = generateReferenceId('inc_sav');

    await runTransaction(db, async (tx) => {
      let currentBalance = 0;
      if (savAcc?.id) {
        const snap = await tx.get(savRef);
        if (snap.exists()) currentBalance = Number(snap.data().balance) || 0;
      }

      tx.set(newExpRef, {
        userId: user.uid,
        type: 'دخل',
        date: today,
        category: 'دخل إضافي',
        description: description || 'دخل إضافي (ادخار واستثمار)',
        amount,
        paymentMethod: savAcc?.name || 'صندوق الادخار والاستثمار',
        extraIncomeAllocation: 'savings',
        allocatedAmounts: { savings: amount },
        notes: 'موجه لصندوق الادخار والاستثمار',
        referenceId: refId
      });

      if (savAcc?.id) {
        tx.update(savRef, { balance: currentBalance + amount });
      } else {
        tx.set(savRef, {
          userId: user.uid,
          name: 'صندوق الادخار والاستثمار',
          type: 'صندوق مخصص',
          balance: amount,
          currency: 'ريال سعودي',
          isArchived: false,
          notes: 'مخصص الادخار والاستثمار'
        });
      }
    });
  };

  /**
   * Quick Add Income: Debt Payoff (handles remaining debt accurately with NO double counting)
   */
  const quickAddIncomeDebtTransactional = async (
    amount: number,
    description?: string,
    specificDebtId?: string,
    date?: string
  ) => {
    if (!user || amount <= 0) return;
    const today = date || new Date().toISOString().split('T')[0];
    const debtAcc = accounts.find(a => a.name.includes('الديون') || a.name.includes('ديون'));
    const debtAccRef = debtAcc?.id ? doc(db, 'accounts', debtAcc.id) : doc(collection(db, 'accounts'));
    const targetDebt = debts.find(d => d.id === (specificDebtId || debts[0]?.id)) || debts[0];
    const debtDocRef = targetDebt?.id ? doc(db, 'debts', targetDebt.id) : null;
    const newExpRef = doc(collection(db, 'expenses'));
    const newTrRef = doc(collection(db, 'transactions'));
    const refId = generateReferenceId('inc_dbt');

    await runTransaction(db, async (tx) => {
      let currentFundBalance = 0;
      if (debtAcc?.id) {
        const snap = await tx.get(debtAccRef);
        if (snap.exists()) currentFundBalance = Number(snap.data().balance) || 0;
      }

      let actualPayment = 0;
      let excessToFund = amount;
      let targetDebtData: DebtItem | null = null;

      if (debtDocRef) {
        const dSnap = await tx.get(debtDocRef);
        if (dSnap.exists()) {
          targetDebtData = dSnap.data() as DebtItem;
          const currentPaid = targetDebtData.paidAmount || 0;
          const debtRemaining = Math.max(0, targetDebtData.totalAmount - currentPaid);
          actualPayment = Math.min(amount, debtRemaining);
          excessToFund = amount - actualPayment;

          const newPaid = currentPaid + actualPayment;
          const newStatus = newPaid >= targetDebtData.totalAmount ? 'تم' : 'قيد الانتظار';

          tx.update(debtDocRef, {
            paidAmount: newPaid,
            status: newStatus
          });
        }
      }

      // Log income expense
      tx.set(newExpRef, {
        userId: user.uid,
        type: 'دخل',
        date: today,
        category: 'دخل إضافي',
        description: description || (actualPayment > 0 ? `دخل إضافي موجه لسداد: ${targetDebtData?.name || 'دين'}` : 'دخل إضافي لصندوق الديون'),
        amount,
        paymentMethod: 'صندوق سداد الديون',
        extraIncomeAllocation: 'debt',
        allocatedAmounts: { debt: amount },
        notes: actualPayment > 0 
          ? `سداد مباشر للدين: ${actualPayment} ريال${excessToFund > 0 ? `، والمتبقي ${excessToFund} ريال أودع في رصيد صندوق الديون` : ''}`
          : 'أودع في رصيد صندوق سداد الديون',
        referenceId: refId
      });

      // Update debt fund balance with only the excess (if any)
      const newFundBalance = currentFundBalance + excessToFund;
      if (debtAcc?.id) {
        tx.update(debtAccRef, { balance: newFundBalance });
      } else {
        tx.set(debtAccRef, {
          userId: user.uid,
          name: 'صندوق سداد الديون',
          type: 'صندوق مخصص',
          balance: newFundBalance,
          currency: 'ريال سعودي',
          isArchived: false,
          notes: 'مخصص سداد الديون'
        });
      }

      // If direct payment occurred, record the debt payoff transaction
      if (actualPayment > 0 && targetDebtData) {
        tx.set(newTrRef, {
          userId: user.uid,
          fromAccount: 'دخل إضافي مباشر',
          toAccount: `سداد دين: ${targetDebtData.name}`,
          amount: actualPayment,
          date: today,
          notes: `سداد مباشر من دخل إضافي للدين [${targetDebtData.name}]`,
          referenceId: refId
        });
      }
    });
  };

  /**
   * Quick Add Income: Proportional Salary Split (46% living, 26% debt, 16% emg, 12% sav)
   */
  const quickAddIncomeSalarySplitTransactional = async (
    amount: number,
    description?: string,
    date?: string
  ) => {
    if (!user || amount <= 0) return;
    const today = date || new Date().toISOString().split('T')[0];

    const debtAmt = Math.round(amount * 0.26);
    const emgAmt = Math.round(amount * 0.16);
    const savAmt = Math.round(amount * 0.12);
    const livingAmt = amount - debtAmt - emgAmt - savAmt;

    const mainAcc = accounts.find(a => a.name === 'الحساب البنكي الرئيسي' || a.type === 'الحساب البنكي');
    const debtAcc = accounts.find(a => a.name.includes('الديون'));
    const emgAcc = accounts.find(a => a.name.includes('طوارئ') || a.name.includes('الطوارئ'));
    const savAcc = accounts.find(a => a.name.includes('الادخار') || a.name.includes('استثمار'));

    const mainRef = mainAcc?.id ? doc(db, 'accounts', mainAcc.id) : doc(collection(db, 'accounts'));
    const debtRef = debtAcc?.id ? doc(db, 'accounts', debtAcc.id) : doc(collection(db, 'accounts'));
    const emgRef = emgAcc?.id ? doc(db, 'accounts', emgAcc.id) : doc(collection(db, 'accounts'));
    const savRef = savAcc?.id ? doc(db, 'accounts', savAcc.id) : doc(collection(db, 'accounts'));

    const newExpRef = doc(collection(db, 'expenses'));
    const refId = generateReferenceId('inc_split');

    await runTransaction(db, async (tx) => {
      // 1. Reads
      let mainBal = 0, debtBal = 0, emgBal = 0, savBal = 0;
      if (mainAcc?.id) {
        const s = await tx.get(mainRef);
        if (s.exists()) mainBal = Number(s.data().balance) || 0;
      }
      if (debtAcc?.id) {
        const s = await tx.get(debtRef);
        if (s.exists()) debtBal = Number(s.data().balance) || 0;
      }
      if (emgAcc?.id) {
        const s = await tx.get(emgRef);
        if (s.exists()) emgBal = Number(s.data().balance) || 0;
      }
      if (savAcc?.id) {
        const s = await tx.get(savRef);
        if (s.exists()) savBal = Number(s.data().balance) || 0;
      }

      // 2. Expense Income Log
      tx.set(newExpRef, {
        userId: user.uid,
        type: 'دخل',
        date: today,
        category: 'دخل إضافي',
        description: description || 'دخل إضافي موزع بنسب الراتب',
        amount,
        paymentMethod: 'الحساب البنكي الرئيسي',
        extraIncomeAllocation: 'salary_split',
        allocatedAmounts: {
          living: livingAmt,
          debt: debtAmt,
          emergency: emgAmt,
          savings: savAmt
        },
        notes: `موزع بنسب الراتب: ${livingAmt} معيشة (46%)، ${debtAmt} ديون (26%)، ${emgAmt} طوارئ (16%)، ${savAmt} ادخار (12%)`,
        referenceId: refId
      });

      // 3. Update 4 accounts
      if (mainAcc?.id) {
        tx.update(mainRef, { balance: mainBal + livingAmt });
      } else {
        tx.set(mainRef, { userId: user.uid, name: 'الحساب البنكي الرئيسي', type: 'الحساب البنكي', balance: livingAmt, currency: 'ريال سعودي', isArchived: false, notes: 'حساب الراتب والمصاريف المعيشية' });
      }

      if (debtAcc?.id) {
        tx.update(debtRef, { balance: debtBal + debtAmt });
      } else {
        tx.set(debtRef, { userId: user.uid, name: 'صندوق سداد الديون', type: 'صندوق مخصص', balance: debtAmt, currency: 'ريال سعودي', isArchived: false, notes: 'مخصص سداد الديون' });
      }

      if (emgAcc?.id) {
        tx.update(emgRef, { balance: emgBal + emgAmt });
      } else {
        tx.set(emgRef, { userId: user.uid, name: 'صندوق الطوارئ', type: 'صندوق مخصص', balance: emgAmt, currency: 'ريال سعودي', isArchived: false, notes: 'مخصص الطوارئ' });
      }

      if (savAcc?.id) {
        tx.update(savRef, { balance: savBal + savAmt });
      } else {
        tx.set(savRef, { userId: user.uid, name: 'صندوق الادخار والاستثمار', type: 'صندوق مخصص', balance: savAmt, currency: 'ريال سعودي', isArchived: false, notes: 'مخصص الادخار والاستثمار' });
      }

      // 4. Internal Transfer Logs
      const transfers = [
        { to: 'صندوق سداد الديون', amt: debtAmt, pct: '26%' },
        { to: 'صندوق الطوارئ', amt: emgAmt, pct: '16%' },
        { to: 'صندوق الادخار والاستثمار', amt: savAmt, pct: '12%' }
      ].filter(t => t.amt > 0);

      for (const t of transfers) {
        const trRef = doc(collection(db, 'transactions'));
        tx.set(trRef, {
          userId: user.uid,
          fromAccount: 'الحساب البنكي الرئيسي',
          toAccount: t.to,
          amount: t.amt,
          date: today,
          notes: `توزيع دخل إضافي بنسبة ${t.pct}`,
          referenceId: refId
        });
      }
    });
  };

  /**
   * Quick Add Income: Unallocated
   */
  const quickAddIncomeUnallocatedTransactional = async (
    amount: number,
    description?: string,
    date?: string
  ) => {
    if (!user || amount <= 0) return;
    const today = date || new Date().toISOString().split('T')[0];
    const mainAcc = accounts.find(a => a.name === 'الحساب البنكي الرئيسي' || a.type === 'الحساب البنكي');
    const mainRef = mainAcc?.id ? doc(db, 'accounts', mainAcc.id) : doc(collection(db, 'accounts'));
    const newExpRef = doc(collection(db, 'expenses'));
    const refId = generateReferenceId('inc_unalloc');

    await runTransaction(db, async (tx) => {
      let currentBalance = 0;
      if (mainAcc?.id) {
        const snap = await tx.get(mainRef);
        if (snap.exists()) currentBalance = Number(snap.data().balance) || 0;
      }

      tx.set(newExpRef, {
        userId: user.uid,
        type: 'دخل',
        date: today,
        category: 'دخل إضافي',
        description: description || 'دخل إضافي غير مخصص',
        amount,
        paymentMethod: 'الحساب البنكي الرئيسي',
        extraIncomeAllocation: 'unallocated',
        allocatedAmounts: { unallocated: amount },
        notes: 'دخل إضافي غير مخصص (في الرصيد البنكي الرئيسي وصافي الثروة)',
        referenceId: refId
      });

      if (mainAcc?.id) {
        tx.update(mainRef, { balance: currentBalance + amount });
      } else {
        tx.set(mainRef, {
          userId: user.uid,
          name: 'الحساب البنكي الرئيسي',
          type: 'الحساب البنكي',
          balance: amount,
          currency: 'ريال سعودي',
          isArchived: false,
          notes: 'حساب الراتب والمصاريف المعيشية'
        });
      }
    });
  };

  /**
   * Pay Debt partially/fully + deduct from debt fund atomically and safely
   */
  const payDebtPart = async (debtId: string, amountPaid: number) => {
    if (!user || amountPaid <= 0) {
      throw new Error('يجب إدخال مبلغ سداد أكبر من الصفر.');
    }
    try {
      const debtRef = doc(db, 'debts', debtId);
      const debtFund = accounts.find(a => a.name === 'صندوق سداد الديون' || a.name.includes('الديون'));
      if (!debtFund?.id) {
        throw new Error('صندوق سداد الديون غير موجود.');
      }
      const debtFundRef = doc(db, 'accounts', debtFund.id);
      const newTxRef = doc(collection(db, 'transactions'));

      await runTransaction(db, async (tx) => {
        const [debtSnap, fundSnap] = await Promise.all([
          tx.get(debtRef),
          tx.get(debtFundRef)
        ]);

        if (!debtSnap.exists()) {
          throw new Error('سجل الدين غير موجود في قاعدة البيانات.');
        }
        if (!fundSnap.exists()) {
          throw new Error('صندوق سداد الديون غير موجود.');
        }

        const debtData = debtSnap.data() as DebtItem;
        const currentPaid = debtData.paidAmount || 0;
        const debtRemaining = Math.max(0, debtData.totalAmount - currentPaid);
        if (debtRemaining <= 0) {
          throw new Error('هذا الدين مسدد بالكامل بالفعل.');
        }

        const fundBalance = Number(fundSnap.data().balance) || 0;
        if (fundBalance <= 0) {
          throw new Error('رصيد صندوق سداد الديون غير كافٍ لإتمام عملية السداد.');
        }

        // Strict calculation of actual payment bounded by requested, remaining debt, and available fund
        const actualPayment = Math.min(amountPaid, debtRemaining, fundBalance);
        if (actualPayment <= 0) {
          throw new Error('المبلغ الفعلي المتاح للسداد غير كافٍ.');
        }

        const newPaid = currentPaid + actualPayment;
        const newStatus = newPaid >= debtData.totalAmount ? 'تم' : 'قيد الانتظار';

        // Update debt record
        tx.update(debtRef, {
          paidAmount: newPaid,
          status: newStatus
        });

        // Deduct actualPayment directly from fund balance (no Math.max masking)
        tx.update(debtFundRef, {
          balance: fundBalance - actualPayment
        });

        // Record transfer transaction with actualPayment
        tx.set(newTxRef, {
          userId: user.uid,
          fromAccount: debtFund.name || 'صندوق سداد الديون',
          toAccount: `سداد دين: ${debtData.name}`,
          amount: actualPayment,
          date: new Date().toISOString().split('T')[0],
          notes: `تسجيل سداد فعلي من صندوق الديون (${actualPayment} ريال)`,
          referenceId: generateReferenceId('debt_pay')
        });
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'debts');
      throw e;
    }
  };

  /**
   * Atomic Salary Distribution with true Idempotency:
   * Uses deterministic idempotency document: salary_distributions/{userId_YYYY-MM}
   * Increments Main Bank Account with operationalAmount,
   * Increments dedicated funds with their allocations,
   * Logs income and transfer entries atomically.
   */
  const distributeSalaryTransactional = async (
    salaryAmount: number,
    allocations: {
      debtAmount: number;
      debtPct: number;
      emergencyAmount: number;
      emergencyPct: number;
      savingsAmount: number;
      savingsPct: number;
      operationalAmount: number;
      operationalPct: number;
    },
    monthStr: string,
    monthArabic: string
  ) => {
    if (!user || salaryAmount <= 0) return;
    const today = new Date().toISOString().split('T')[0];
    const salaryRefId = `salary_${user.uid}_${monthStr}`;
    const distDocId = `${user.uid}_${monthStr}`;
    const distDocRef = doc(db, 'salary_distributions', distDocId);

    // Target accounts
    const mainAcc = accounts.find(a => a.name === 'الحساب البنكي الرئيسي' || a.type === 'الحساب البنكي');
    const debtAcc = accounts.find(a => a.name === 'صندوق سداد الديون' || a.name.includes('الديون'));
    const emgAcc = accounts.find(a => a.name === 'صندوق الطوارئ' || a.name.includes('الطوارئ'));
    const savAcc = accounts.find(a => a.name === 'صندوق الادخار والاستثمار' || a.name.includes('الادخار'));

    await runTransaction(db, async (tx) => {
      // 1. Idempotency Check inside transaction
      const distSnap = await tx.get(distDocRef);
      if (distSnap.exists()) {
        throw new Error(`تم توزيع راتب شهر ${monthArabic} مسبقاً.`);
      }

      // 2. All Reads First
      let mainBalance = 0;
      let debtBalance = 0;
      let emgBalance = 0;
      let savBalance = 0;

      const mainRef = mainAcc?.id ? doc(db, 'accounts', mainAcc.id) : doc(collection(db, 'accounts'));
      const debtRef = debtAcc?.id ? doc(db, 'accounts', debtAcc.id) : doc(collection(db, 'accounts'));
      const emgRef = emgAcc?.id ? doc(db, 'accounts', emgAcc.id) : doc(collection(db, 'accounts'));
      const savRef = savAcc?.id ? doc(db, 'accounts', savAcc.id) : doc(collection(db, 'accounts'));

      if (mainAcc?.id) {
        const s = await tx.get(mainRef);
        if (s.exists()) mainBalance = Number(s.data().balance) || 0;
      }
      if (debtAcc?.id) {
        const s = await tx.get(debtRef);
        if (s.exists()) debtBalance = Number(s.data().balance) || 0;
      }
      if (emgAcc?.id) {
        const s = await tx.get(emgRef);
        if (s.exists()) emgBalance = Number(s.data().balance) || 0;
      }
      if (savAcc?.id) {
        const s = await tx.get(savRef);
        if (s.exists()) savBalance = Number(s.data().balance) || 0;
      }

      // 3. Writes
      // Record salary distribution idempotency lock
      tx.set(distDocRef, {
        userId: user.uid,
        month: monthStr,
        salaryAmount,
        allocations,
        createdAt: new Date().toISOString(),
        referenceId: salaryRefId
      });

      // Income entry
      const incomeExpenseRef = doc(collection(db, 'expenses'));
      tx.set(incomeExpenseRef, {
        userId: user.uid,
        type: 'دخل',
        date: today,
        category: 'الراتب',
        description: `إيداع وتوزيع راتب ${monthArabic} تلقائياً`,
        amount: salaryAmount,
        paymentMethod: 'الحساب البنكي الرئيسي',
        referenceId: salaryRefId
      });

      // Update Main Bank Account (+ operationalAmount)
      if (mainAcc?.id) {
        tx.update(mainRef, { balance: mainBalance + allocations.operationalAmount });
      } else {
        tx.set(mainRef, {
          userId: user.uid,
          name: 'الحساب البنكي الرئيسي',
          type: 'الحساب البنكي',
          balance: allocations.operationalAmount,
          currency: 'ريال سعودي',
          isArchived: false,
          notes: 'حساب الراتب والمصاريف المعيشية'
        });
      }

      // Update Debt Fund (+ debtAmount)
      if (debtAcc?.id) {
        tx.update(debtRef, { balance: debtBalance + allocations.debtAmount });
      } else {
        tx.set(debtRef, {
          userId: user.uid,
          name: 'صندوق سداد الديون',
          type: 'صندوق مخصص',
          balance: allocations.debtAmount,
          currency: 'ريال سعودي',
          isArchived: false,
          notes: 'مخصص سداد الديون'
        });
      }

      // Update Emergency Fund (+ emergencyAmount)
      if (emgAcc?.id) {
        tx.update(emgRef, { balance: emgBalance + allocations.emergencyAmount });
      } else {
        tx.set(emgRef, {
          userId: user.uid,
          name: 'صندوق الطوارئ',
          type: 'صندوق مخصص',
          balance: allocations.emergencyAmount,
          currency: 'ريال سعودي',
          isArchived: false,
          notes: 'مخصص الطوارئ'
        });
      }

      // Update Savings Fund (+ savingsAmount)
      if (savAcc?.id) {
        tx.update(savRef, { balance: savBalance + allocations.savingsAmount });
      } else {
        tx.set(savRef, {
          userId: user.uid,
          name: 'صندوق الادخار والاستثمار',
          type: 'صندوق مخصص',
          balance: allocations.savingsAmount,
          currency: 'ريال سعودي',
          isArchived: false,
          notes: 'مخصص الادخار والاستثمار'
        });
      }

      // Internal transfer logs
      const internalTransfers = [
        { to: 'صندوق سداد الديون', amt: allocations.debtAmount, pct: allocations.debtPct },
        { to: 'صندوق الطوارئ', amt: allocations.emergencyAmount, pct: allocations.emergencyPct },
        { to: 'صندوق الادخار والاستثمار', amt: allocations.savingsAmount, pct: allocations.savingsPct }
      ].filter(item => item.amt > 0);

      for (const item of internalTransfers) {
        const newTrRef = doc(collection(db, 'transactions'));
        tx.set(newTrRef, {
          userId: user.uid,
          fromAccount: 'الحساب البنكي الرئيسي',
          toAccount: item.to,
          amount: item.amt,
          date: today,
          notes: `تخصيص تلقائي لراتب ${monthArabic} بنسبة ${item.pct}%`,
          referenceId: salaryRefId
        });
      }
    });
  };

  /**
   * Atomic Reversal of Monthly Salary Distribution:
   * Validates that funds still contain their respective allocations before allowing cancellation!
   * Reverses only the exact amounts added without touching previous savings or masking deficits.
   */
  const cancelSalaryDistributionTransactional = async (monthStr: string) => {
    if (!user) return;
    const salaryRefId = `salary_${user.uid}_${monthStr}`;
    const distDocId = `${user.uid}_${monthStr}`;
    const distDocRef = doc(db, 'salary_distributions', distDocId);

    // Query salary expenses and transactions for this month
    const expQ = query(
      collection(db, 'expenses'),
      where('userId', '==', user.uid),
      where('category', '==', 'الراتب')
    );
    const transQ = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid)
    );

    const [expSnap, transSnap] = await Promise.all([getDocs(expQ), getDocs(transQ)]);

    const targetExpenses = expSnap.docs.filter(d => {
      const data = d.data() as Expense;
      return data.referenceId === salaryRefId || (data.date && data.date.startsWith(monthStr));
    });

    const targetTrans = transSnap.docs.filter(d => {
      const data = d.data() as Transaction;
      return data.referenceId === salaryRefId || (
        data.date && data.date.startsWith(monthStr) &&
        data.fromAccount === 'الحساب البنكي الرئيسي' &&
        (data.notes?.includes('تخصيص تلقائي') || data.notes?.includes('راتب'))
      );
    });

    const mainAcc = accounts.find(a => a.name === 'الحساب البنكي الرئيسي' || a.type === 'الحساب البنكي');
    const debtAcc = accounts.find(a => a.name === 'صندوق سداد الديون' || a.name.includes('الديون'));
    const emgAcc = accounts.find(a => a.name === 'صندوق الطوارئ' || a.name.includes('الطوارئ'));
    const savAcc = accounts.find(a => a.name === 'صندوق الادخار والاستثمار' || a.name.includes('الادخار'));

    await runTransaction(db, async (tx) => {
      // 1. Reads
      let mainBalance = 0;
      let debtBalance = 0;
      let emgBalance = 0;
      let savBalance = 0;

      const mainRef = mainAcc?.id ? doc(db, 'accounts', mainAcc.id) : null;
      const debtRef = debtAcc?.id ? doc(db, 'accounts', debtAcc.id) : null;
      const emgRef = emgAcc?.id ? doc(db, 'accounts', emgAcc.id) : null;
      const savRef = savAcc?.id ? doc(db, 'accounts', savAcc.id) : null;

      if (mainRef) {
        const s = await tx.get(mainRef);
        if (s.exists()) mainBalance = Number(s.data().balance) || 0;
      }
      if (debtRef) {
        const s = await tx.get(debtRef);
        if (s.exists()) debtBalance = Number(s.data().balance) || 0;
      }
      if (emgRef) {
        const s = await tx.get(emgRef);
        if (s.exists()) emgBalance = Number(s.data().balance) || 0;
      }
      if (savRef) {
        const s = await tx.get(savRef);
        if (s.exists()) savBalance = Number(s.data().balance) || 0;
      }

      // Calculate deduction amounts from target transfers
      let debtToDeduct = 0;
      let emgToDeduct = 0;
      let savToDeduct = 0;

      for (const tDoc of targetTrans) {
        const t = tDoc.data() as Transaction;
        if (t.toAccount.includes('الديون')) debtToDeduct += t.amount || 0;
        if (t.toAccount.includes('طوارئ') || t.toAccount.includes('الطوارئ')) emgToDeduct += t.amount || 0;
        if (t.toAccount.includes('الادخار') || t.toAccount.includes('استثمار')) savToDeduct += t.amount || 0;
      }

      const totalSalaryAmount = targetExpenses.reduce((sum, e) => sum + ((e.data() as Expense).amount || 0), 0);
      const operationalToDeduct = Math.max(0, totalSalaryAmount - (debtToDeduct + emgToDeduct + savToDeduct));

      // Strict Pre-Check: Do balances cover the reversal amounts?
      const insufficientFunds: string[] = [];
      if (mainRef && mainBalance < operationalToDeduct) {
        insufficientFunds.push(`الحساب البنكي (المطلوب عكسه: ${operationalToDeduct}، المتوفر: ${mainBalance})`);
      }
      if (debtRef && debtBalance < debtToDeduct) {
        insufficientFunds.push(`صندوق الديون (المطلوب عكسه: ${debtToDeduct}، المتوفر: ${debtBalance})`);
      }
      if (emgRef && emgBalance < emgToDeduct) {
        insufficientFunds.push(`صندوق الطوارئ (المطلوب عكسه: ${emgToDeduct}، المتوفر: ${emgBalance})`);
      }
      if (savRef && savBalance < savToDeduct) {
        insufficientFunds.push(`صندوق الادخار (المطلوب عكسه: ${savToDeduct}، المتوفر: ${savBalance})`);
      }

      if (insufficientFunds.length > 0) {
        throw new Error(`لا يمكن إلغاء توزيع الراتب؛ لأن جزءاً من مخصصات هذا الشهر تم استهلاكه في عمليات لاحقة. النقص في: ${insufficientFunds.join('، ')}.`);
      }

      // 2. Writes - deduct exact amounts without Math.max masking
      if (mainRef) {
        tx.update(mainRef, { balance: mainBalance - operationalToDeduct });
      }
      if (debtRef && debtToDeduct > 0) {
        tx.update(debtRef, { balance: debtBalance - debtToDeduct });
      }
      if (emgRef && emgToDeduct > 0) {
        tx.update(emgRef, { balance: emgBalance - emgToDeduct });
      }
      if (savRef && savToDeduct > 0) {
        tx.update(savRef, { balance: savBalance - savToDeduct });
      }

      // Delete target documents
      for (const eDoc of targetExpenses) {
        tx.delete(doc(db, 'expenses', eDoc.id));
      }
      for (const tDoc of targetTrans) {
        tx.delete(doc(db, 'transactions', tDoc.id));
      }

      // Remove idempotency lock if exists
      const distSnap = await tx.get(distDocRef);
      if (distSnap.exists()) {
        tx.delete(distDocRef);
      }
    });
  };

  const addAccountItem = async (acc: Omit<AccountItem, 'id' | 'userId'>) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'accounts'), { ...acc, userId: user.uid });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'accounts');
    }
  };

  const addBillItem = async (bill: Omit<SubscriptionBill, 'id' | 'userId'>) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'subscriptions'), { ...bill, userId: user.uid });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'subscriptions');
    }
  };

  const toggleBillStatus = async (billId: string, currentStatus: string) => {
    if (!user) return;
    try {
      const newStatus = currentStatus === 'مدفوع' ? 'غير مدفوع' : 'مدفوع';
      await updateDoc(doc(db, 'subscriptions', billId), {
        status: newStatus,
        lastPaidDate: newStatus === 'مدفوع' ? new Date().toISOString().split('T')[0] : null
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'subscriptions');
    }
  };

  const addGoalItem = async (goal: Omit<FinancialGoal, 'id' | 'userId'>) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'goals'), { ...goal, userId: user.uid });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'goals');
    }
  };

  const updateGoalProgress = async (goalId: string, addedAmount: number) => {
    if (!user) return;
    try {
      const goal = goals.find(g => g.id === goalId);
      if (goal) {
        const newAmt = (goal.currentAmount || 0) + addedAmount;
        const newStatus = newAmt >= goal.targetAmount ? 'مكتمل' : 'جاري التنفيذ';
        await updateDoc(doc(db, 'goals', goalId), {
          currentAmount: newAmt,
          status: newStatus
        });
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'goals');
    }
  };

  const addDebtItem = async (debt: Omit<DebtItem, 'id' | 'userId'>) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'debts'), { ...debt, userId: user.uid });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'debts');
    }
  };

  const updateSettingsSalary = async (newSalary: number) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'settings', user.uid), {
        userId: user.uid,
        salary: newSalary,
        currency: settings?.currency || 'ريال سعودي'
      }, { merge: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'settings');
    }
  };

  return {
    user,
    settings,
    budget,
    debts,
    savings,
    expenses,
    tasks,
    goals,
    transactions,
    accounts,
    investments,
    subscriptions,
    financialEvents,
    monthlyClosures,
    loading,

    // Actions
    addTransaction,
    deleteTransaction,
    updateExpenseTransactional,
    clearExpensesTransactional,
    quickAddExpenseTransactional,
    quickAddIncomeLivingTransactional,
    quickAddIncomeEmergencyTransactional,
    quickAddIncomeSavingsTransactional,
    quickAddIncomeDebtTransactional,
    quickAddIncomeSalarySplitTransactional,
    quickAddIncomeUnallocatedTransactional,
    addTransferTransactional,
    deleteTransferTransactional,
    addAccountItem,
    addBillItem,
    toggleBillStatus,
    addGoalItem,
    updateGoalProgress,
    addDebtItem,
    payDebtPart,
    transferFunds,
    updateSettingsSalary,
    distributeSalaryTransactional,
    cancelSalaryDistributionTransactional
  };
}
