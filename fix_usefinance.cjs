const fs = require('fs');
let code = fs.readFileSync('src/lib/useFinanceData.ts', 'utf8');

// In addAccount: prevent creating a new bank account
code = code.replace(
  `const addAccount = async (account: Omit<AccountItem, 'id' | 'userId'>) => {`,
  `const addAccount = async (account: Omit<AccountItem, 'id' | 'userId'>) => {
    if (account.type === 'الحساب البنكي' || account.name === PRIMARY_BANK_NAME || account.isPrimaryBank) {
      throw new Error(\`يمنع إنشاء حساب بنكي إضافي. «\${PRIMARY_BANK_NAME}» هو الحساب البنكي الرئيسي والوحيد في النظام.\`);
    }`
);

// In updateAccount: prevent renaming, changing type, archiving of primary bank
code = code.replace(
  `const updateAccount = async (id: string, updates: Partial<AccountItem>) => {`,
  `const updateAccount = async (id: string, updates: Partial<AccountItem>) => {
    const existing = accounts.find(a => a.id === id);
    if (existing && (existing.isPrimaryBank || existing.name === PRIMARY_BANK_NAME)) {
      if (updates.name && updates.name !== existing.name) throw new Error("لا يمكن تغيير اسم بنك الشامل.");
      if (updates.type && updates.type !== existing.type) throw new Error("لا يمكن تغيير نوع بنك الشامل.");
      if (updates.isArchived) throw new Error("لا يمكن أرشفة بنك الشامل.");
    }`
);

// In deleteAccount: prevent deleting primary bank
code = code.replace(
  `const deleteAccount = async (id: string) => {`,
  `const deleteAccount = async (id: string) => {
    const existing = accounts.find(a => a.id === id);
    if (existing && (existing.isPrimaryBank || existing.name === PRIMARY_BANK_NAME)) {
      throw new Error("لا يمكن حذف بنك الشامل أبداً.");
    }`
);

fs.writeFileSync('src/lib/useFinanceData.ts', code);
