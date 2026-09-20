import { useState } from 'react';
import { Gift, Sparkles, Check, Zap } from 'lucide-react';
import { ITEMS, RARITY_META, levelProgress, describeEffect, type Item } from '../../lib/progression';
import { openChest, equipItem, type PlayerRank, type ChestResult } from '../../lib/ranking';

type Props = {
  rank: PlayerRank | null;
  onRefresh: () => void;
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const RINGS = ITEMS.filter((i) => i.kind === 'ring');
const BOOSTS = ITEMS.filter((i) => i.kind === 'boost');

export default function TacticsProfile({ rank, onRefresh }: Props) {
  const xp = rank?.xp ?? 0;
  const chests = rank?.chests ?? 0;
  const unlocked = rank?.unlocked ?? [];
  const equippedRing = rank?.equipped ?? null;
  const equippedBoost = rank?.equippedBoost ?? null;
  const prog = levelProgress(xp);

  const [phase, setPhase] = useState<'idle' | 'opening' | 'result'>('idle');
  const [result, setResult] = useState<ChestResult | null>(null);
  const [panel, setPanel] = useState<null | 'rings' | 'boosts'>(null);
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

  async function handleEquip(item: Item | null, kind: 'ring' | 'boost') {
    setErr('');
    try {
      await equipItem(item?.id ?? null, kind);
      onRefresh();
    } catch {
      setErr('تعذّر حفظ الاختيار، جرّب كمان مرة.');
    }
  }

  const resultMeta = result ? RARITY_META[result.item.rarity] : null;

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

      {phase === 'result' && result && resultMeta && (
        <div className={`animate-scale-in rounded-xl border ${resultMeta.border} p-4 flex flex-col items-center gap-2`}>
          <Sparkles className={`w-5 h-5 ${resultMeta.text}`} />
          {result.item.kind === 'ring' ? (
            <div className="w-12 h-12 rounded-full bg-cyan-500" style={{ boxShadow: `inset 0 0 0 4px ${result.item.color}` }} />
          ) : (
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${result.item.color}22`, boxShadow: `inset 0 0 0 2px ${result.item.color}` }}
            >
              <Zap className="w-6 h-6" style={{ color: result.item.color }} />
            </div>
          )}
          <div className="font-display font-bold text-sm">{result.item.name}</div>
          <div className={`text-xs font-semibold ${resultMeta.text}`}>
            {resultMeta.label} • {result.item.kind === 'ring' ? 'إطار' : 'بطاقة تعزيز'}
          </div>
          {result.item.effect && <div className="text-xs text-gray-300 text-center">{describeEffect(result.item.effect)}</div>}
          {result.duplicate ? (
            <div className="text-xs text-gray-400">مكرّر — حصلت على +{result.xpBonus} XP بدالها</div>
          ) : (
            <button
              onClick={() => {
                handleEquip(result.item, result.item.kind);
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

      {/* Collections */}
      <div className="flex items-center gap-4 text-xs">
        <button onClick={() => setPanel(panel === 'boosts' ? null : 'boosts')} className={`underline ${panel === 'boosts' ? 'text-emerald-300' : 'text-gray-400'}`}>
          بطاقاتي ({BOOSTS.filter((b) => unlocked.includes(b.id)).length}/{BOOSTS.length})
        </button>
        <button onClick={() => setPanel(panel === 'rings' ? null : 'rings')} className={`underline ${panel === 'rings' ? 'text-emerald-300' : 'text-gray-400'}`}>
          إطاراتي ({RINGS.filter((r) => unlocked.includes(r.id)).length}/{RINGS.length})
        </button>
      </div>

      {panel === 'boosts' && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] text-gray-500">بطاقة وحدة بتلعب فيها بالمباراة (التدريبية والأونلاين). الخصم بيشوفها.</p>
          <button
            onClick={() => handleEquip(null, 'boost')}
            className={`rounded-lg border px-3 py-2 text-xs text-right ${equippedBoost === null ? 'border-emerald-400/60' : 'border-slate-700/50'}`}
          >
            بدون بطاقة
          </button>
          {BOOSTS.map((item) => {
            const owned = unlocked.includes(item.id);
            const meta = RARITY_META[item.rarity];
            return (
              <button
                key={item.id}
                disabled={!owned}
                onClick={() => handleEquip(item, 'boost')}
                className={`relative rounded-lg border px-3 py-2 text-right flex items-center gap-3 ${
                  equippedBoost === item.id ? 'border-emerald-400/60' : meta.border
                } ${owned ? '' : 'opacity-30'}`}
              >
                <Zap className="w-4 h-4 shrink-0" style={{ color: owned ? item.color : undefined }} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold flex items-center gap-2">
                    {owned ? item.name : '؟؟؟'}
                    <span className={`text-[10px] ${meta.text}`}>{meta.label}</span>
                  </div>
                  {owned && item.effect && <div className="text-[11px] text-gray-400">{describeEffect(item.effect)}</div>}
                </div>
                {equippedBoost === item.id && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}

      {panel === 'rings' && (
        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={() => handleEquip(null, 'ring')}
            className={`rounded-lg border p-2 flex flex-col items-center gap-1 text-[10px] ${
              equippedRing === null ? 'border-emerald-400/60' : 'border-slate-700/50'
            }`}
          >
            <div className="w-7 h-7 rounded-full bg-cyan-500" />
            بدون
          </button>
          {RINGS.map((item) => {
            const owned = unlocked.includes(item.id);
            return (
              <button
                key={item.id}
                disabled={!owned}
                onClick={() => handleEquip(item, 'ring')}
                className={`relative rounded-lg border p-2 flex flex-col items-center gap-1 text-[10px] ${
                  equippedRing === item.id ? 'border-emerald-400/60' : RARITY_META[item.rarity].border
                } ${owned ? '' : 'opacity-30'}`}
              >
                <div
                  className="w-7 h-7 rounded-full bg-cyan-500"
                  style={owned ? { boxShadow: `inset 0 0 0 3px ${item.color}` } : undefined}
                />
                <span className="truncate max-w-full">{owned ? item.name : '؟'}</span>
                {equippedRing === item.id && <Check className="absolute top-1 left-1 w-3 h-3 text-emerald-400" />}
              </button>
            );
          })}
        </div>
      )}

      {err && <p className="text-red-400 text-xs text-center">{err}</p>}
    </div>
  );
}
