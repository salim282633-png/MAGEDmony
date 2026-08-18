const fs = require('fs');
let code = fs.readFileSync('src/lib/useFinanceData.ts', 'utf8');

code = code.replace(/const mainAcc = accounts\.find[^;]+;/g, 'const mainAcc = getPrimaryBankAccount(accounts);');
code = code.replace(/if \(!mainAcc\) \{\n.*throw new Error\('لا يوجد حساب رئيسي'\);\n.*\}/g, `if (!mainAcc) {
      throw new Error(\`لا يوجد حساب بنكي. يرجى إضافة \${PRIMARY_BANK_NAME} أولاً.\`);
    }`);

fs.writeFileSync('src/lib/useFinanceData.ts', code);
