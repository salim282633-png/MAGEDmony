const fs = require('fs');
let code = fs.readFileSync('src/components/SettingsView.tsx', 'utf8');

if (code.includes('import { getPrimaryBankAccount } from')) {
  // Extract it and put it at the top
  code = code.replace(/import \{ getPrimaryBankAccount \} from '\.\.\/types';\n/, '');
  code = `import { getPrimaryBankAccount } from '../types';\n` + code;
}

// Ensure the mainAcc definition works correctly.
fs.writeFileSync('src/components/SettingsView.tsx', code);
