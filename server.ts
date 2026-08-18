/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini lazily
function getGeminiAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "missing-key" || apiKey.includes("MY_GEMINI_API_KEY") || apiKey === "undefined" || apiKey.trim() === "") {
    return null;
  }
  return new GoogleGenAI({
    apiKey: apiKey.trim(),
  });
}

// API routes
app.post("/api/ai/analyze-expenses", async (req, res) => {
  const ai = getGeminiAI();
  if (!ai) {
    return res.status(200).json({ isFallback: true, message: "Gemini API key not configured, using local analysis" });
  }

  try {
    const {
      salary,
      debtAllocation,
      emergencyAllocation,
      savingsAllocation,
      operationalAllocation,
      totalSpent,
      remainingOperational,
      daysElapsed,
      daysRemaining,
      dailyAllowance,
      categoryTotals,
      extraIncomeTotal,
      unusualExpenses,
      debtsSummary,
      emergencyBalance,
      savingsBalance,
      historicalComparison
    } = req.body;

    const prompt = `
أنت "محلل مالي ذكي" (Financial AI Analyst) مدعوم بـ Gemini. مهمتك هي قراءة بيانات الإنفاق وتقديم تحليل عميق واحترافي يساعد المستخدم على فهم سلوكه المالي.

ملاحظة حاسمة: التطبيق حاسبٌ للأرقام والعمليات الحسابية مسبقاً بدقة عالية، ووظيفتك هي التفسير والتحليل والتعليق بأسلوب "مستشار مالي صديق" دون إعادة الحسابات.

القاعدة الذهبية للراتب الثابت (${salary} ريال):
- 💳 مخصص الديون (26%): ${debtAllocation} ريال
- 🚨 مخصص الطوارئ (16%): ${emergencyAllocation} ريال
- 💰 مخصص الادخار والاستثمار (12%): ${savingsAllocation} ريال
- 🏠 مخصص المصاريف المعيشية والأساسية (46%): ${operationalAllocation} ريال

النتائج المحسوبة بدقة من التطبيق لمخصص المعيشة هذا الشهر:
- إجمالي المصروفات المعيشية المسجلة حتى الآن: ${totalSpent} ريال
- المتبقي الصافي من مخصص المعيشة (46%): ${remainingOperational} ريال
- الأيام المنقضية من الشهر: ${daysElapsed} يوم | الأيام المتبقية: ${daysRemaining} يوم
- المتاح اليومي الآمن للمعيشة حتى الراتب القادم: ${dailyAllowance} ريال/يوم
- توزيع الإنفاق حسب الفئات: ${JSON.stringify(categoryTotals || {})}
- المصروفات الكبيرة أو غير المعتادة المرصودة: ${JSON.stringify(unusualExpenses || [])}
- الدخل الإضافي (خارج الراتب): ${extraIncomeTotal || 0} ريال
- ملخص الديون: ${JSON.stringify(debtsSummary || {})}
- أرصدة الصناديق: طوارئ (${emergencyBalance} ريال)، ادخار (${savingsBalance} ريال)
- مقارنة بالسلوك السابق: ${historicalComparison || "لا توجد بيانات كافية"}

قواعد التقرير:
1. التزم بالأرقام المحسوبة أعلاه حرفياً.
2. استخدم لغة عربية احترافية، واضحة، ومشجعة.
3. ركز على تحليل الـ 46% (مخصص المعيشة) وكيفية الحفاظ عليه حتى نهاية الشهر.
4. استخدم هذا التنسيق بالضبط:
   - status: اختر "🟢 جيد" أو "🟡 انتبه" أو "🔴 خطر"
   - statusText: وصف مختصر جداً (مثلاً: "إنفاق متوازن"، "وتيرة مرتفعة قليلاً"، "استنزاف مبكر للميزانية")
   - spendingSummary: ملخص يشرح الأرقام بأسلوب سردي (مثلاً: "لقد استهلكت ${totalSpent} من مخصصك المعيشي، ويتبقى لك ${remainingOperational} ريال. لضمان الاستدامة، يجب ألا يتجاوز صرفك اليومي ${dailyAllowance} ريال.")
   - topObservation: ملاحظة ذكية تعكس مجموع إنفاق أعلى فئة بدقة بناءً على مصفوفة الفئات أعلاه (مثلاً: اذكر الفئة الأعلى إنفاقاً ومجموع مبالغها المحسوب في مصفوفة الفئات بدقة، مع رصد أي مصروف غير معتاد إن وجد).
   - suggestions: من 1 إلى 2 نصيحة سلوكية عملية فقط.
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: { type: Type.STRING },
            statusText: { type: Type.STRING },
            spendingSummary: { type: Type.STRING },
            topObservation: { type: Type.STRING },
            suggestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["status", "statusText", "spendingSummary", "topObservation", "suggestions"]
        }
      }
    });

    const resultText = response.text || "{}";
    const data = JSON.parse(resultText);
    res.json(data);
  } catch (error: any) {
    res.json({ isFallback: true });
  }
});

// Vite middleware
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

setupVite().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
