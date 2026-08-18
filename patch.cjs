const fs = require('fs');
let code = fs.readFileSync('src/components/DebtView.tsx', 'utf8');

const target = `  const handleUpdatePaidSubmit = async (id: string, currentPaid: number, total: number) => {
    const paid = parseFloat(payAmountInput);
    if (isNaN(paid) || paid <= 0) return;
    const newPaid = Math.min(currentPaid + paid, total);
    const newStatus = newPaid === total ? 'تم' : 'قيد الانتظار';
    
    await updateDoc(doc(db, 'debts', id), {
      paidAmount: newPaid,
      status: newStatus
    });
    setPayingDebtId(null);
    setPayAmountInput('');
  };`;

const replacement = `  const handleUpdatePaidSubmit = async (id: string, currentPaid: number, total: number) => {
    const paid = parseFloat(payAmountInput);
    if (isNaN(paid) || paid <= 0) return;
    const newPaid = Math.min(currentPaid + paid, total);
    const newStatus = newPaid === total ? 'تم' : 'قيد الانتظار';
    
    await updateDoc(doc(db, 'debts', id), {
      paidAmount: newPaid,
      status: newStatus
    });

    const debtFund = accounts.find(a => a.name === 'صندوق سداد الديون' || a.name.includes('الديون'));
    if (debtFund && debtFund.id && auth.currentUser) {
      const debtItem = debts.find(d => d.id === id);
      await updateDoc(doc(db, 'accounts', debtFund.id), {
        balance: Math.max(0, debtFund.balance - paid)
      });
      await addDoc(collection(db, 'transactions'), {
        userId: auth.currentUser.uid,
        fromAccount: debtFund.name,
        toAccount: 'سداد دين: ' + (debtItem?.name || ''),
        amount: paid,
        date: new Date().toISOString().split('T')[0],
        notes: 'تسجيل سداد من صندوق الديون'
      });
    }

    setPayingDebtId(null);
    setPayAmountInput('');
  };`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/DebtView.tsx', code);
