const fs = require('fs');

function fix(file) {
  let code = fs.readFileSync(file, 'utf8');
  if (file.includes('SettingsView')) {
    code = code.replace(/const mainAcc = accounts\.find[^;]+;/, `import { getPrimaryBankAccount } from '../types';\nconst mainAcc = getPrimaryBankAccount(accounts);`);
  }
  if (file.includes('QuickAddModal')) {
    code = code.replace(/const mainAcc = accounts\.find[^;]+;/, `const mainAcc = getPrimaryBankAccount(accounts);`);
  }
  fs.writeFileSync(file, code);
}

fix('src/components/SettingsView.tsx');
fix('src/components/QuickAddModal.tsx');
