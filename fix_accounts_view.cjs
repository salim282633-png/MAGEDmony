const fs = require('fs');
let code = fs.readFileSync('src/components/AccountsView.tsx', 'utf8');

if (!code.includes('import { PRIMARY_BANK_NAME }')) {
  code = `import { PRIMARY_BANK_NAME } from '../lib/constants';\n` + code;
}

code = code.replace(
  `{acc.name}
                </h3>`,
  `{acc.name}
                  {acc.isPrimaryBank && <span className="mr-2 text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">بنك الشامل</span>}
                </h3>`
);

code = code.replace(
  /onClick=\{\(\) => setEditingAccount\(acc\)\}/g,
  `onClick={() => !acc.isPrimaryBank && setEditingAccount(acc)} disabled={acc.isPrimaryBank} title={acc.isPrimaryBank ? "لا يمكن تعديل بنك الشامل" : ""}`
);

code = code.replace(
  /onClick=\{\(\) => handleDelete\(acc\.id\!\)\}/g,
  `onClick={() => !acc.isPrimaryBank && handleDelete(acc.id!)} disabled={acc.isPrimaryBank} title={acc.isPrimaryBank ? "لا يمكن حذف بنك الشامل" : ""}`
);

code = code.replace(
  /onClick=\{\(\) => handleArchive\(acc\.id\!, !acc\.isArchived\)\}/g,
  `onClick={() => !acc.isPrimaryBank && handleArchive(acc.id!, !acc.isArchived)} disabled={acc.isPrimaryBank} title={acc.isPrimaryBank ? "لا يمكن أرشفة بنك الشامل" : ""}`
);

fs.writeFileSync('src/components/AccountsView.tsx', code);
