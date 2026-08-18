const fs = require('fs');
let code = fs.readFileSync('src/components/SmartNotifications.tsx', 'utf8');

const target = `  // 3.1 إشعار الالتزام بالقاعدة الذهبية 46% للمصاريف الأساسية
  const essentialBudget = budget.find(b => b.name.includes('الأساسية') || b.name.includes('الأهل'));
  if (essentialBudget) {
    notifications.push({
      id: 'essential-46-rule',
      type: 'success',
      title: 'توزيع منضبط للمصاريف الأساسية (46%)',
      message: 'المصاريف الأساسية تشمل مساعدة الأهل ومثبتة بنسبة 46% (تلتزم بالقاعدة الذهبية بعدم تجاوز الأساسيات 50%). تم تفعيل منع المصاريف الشخصية من تجاوز هذا الحد.',
      icon: CheckCircle2
    });
  }

  // 3.2 إشعار المقتطعات الشهرية الإلزامية (54% = 1,350 ريال)
  notifications.push({
    id: 'mandatory-deductions-rule',
    type: 'success',
    title: 'خطة المقتطعات الشهرية الإلزامية (1,350 ريال)',
    message: 'اقتطاع شهري مباشر: سداد الديون (650 ريال / 26%) + صندوق الطوارئ (400 ريال / 16%) + استثمار طويل المدى (300 ريال / 12%). المجموع: 1,350 ريال (54% من الراتب).',
    icon: ShieldCheck
  });

  const totalPlanned = budget.reduce((acc, curr) => acc + curr.planned, 0);
  const totalActual = budget.reduce((acc, curr) => acc + curr.actual, 0);
  
  if (totalPlanned > 0 && totalActual >= totalPlanned * 0.8 && totalActual <= totalPlanned) {
    notifications.push({
      id: 'budget-80',
      type: 'info',
      title: 'اقتراب من حد الميزانية',
      message: 'وصلت إلى 80% من إجمالي ميزانيتك الشهرية. يرجى ضبط النفقات.',
      icon: Info
    });
  }`;

const replacement = `  // 3.2 إشعار المقتطعات الشهرية الإلزامية (54%)
  const salary = settings?.salary || 2500;
  const debt = Math.round(salary * 0.26);
  const emergency = Math.round(salary * 0.16);
  const savings = Math.round(salary * 0.12);
  const totalMandatory = debt + emergency + savings;

  notifications.push({
    id: 'mandatory-deductions-rule',
    type: 'success',
    title: \`خطة المقتطعات الإلزامية (\${totalMandatory} ريال)\`,
    message: \`اقتطاع شهري مباشر: سداد الديون (\${debt} ريال) + صندوق الطوارئ (\${emergency} ريال) + استثمار طويل المدى (\${savings} ريال). المجموع: \${totalMandatory} ريال (54% من الراتب).\`,
    icon: ShieldCheck
  });`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/SmartNotifications.tsx', code);
