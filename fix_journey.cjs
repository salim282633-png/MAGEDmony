const fs = require('fs');
let code = fs.readFileSync('src/components/TenYearJourneyView.tsx', 'utf8');

code = code.replace(
  `أين سأكون بعد 10 سنوات؟\n            </h1>`,
  `أين سأكون بعد 10 سنوات؟\n            </h1>\n            <p className="text-emerald-200/90 text-[11px] md:text-xs font-bold max-w-2xl mt-2 bg-emerald-900/30 p-2 rounded-lg border border-emerald-500/20">💡 <b>ملاحظة:</b> محرك المحاكاة يفترض أن مخصص الديون (26%) يتم استخدامه فعليًا لسداد الديون القائمة شهريًا بانتظام، مما يؤدي إلى خفض إجمالي الدين حتى سداده بالكامل، ليعاد توجيه المخصص للادخار.</p>`
);

fs.writeFileSync('src/components/TenYearJourneyView.tsx', code);
