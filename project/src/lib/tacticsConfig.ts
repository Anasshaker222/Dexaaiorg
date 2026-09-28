// إعدادات الموازنة في مكان واحد (مبدأ "قابلية الضبط بدل التثبيت بالكود")
export type Weather = 'dry' | 'damp' | 'wet';

export const TUNING = {
  weatherOdds: { dry: 0.6, damp: 0.25 }, // الباقي (15%) = ملعب مبلول
  weatherPass: { dry: 0, damp: 0.06, wet: 0.12 }, // خصم من نسبة نجاح التمريرة
  gkSweepDist: 14, // إذا الحارس أقرب من هالمسافة لحامل الكرة بيخرج ويضيّق الزاوية
  gkSweepPenalty: 0.07,
  crowdGain: { goal: 35, miss: 12, intercept: 8, tackleWin: 5, tackleFail: 1, pass: 1 },
  crowdDecay: 3, // نزول حماس الجمهور مع كل تبديل دور
} as const;
