import { useState } from 'react';
import { Gift, Sparkles, Check } from 'lucide-react';
import { ITEMS, RARITY_META, levelProgress } from '../../lib/progression';
import { openChest, equipItem, type PlayerRank, type ChestResult } from '../../lib/ranking';

type Props = {
  rank: PlayerRank | null;
  onRefresh: () => void;
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export default function TacticsProfile({ rank, onRefresh }: Props) {
  const xp = rank?.xp ?? 0;
  const chests = rank?.chests ?? 0;
  const unlocked = rank?.unlocked ?? [];
  const equipped = rank?.equipped ?? null;
  const prog = levelProgress(xp);

  const [phase, setPhase] = useState<'idle' | 'opening' | 'result'>('idle');
  const [result, setResult] = useState<ChestResult | null>(null);
  const [showKits, setShowKits] = useState(false);
  const [err, setErr] = useState('');

  async function handleOpen() {
    if (phase !== 'idle' || chests <= 0) return;
    setErr('');
    setPhase('opening');
    try {
      const [res] = await Promise.all([openChest(), sleep(1100)]);
      if (!res) {
        setPhase('idle');
        setErr('تعذّر فتح الصندوق، جرّب كمان مرة.');
        return;
      }
      setResult(res);
      setPhase('result');
      onRefresh();
    } catch {
      setPhase('idle');
      setErr('تعذّر فتح الصندوق، جرّب كمان مرة.');
    }
  }

  async function handleEquip(id: string | null) {
    setErr('');
    try {
      await equipItem(id);
      onRefresh();
    } catch {
      setErr('تعذّر حفظ الاختيار، جرّب كمان مرة.');
    }
  }

  return (
    <div className="glass rounded-xl border border-slate-700/50 p-4 flex flex-col gap-3">
      {/* Level */}
      <div>
        <div className="flex items-center justify-between text-sm mb-1.5">
          <span className="font-display font-bold text-emerald-400">المستوى {prog.level}</span>
          <span className="text-xs text-gray-400">
            {prog.current} / {prog.needed} XP
          </span>
        </div>
        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-l from-emerald-400 to-cyan-400 transition-all duration-500"
            style={{ width: `${Math.round(prog.pct * 100)}%` }}
          />
        </div>
      </div>

      {/* Chests */}
      {phase === 'idle' && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm">
            <Gift className={`w-5 h-5 ${chests > 0 ? 'text-purple-400' : 'text-gray-600'}`} />
            <span className="text-gray-300">صناديقك: {chests}</span>
          </div>
          <button
            onClick={handleOpen}
            disabled={chests <= 0}
            className="glass rounded-lg px-3 py-1.5 text-xs font-semibold border border-purple-400/40 text-purple-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            افتح صندوق
          </button>
        </div>
      )}

      {phase === 'opening' && (
        <div className="flex flex-col items-center gap-2 py-3">
          <Gift className="w-12 h-12 text-purple-400 animate-bounce" />
          <span className="text-xs text-gray-400">جاري فتح الصندوق...</span>
        </div>
      )}

      {phase === 'result' && result && (
        <div className={`animate-scale-in rounded-xl border ${RARITY_META[result.item.rarity].border} p-4 flex flex-col items-center gap-2`}>
          <Sparkles className={`w-5 h-5 ${RARITY_META[result.item.rarity].text}`} />
          <div
            className="w-12 h-12 rounded-full bg-cyan-500"
            style={{ boxShadow: `inset 0 0 0 4px ${result.item.color}` }}
          />
          <div className="font-display font-bold text-sm">{result.item.name}</div>
          <div className={`text-xs font-semibold ${RARITY_META[result.item.rarity].text}`}>
            {RARITY_META[result.item.rarity].label}
          </div>
          {result.duplicate ? (
            <div className="text-xs text-gray-400">مكرّر — حصلت على +{result.xpBonus} XP بدالها</div>
          ) : (
            <button
              onClick={() => {
                handleEquip(result.item.id);
                setPhase('idle');
              }}
              className="glass rounded-lg px-3 py-1.5 text-xs font-semibold border border-emerald-400/40 text-emerald-300"
            >
              جهّزها الآن
            </button>
          )}
          <button onClick={() => setPhase('idle')} className="text-xs text-gray-500 underline">
            تمام
          </button>
        </div>
      )}

      {/* Kits */}
      <button onClick={() => setShowKits((v) => !v)} className="text-xs text-gray-400 underline text-right">
        إطاراتي ({unlocked.length}/{ITEMS.length})
      </button>

      {showKits && (
        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={() => handleEquip(null)}
            className={`rounded-lg border p-2 flex flex-col items-center gap-1 text-[10px] ${
              equipped === null ? 'border-emerald-400/60' : 'border-slate-700/50'
            }`}
          >
            <div className="w-7 h-7 rounded-full bg-cyan-500" />
            بدون
          </button>
          {ITEMS.map((item) => {
            const owned = unlocked.includes(item.id);
            return (
              <button
                key={item.id}
                disabled={!owned}
                onClick={() => handleEquip(item.id)}
                className={`relative rounded-lg border p-2 flex flex-col items-center gap-1 text-[10px] ${
                  equipped === item.id ? 'border-emerald-400/60' : RARITY_META[item.rarity].border
                } ${owned ? '' : 'opacity-30'}`}
              >
                <div
                  className="w-7 h-7 rounded-full bg-cyan-500"
                  style={owned ? { boxShadow: `inset 0 0 0 3px ${item.color}` } : undefined}
                />
                <span className="truncate max-w-full">{owned ? item.name : '؟'}</span>
                {equipped === item.id && <Check className="absolute top-1 left-1 w-3 h-3 text-emerald-400" />}
              </button>
            );
          })}
        </div>
      )}

      {err && <p className="text-red-400 text-xs text-center">{err}</p>}
    </div>
  );
}
