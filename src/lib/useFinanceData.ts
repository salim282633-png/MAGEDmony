/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
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
  increment
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
  const hasSeededTransfersRef = useRef(false);

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

    // Settings
    const unsubSettings = onSnapshot(doc(db, 'settings', userId), async (settingsDoc) => {
      if (settingsDoc.exists()) {
        const data = settingsDoc.data() as UserSettings;
        setSettings(data);
        if (!data.salary || data.salary === 7000 || data.salary === 10000) {
          await setDoc(doc(db, 'settings', userId), { salary: 2500 }, { merge: true }).catch(console.error);
        }
      } else {
        const initialSettings: UserSettings = {
          userId,
          salary: 2500,
          currency: 'ريال سعودي'
        };
        await setDoc(doc(db, 'settings', userId), initialSettings).catch(console.error);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'settings'));

    // Budgets
    const unsubBudget = onSnapshot(query(collection(db, 'budgets'), where('userId', '==', userId)), async (snap) => {
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() } as BudgetItem));
      setBudget(fetched);
      if (snap.empty) {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const defaults: Omit<BudgetItem, 'id'>[] = [
          { userId, name: 'السكن والإيجار', planned: 2500, actual: 2500, month: currentMonth, notes: 'التزام شهري حتمي' },
          { userId, name: 'الادخار والتوفير', planned: 1000, actual: 1000, month: currentMonth, notes: 'مخصص شهري تلقائي' },
          { userId, name: 'المصاريف الشخصية والطعام', planned: 2000, actual: 1500, month: currentMonth, notes: 'مصاريف معيشية يومية' }
        ];
        defaults.forEach(b => addDoc(collection(db, 'budgets'), b));
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'budgets'));

    // Debts
    const unsubDebts = onSnapshot(query(collection(db, 'debts'), where('userId', '==', userId)), async (snap) => {
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() } as DebtItem));
      
      // Auto-deduplicate duplicate debts with same name, totalAmount, and paidAmount
      const seenDebtKeys = new Set<string>();
      const duplicatesToDelete: DebtItem[] = [];
      const uniqueDebts: DebtItem[] = [];

      for (const debt of fetched) {
        const key = `${(debt.name || '').trim()}_${debt.totalAmount}_${debt.paidAmount}`;
        if (seenDebtKeys.has(key)) {
          duplicatesToDelete.push(debt);
        } else {
          seenDebtKeys.add(key);
          uniqueDebts.push(debt);
        }
      }

      for (const dup of duplicatesToDelete) {
        if (dup.id) {
          await deleteDoc(doc(db, 'debts', dup.id)).catch(console.error);
        }
      }

      setDebts(uniqueDebts);

      if (snap.empty) {
        const defaultDebt: Omit<DebtItem, 'id'> = {
          userId,
          name: 'دين المعيشة',
          totalAmount: 10750,
          paidAmount: 0,
          status: 'قيد الانتظار',
          dueDate: new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0]
        };
        addDoc(collection(db, 'debts'), defaultDebt).catch(console.error);
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'debts'));

    // Savings
    const unsubSavings = onSnapshot(query(collection(db, 'savings'), where('userId', '==', userId)), async (snap) => {
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() } as SavingsRecord));
      setSavings(fetched);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'savings'));

    // Expenses & Income
    const unsubExpenses = onSnapshot(query(collection(db, 'expenses'), where('userId', '==', userId)), async (snap) => {
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() } as Expense));
      setExpenses(fetched);

      // Auto-deduplicate duplicate salary distribution transactions and remove unwanted 300 SAR income entry
      const seenSalaryKeys = new Set<string>();
      const duplicateIdsToDelete: string[] = [];

      for (const item of fetched) {
        // Automatically fix the 250 SAR transaction to ensure it is treated as a regular living expense (Food/Living) not debt
        if (item.amount === 250 && item.id && (item.category === 'الديون' || item.category === 'سداد دين' || item.paymentMethod === 'صندوق سداد الديون' || item.description?.includes('دين'))) {
          updateDoc(doc(db, 'expenses', item.id), {
            category: 'الطعام',
            description: 'مصاريف طعام ومعيشة',
            paymentMethod: 'الحساب البنكي الرئيسي',
            type: 'مصروف'
          }).catch(console.error);
        }

        // Unify category name to 'الطعام' for any 'الطعام والمشروبات'
        if (item.id && item.category === 'الطعام والمشروبات') {
          updateDoc(doc(db, 'expenses', item.id), {
            category: 'الطعام'
          }).catch(console.error);
        }

        // Automatically delete any unwanted legacy 300 SAR income transaction or 400/300 fake expenses
        if (item.type === 'دخل' && (item.amount === 300 || item.description?.includes('300'))) {
          if (item.id) duplicateIdsToDelete.push(item.id);
          continue;
        }

        // Delete any mistaken internal transfers logged as expenses
        const isValidSalaryDistribution = item.type === 'دخل' && item.category === 'الراتب' && item.description?.includes('توزيع');
        if (!isValidSalaryDistribution && (item.category === 'صندوق مخصص' || item.description?.includes('توزيع') || item.description?.includes('تخصيص') || item.description?.includes('استثمار') || item.description?.includes('طوارئ'))) {
          if (item.id) duplicateIdsToDelete.push(item.id);
          continue;
        }

        // Auto delete if there's a 700 or 750 fake expense or luxury transfer, just to be sure
        if (item.amount === 700 || item.amount === 750 || item.description?.includes('كماليات') || item.category?.includes('كماليات')) {
           if (item.id) duplicateIdsToDelete.push(item.id);
           continue;
        }

        // Automatically delete specified test/mock expenses (200, 300, 200) that are not Food (الطعام)
        if ((item.amount === 200 || item.amount === 300) && item.type !== 'دخل' && item.category !== 'الطعام') {
          if (item.id) duplicateIdsToDelete.push(item.id);
          continue;
        }

        // Delete any 300, 400 that are expenses and appear to be dummy
        if ((item.amount === 300 || item.amount === 400) && item.type !== 'دخل') {
           if (item.id) duplicateIdsToDelete.push(item.id);
           continue;
        }

        if (item.category === 'الراتب') {
          const monthKey = item.date ? item.date.substring(0, 7) : '';
          const key = `salary_${monthKey}`;
          if (seenSalaryKeys.has(key)) {
            if (item.id) duplicateIdsToDelete.push(item.id);
          } else {
            seenSalaryKeys.add(key);
          }
        }
      }

      if (duplicateIdsToDelete.length > 0) {
        duplicateIdsToDelete.forEach(async (id) => {
          const item = fetched.find(e => e.id === id);
          if (item && item.paymentMethod && item.amount) {
            const acc = accounts.find(a => a.name === item.paymentMethod);
            if (acc && acc.id) {
              const delta = item.type === 'دخل' ? -item.amount : item.amount;
              await updateDoc(doc(db, 'accounts', acc.id), {
                balance: increment(delta)
              }).catch(console.error);
            }
          }
          deleteDoc(doc(db, 'expenses', id)).catch(console.error);
        });
      }

      if (snap.empty) {
        const today = new Date().toISOString().split('T')[0];
        const defaultIncome: Omit<Expense, 'id'> = {
          userId,
          type: 'دخل',
          date: today,
          category: 'الراتب',
          description: 'راتب شهري',
          amount: 2500,
          paymentMethod: 'الحساب البنكي الرئيسي'
        };
        addDoc(collection(db, 'expenses'), defaultIncome).catch(console.error);
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'expenses'));

    // Tasks
    const unsubTasks = onSnapshot(query(collection(db, 'tasks'), where('userId', '==', userId)), (snap) => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'tasks'));

    // Goals
    const unsubGoals = onSnapshot(query(collection(db, 'goals'), where('userId', '==', userId)), (snap) => {
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() } as FinancialGoal));
      setGoals(fetched);
      if (snap.empty) {
        const defaults = [
          { title: 'ادخار شهري للإنقاذ والطوارئ', targetAmount: 1000, currentAmount: 0, status: 'جاري التنفيذ' }
        ];
        defaults.forEach(g => addDoc(collection(db, 'goals'), { ...g, userId }));
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'goals'));

    // Transactions
    const unsubTrans = onSnapshot(query(collection(db, 'transactions'), where('userId', '==', userId)), async (snap) => {
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));

      // 1. Identify unwanted entries (e.g. 750 SAR or luxury entries)
      const toDelete = fetched.filter(t => 
        t.amount === 750 || 
        t.notes?.includes('كماليات') || 
        t.fromAccount?.includes('كماليات') || 
        t.toAccount?.includes('كماليات')
      );

      // 2. Identify duplicate transfers (same fromAccount, toAccount, and amount)
      const seenKeys = new Set<string>();
      const duplicatesToDelete: Transaction[] = [];
      const uniqueTransfers: Transaction[] = [];

      for (const t of fetched) {
        if (toDelete.some(td => td.id === t.id)) continue;

        const fromAcc = (t.fromAccount || '').trim();
        const toAcc = (t.toAccount || '').trim();
        const key = `${fromAcc}->${toAcc}_${t.amount}`;

        if (seenKeys.has(key)) {
          duplicatesToDelete.push(t);
        } else {
          seenKeys.add(key);
          uniqueTransfers.push(t);
        }
      }

      // Delete unwanted and duplicate items from Firestore asynchronously
      const allToDelete = [...toDelete, ...duplicatesToDelete];
      for (const t of allToDelete) {
        if (t.id) {
          await deleteDoc(doc(db, 'transactions', t.id)).catch(console.error);
        }
      }

      setTransactions(uniqueTransfers);

      // Seed missing default transfers ONCE if needed
      if (!hasSeededTransfersRef.current) {
        hasSeededTransfersRef.current = true;
        const today = new Date().toISOString().split('T')[0];
        const defaultTransfers = [
          { fromAccount: 'الحساب البنكي الرئيسي', toAccount: 'صندوق سداد الديون', amount: 650, notes: 'تخصيص آلي - سداد الديون (26%)' },
          { fromAccount: 'الحساب البنكي الرئيسي', toAccount: 'صندوق الطوارئ', amount: 400, notes: 'تخصيص آلي - صندوق الطوارئ (16%)' },
          { fromAccount: 'الحساب البنكي الرئيسي', toAccount: 'صندوق الادخار والاستثمار', amount: 300, notes: 'تخصيص آلي - الادخار والاستثمار (12%)' },
        ];

        for (const dt of defaultTransfers) {
          const exists = uniqueTransfers.some(t => 
            (t.toAccount === dt.toAccount || (t.toAccount && dt.toAccount.includes(dt.toAccount.replace('صندوق ', '')))) && 
            t.amount === dt.amount
          );
          if (!exists) {
            await addDoc(collection(db, 'transactions'), {
              userId,
              ...dt,
              date: today
            }).catch(console.error);
          }
        }
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'transactions'));

    // Accounts
    const unsubAccounts = onSnapshot(query(collection(db, 'accounts'), where('userId', '==', userId)), async (snap) => {
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() } as AccountItem));
      setAccounts(fetched);

      if (snap.empty) {
        const defaults: Omit<AccountItem, 'id'>[] = [
          { userId, name: 'الحساب البنكي الرئيسي', type: 'الحساب البنكي', balance: 2500, currency: 'ريال سعودي', isArchived: false, notes: 'حساب تحويل الراتب الرئيسي' },
          { userId, name: 'صندوق الطوارئ', type: 'صندوق مخصص', balance: 400, currency: 'ريال سعودي', isArchived: false, notes: 'صندوق مخصص للطوارئ لتغطية 3-6 أشهر' },
          { userId, name: 'صندوق الادخار والاستثمار', type: 'صندوق مخصص', balance: 300, currency: 'ريال سعودي', isArchived: false, notes: 'صندوق الادخار والاستثمار طويل المدى' },
          { userId, name: 'صندوق سداد الديون', type: 'صندوق مخصص', balance: 650, currency: 'ريال سعودي', isArchived: false, notes: 'صندوق مخصص لسداد الديون' },
          { userId, name: 'صندوق المصاريف الأساسية', type: 'صندوق مخصص', balance: 1150, currency: 'ريال سعودي', isArchived: false, notes: 'صندوق المصاريف التشغيلية والأساسية' },
          { userId, name: 'المحفظة النقدية', type: 'نقد', balance: 0, currency: 'ريال سعودي', isArchived: false, notes: 'كاش للمصاريف اليومية' }
        ];
        defaults.forEach(acc => addDoc(collection(db, 'accounts'), acc));
      } else {
        // Ensure core funds exist and have valid non-zero initial balances if currently zero
        const coreBoxesDefaults: Record<string, { balance: number; notes: string; type: string }> = {
          'صندوق الطوارئ': { balance: 400, notes: 'صندوق مخصص للطوارئ لتغطية 3-6 أشهر', type: 'صندوق مخصص' },
          'صندوق الادخار والاستثمار': { balance: 300, notes: 'صندوق الادخار والاستثمار طويل المدى', type: 'صندوق مخصص' },
          'صندوق سداد الديون': { balance: 650, notes: 'صندوق مخصص لسداد الديون', type: 'صندوق مخصص' },
          'الحساب البنكي الرئيسي': { balance: 1150, notes: 'حساب تحويل الراتب الرئيسي ومخصص المعيشة', type: 'الحساب البنكي' }
        };

        for (const [boxName, def] of Object.entries(coreBoxesDefaults)) {
          const existing = fetched.find(a => a.name === boxName || a.name.includes(boxName));
          if (!existing) {
            await addDoc(collection(db, 'accounts'), {
              userId,
              name: boxName,
              type: def.type,
              balance: def.balance,
              currency: 'ريال سعودي',
              isArchived: false,
              notes: def.notes
            }).catch(console.error);
          } else if ((existing.balance || 0) === 0 && existing.id) {
            // If balance is 0, restore default allocation
            await updateDoc(doc(db, 'accounts', existing.id), {
              balance: def.balance
            }).catch(console.error);
          }
        }
        

      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'accounts'));

    // Investments
    const unsubInvestments = onSnapshot(query(collection(db, 'investments'), where('userId', '==', userId)), (snap) => {
      setInvestments(snap.docs.map(d => ({ id: d.id, ...d.data() } as InvestmentItem)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'investments'));

    // Subscriptions & Bills
    const unsubSubscriptions = onSnapshot(query(collection(db, 'subscriptions'), where('userId', '==', userId)), async (snap) => {
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() } as SubscriptionBill));
      setSubscriptions(fetched);

      if (snap.empty) {
        const today = new Date();
        const futureDate = new Date(today);
        futureDate.setDate(futureDate.getDate() + 10);
        const dueDateStr = futureDate.toISOString().split('T')[0];

        const defaults: Omit<SubscriptionBill, 'id'>[] = [
          { 
            userId, 
            name: 'فاتورة الإيجار', 
            category: 'الإيجار', 
            amount: 2500, 
            currency: 'ريال', 
            dueDate: dueDateStr, 
            cycle: 'شهري', 
            status: 'غير مدفوع', 
            reminderDaysBefore: 5, 
            isReminderActive: true, 
            paymentAccount: 'الحساب البنكي الرئيسي' 
          },
          { 
            userId, 
            name: 'فاتورة الكهرباء والإنترنت', 
            category: 'الكهرباء', 
            amount: 400, 
            currency: 'ريال', 
            dueDate: dueDateStr, 
            cycle: 'شهري', 
            status: 'غير مدفوع', 
            reminderDaysBefore: 3, 
            isReminderActive: true, 
            paymentAccount: 'الحساب البنكي الرئيسي' 
          }
        ];
        defaults.forEach(sub => addDoc(collection(db, 'subscriptions'), sub));
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'subscriptions'));

    // Events
    const unsubEvents = onSnapshot(query(collection(db, 'financial_events'), where('userId', '==', userId)), (snap) => {
      setFinancialEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as FinancialEvent)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'financial_events'));

    // Monthly Closures
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

  // Helper Actions
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

  const addTransaction = async (expense: Omit<Expense, 'id' | 'userId'>) => {
    if (!user) return;
    try {
      const docRef = await addDoc(collection(db, 'expenses'), { ...expense, userId: user.uid });
      // Update account balance if matching account exists
      if (expense.amount) {
        const acc = findAccountByMethod(expense.paymentMethod);
        if (acc && acc.id) {
          const delta = expense.type === 'دخل' ? expense.amount : -expense.amount;
          await updateDoc(doc(db, 'accounts', acc.id), {
            balance: increment(delta)
          });
        }
      }
      return docRef.id;
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'expenses');
    }
  };

  const deleteTransaction = async (id: string) => {
    if (!user) return;
    try {
      const expense = expenses.find(e => e.id === id);
      if (expense && expense.amount) {
        const acc = findAccountByMethod(expense.paymentMethod);
        if (acc && acc.id) {
          // Revert the balance change: if it was income, subtract; if expense, add back.
          const delta = expense.type === 'دخل' ? -expense.amount : expense.amount;
          await updateDoc(doc(db, 'accounts', acc.id), {
            balance: increment(delta)
          });
        }
      }
      await deleteDoc(doc(db, 'expenses', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'expenses');
    }
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

  const payDebtPart = async (debtId: string, amountPaid: number) => {
    if (!user) return;
    try {
      const debt = debts.find(d => d.id === debtId);
      if (debt) {
        const newPaid = (debt.paidAmount || 0) + amountPaid;
        const isDone = newPaid >= debt.totalAmount;
        await updateDoc(doc(db, 'debts', debtId), {
          paidAmount: Math.min(debt.totalAmount, newPaid),
          status: isDone ? 'تم' : 'قيد الانتظار'
        });
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'debts');
    }
  };

  const transferFunds = async (fromAccName: string, toAccName: string, amount: number, notes?: string) => {
    if (!user || amount <= 0) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        fromAccount: fromAccName,
        toAccount: toAccName,
        amount,
        date: today,
        notes: notes || 'تحويل بين الحسابات'
      });

      const fromAcc = accounts.find(a => a.name === fromAccName);
      const toAcc = accounts.find(a => a.name === toAccName);

      if (fromAcc && fromAcc.id) {
        await updateDoc(doc(db, 'accounts', fromAcc.id), {
          balance: increment(-amount)
        });
      }

      if (toAcc && toAcc.id) {
        await updateDoc(doc(db, 'accounts', toAcc.id), {
          balance: increment(amount)
        });
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'transactions');
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
    addAccountItem,
    addBillItem,
    toggleBillStatus,
    addGoalItem,
    updateGoalProgress,
    addDebtItem,
    payDebtPart,
    transferFunds,
    updateSettingsSalary
  };
}
