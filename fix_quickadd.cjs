const fs = require('fs');
let code = fs.readFileSync('src/components/QuickAddModal.tsx', 'utf8');

if (!code.includes('import { getPrimaryBankAccount } from')) {
  code = `import { getPrimaryBankAccount } from '../types';\n` + code;
}

fs.writeFileSync('src/components/QuickAddModal.tsx', code);
