import { useEffect, useState } from 'react';
import { Trophy, Medal, Crown, TrendingUp } from 'lucide-react';
import { firebaseEnabled } from '@/lib/firebase';
import { getTopPlayers, type PlayerRank } from '@/lib/ranking';

const badgeStyles: Record<number, { icon: typeof Crown; color: string }> = {
  1: { icon: Crown, color: 'text-yellow-400' },
  2: { icon: Medal, color: 'text-gray-300' },
  3: { icon: Medal, color: 'text-orange-400' },
};

export default function Leaderboard() {
  const [players, setPlayers] = useState<PlayerRank[]>([]);
  const [loading, setLoading] = useState(firebaseEnabled);

  useEffect(() => {
    if (!firebaseEnabled) return;
    let cancelled = false;
    getTopPlayers(10)
      .then((list) => {
        if (!cancelled) setPlayers(list);
      })
      .catch(() => {
        if (!cancelled) setPlayers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const podium = players.length >= 3 ? [1, 0, 2] : [];

  return (
    <section id="leaderboard" className="relative py-24">
      <div className="absolute top-1/2 right-0 w-96 h-96 bg-pink-500/5 blur-[100px]" />

      <div className="relative max-w-4xl mx-auto px-6">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass mb-4">
            <Trophy className="w-4 h-4 text-pink-400" />
            <span className="text-xs font-medium text-gray-300 tracking-wide">TOP PLAYERS</span>
          </div>
          <h2 className="font-display font-bold text-4xl md:text-5xl mb-4">
            Global <span className="text-pink-400">Leaderboard</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Ranked by ELO from online Football Tactics matches. Win against real opponents to climb the ranks.
          </p>
        </div>

        {/* Podium */}
        {podium.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-8 max-w-2xl mx-auto">
            {podium.map((idx) => {
              const p = players[idx];
              const rank = idx + 1;
              const styles = badgeStyles[rank];
              const Icon = styles.icon;
              const heightClass = idx === 0 ? 'md:translate-y-0' : 'md:translate-y-6';
              return (
                <div
                  key={rank}
                  className={`glass rounded-2xl p-4 md:p-6 text-center border border-slate-700/50 card-hover ${heightClass} ${
                    idx === 0 ? 'order-2 md:scale-110 neon-border-accent' : idx === 1 ? 'order-1' : 'order-3'
                  }`}
                >
                  <Icon className={`w-8 h-8 ${styles.color} mx-auto mb-2`} />
                  <div className="font-display font-bold text-sm text-white truncate">{p.name}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {p.wins}W · {p.draws}D · {p.losses}L
                  </div>
                  <div className={`font-display font-bold text-lg ${styles.color} mt-2`}>{p.elo}</div>
                  <div className="text-xs text-gray-600 mt-1">#{rank}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Table */}
        <div className="glass rounded-2xl border border-slate-700/50 overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-6 py-3 border-b border-slate-700/50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <div className="col-span-1">Rank</div>
            <div className="col-span-5">Player</div>
            <div className="col-span-3">Record</div>
            <div className="col-span-3 text-right">ELO</div>
          </div>

          {loading && <div className="px-6 py-8 text-center text-sm text-gray-500">Loading rankings…</div>}

          {!loading && players.length === 0 && (
            <div className="px-6 py-8 text-center text-sm text-gray-500">
              {firebaseEnabled
                ? 'No ranked matches yet — be the first to play online and take the top spot.'
                : 'Online rankings are unavailable right now.'}
            </div>
          )}

          {players.map((p, i) => {
            const rank = i + 1;
            return (
              <div
                key={`${p.name}-${rank}`}
                className={`grid grid-cols-12 gap-2 px-6 py-3.5 items-center transition-colors hover:bg-slate-800/30 ${
                  i !== players.length - 1 ? 'border-b border-slate-800/50' : ''
                }`}
              >
                <div className="col-span-1">
                  <span className={`font-display font-bold ${badgeStyles[rank] ? badgeStyles[rank].color : 'text-gray-500'}`}>
                    #{rank}
                  </span>
                </div>
                <div className="col-span-5 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-xs font-bold text-gray-300">
                    {p.name[0]}
                  </div>
                  <span className="text-sm text-white font-medium truncate">{p.name}</span>
                </div>
                <div className="col-span-3 text-sm text-gray-400">
                  {p.wins}W · {p.draws}D · {p.losses}L
                </div>
                <div className="col-span-3 text-right">
                  <span className="font-display font-bold text-sm text-cyan-400">{p.elo}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-2 mt-6 text-sm text-gray-500">
          <TrendingUp className="w-4 h-4" />
          <span>Rankings update after every online match</span>
        </div>
      </div>
    </section>
  );
}
