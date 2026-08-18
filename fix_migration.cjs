const fs = require('fs');
let code = fs.readFileSync('src/lib/bankMigration.ts', 'utf8');

// Fix 1: read accounts inside transaction
code = code.replace(
  `  const rawAccounts = accSnap.docs.map(d => ({ id: d.id, ...d.data() } as AccountItem));`,
  `  const rawAccounts = accSnap.docs.map(d => ({ id: d.id, ...d.data() } as AccountItem));
  // Note: expenses, transactions, subscriptions are only updated for their names/IDs, not balances, so outside fetch is ok for them.
  // BUT we must fetch accounts inside tx to get accurate balances.
  `
);

code = code.replace(
  `    const settingsData = settingsSnap.exists() ? (settingsSnap.data() as UserSettings) : null;`,
  `    const settingsData = settingsSnap.exists() ? (settingsSnap.data() as UserSettings) : null;
    
    // Read all account documents inside transaction to get latest balances
    const accountRefs = rawAccounts.map(a => doc(db, 'accounts', a.id!));
    const txAccountSnaps = await Promise.all(accountRefs.map(ref => tx.get(ref)));
    const txAccounts = txAccountSnaps.map(snap => ({ id: snap.id, ...snap.data() } as AccountItem));
`
);

code = code.replace(
  `    // Run pure calculation
    const migration = migrateBankAccountsPure(
      rawAccounts,`,
  `    // Run pure calculation
    const migration = migrateBankAccountsPure(
      txAccounts,`
);

// Fix 2: fix transactions update bug
code = code.replace(
  `          fromAccountId: t.fromAccountId || migration.primaryBank.id,
          toAccount: t.toAccount,
          toAccountId: t.toAccountId || migration.primaryBank.id`,
  `          fromAccountId: t.fromAccountId,
          toAccount: t.toAccount,
          toAccountId: t.toAccountId`
);

fs.writeFileSync('src/lib/bankMigration.ts', code);
