import { useState, useEffect, useRef, useCallback } from 'react';
import { RotateCcw, Trophy, Goal } from 'lucide-react';

const CANVAS_W = 400;
const CANVAS_H = 400;
const GOAL_W = 320;
const GOAL_H = 120;
const GOAL_X = (CANVAS_W - GOAL_W) / 2;
const GOAL_Y = 30;

type GameState = 'aiming' | 'shooting' | 'result' | 'goalieDive';
type AimResult = { x: number; y: number; goal: boolean; saved: boolean; text: string };

export default function FootballGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [shots, setShots] = useState(0);
  const [maxShots] = useState(5);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'over'>('idle');
  const [bestScore, setBestScore] = useState(0);
  const [message, setMessage] = useState('');

  const aimRef = useRef<{ x: number; y: number } | null>(null);
  const ballRef = useRef<{ x: number; y: number; vx: number; vy: number }>({ x: CANVAS_W / 2, y: CANVAS_H - 60, vx: 0, vy: 0 });
  const animRef = useRef<number>(0);
  const phaseRef = useRef<'aiming' | 'shooting' | 'done'>('aiming');
  const goalieXRef = useRef(GOAL_X + GOAL_W / 2);
  const goalieDiveRef = useRef<number>(0); // -1 left, 0 center, 1 right
  const scoreRef = useRef(0);
  const shotsRef = useRef(0);
  const resultRef = useRef<AimResult | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('football-best');
    if (stored) setBestScore(parseInt(stored));
  }, []);

  const startGame = useCallback(() => {
    setScore(0);
    setShots(0);
    setGameState('playing');
    scoreRef.current = 0;
    shotsRef.current = 0;
    phaseRef.current = 'aiming';
    aimRef.current = null;
    ballRef.current = { x: CANVAS_W / 2, y: CANVAS_H - 60, vx: 0, vy: 0 };
    goalieXRef.current = GOAL_X + GOAL_W / 2;
    goalieDiveRef.current = 0;
    setMessage('Click in the goal to aim your shot!');
  }, []);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gameState !== 'playing' || phaseRef.current !== 'aiming') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
    const y = ((e.clientY - rect.top) / rect.height) * CANVAS_H;

    // Must click in goal area
    if (y > GOAL_Y + GOAL_H + 20) return;

    aimRef.current = { x, y };

    // Calculate shot
    const ball = ballRef.current;
    const dx = x - ball.x;
    const dy = y - ball.y;
    const dist = Math.hypot(dx, dy);
    const speed = 8;
    ball.vx = (dx / dist) * speed;
    ball.vy = (dy / dist) * speed;

    // Goalkeeper AI — guesses a direction based on shot placement
    const shotSide = x < GOAL_X + GOAL_W * 0.4 ? -1 : x > GOAL_X + GOAL_W * 0.6 ? 1 : 0;
    // 60% chance goalie guesses correctly
    const goalieGuess = Math.random() < 0.55 ? shotSide : Math.floor(Math.random() * 3) - 1;
    goalieDiveRef.current = goalieGuess;

    phaseRef.current = 'shooting';
  };

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = () => {
      const ball = ballRef.current;

      // Move ball when shooting
      if (phaseRef.current === 'shooting') {
        ball.x += ball.vx;
        ball.y += ball.vy;

        // Move goalie toward dive target
        const diveTarget = GOAL_X + GOAL_W / 2 + goalieDiveRef.current * GOAL_W * 0.35;
        goalieXRef.current += (diveTarget - goalieXRef.current) * 0.15;

        // Check if ball reached goal line
        if (ball.y <= GOAL_Y + GOAL_H && ball.y >= GOAL_Y) {
          const goalieX = goalieXRef.current;
          const goalieReach = 50;
          const dx = Math.abs(ball.x - goalieX);
          // Check if saved
          if (dx < goalieReach && Math.abs(ball.y - (GOAL_Y + GOAL_H / 2)) < 50) {
            // Saved!
            resultRef.current = { x: ball.x, y: ball.y, goal: false, saved: true, text: 'SAVED!' };
            phaseRef.current = 'done';
            shotsRef.current++;
            setShots(shotsRef.current);
            setMessage('Saved! The AI keeper guessed right.');
          } else if (ball.x >= GOAL_X && ball.x <= GOAL_X + GOAL_W) {
            // Goal!
            resultRef.current = { x: ball.x, y: ball.y, goal: true, saved: false, text: 'GOAL!' };
            phaseRef.current = 'done';
            scoreRef.current++;
            shotsRef.current++;
            setScore(scoreRef.current);
            setShots(shotsRef.current);
            setMessage('GOAL! Great shot!');
          }
        }

        // Ball went off canvas or over goal
        if (ball.y < -20 || ball.x < -20 || ball.x > CANVAS_W + 20) {
          if (phaseRef.current === 'shooting') {
            resultRef.current = { x: ball.x, y: ball.y, goal: false, saved: false, text: 'MISS!' };
            phaseRef.current = 'done';
            shotsRef.current++;
            setShots(shotsRef.current);
            setMessage('Missed the target!');
          }
        }
      }

      // Check end of game
      if (phaseRef.current === 'done' && shotsRef.current >= maxShots) {
        setTimeout(() => {
          setGameState('over');
          if (scoreRef.current > bestScore) {
            setBestScore(scoreRef.current);
            localStorage.setItem('football-best', scoreRef.current.toString());
          }
        }, 1500);
      }

      // Reset for next shot
      if (phaseRef.current === 'done' && shotsRef.current < maxShots) {
        setTimeout(() => {
          if (phaseRef.current === 'done') {
            phaseRef.current = 'aiming';
            aimRef.current = null;
            resultRef.current = null;
            ballRef.current = { x: CANVAS_W / 2, y: CANVAS_H - 60, vx: 0, vy: 0 };
            goalieDiveRef.current = 0;
            setMessage(`Shot ${shotsRef.current + 1}/${maxShots} — Click to aim!`);
          }
        }, 1200);
      }

      // === DRAW ===
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      // Sky / background gradient
      const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      grad.addColorStop(0, '#0d1f3d');
      grad.addColorStop(0.5, '#0a1a2e');
      grad.addColorStop(1, '#0d2f1d');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Grass field
      ctx.fillStyle = '#0d3a1d';
      ctx.fillRect(0, CANVAS_H * 0.5, CANVAS_W, CANVAS_H * 0.5);
      // Grass stripes
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
        ctx.fillRect(0, CANVAS_H * 0.5 + i * (CANVAS_H * 0.5 / 8), CANVAS_W, CANVAS_H * 0.5 / 8);
      }

      // Goal frame
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.shadowColor = 'rgba(255,255,255,0.3)';
      ctx.shadowBlur = 10;
      // Goal posts
      ctx.beginPath();
      ctx.moveTo(GOAL_X, GOAL_Y + GOAL_H);
      ctx.lineTo(GOAL_X, GOAL_Y);
      ctx.lineTo(GOAL_X + GOAL_W, GOAL_Y);
      ctx.lineTo(GOAL_X + GOAL_W, GOAL_Y + GOAL_H);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Net
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      for (let i = 0; i < GOAL_W; i += 20) {
        ctx.beginPath();
        ctx.moveTo(GOAL_X + i, GOAL_Y);
        ctx.lineTo(GOAL_X + i, GOAL_Y + GOAL_H);
        ctx.stroke();
      }
      for (let i = 0; i < GOAL_H; i += 15) {
        ctx.beginPath();
        ctx.moveTo(GOAL_X, GOAL_Y + i);
        ctx.lineTo(GOAL_X + GOAL_W, GOAL_Y + i);
        ctx.stroke();
      }

      // Goalkeeper
      const gx = goalieXRef.current;
      const gy = GOAL_Y + GOAL_H - 10;
      ctx.fillStyle = '#ffaa00';
      ctx.beginPath();
      ctx.roundRect(gx - 12, gy - 30, 24, 30, 4);
      ctx.fill();
      // Head
      ctx.fillStyle = '#ffccaa';
      ctx.beginPath();
      ctx.arc(gx, gy - 35, 8, 0, Math.PI * 2);
      ctx.fill();
      // Arms (diving)
      ctx.strokeStyle = '#ffaa00';
      ctx.lineWidth = 6;
      ctx.beginPath();
      const armAngle = goalieDiveRef.current * 0.8;
      ctx.moveTo(gx, gy - 20);
      ctx.lineTo(gx + Math.cos(armAngle - Math.PI / 2) * 25, gy - 20 + Math.sin(armAngle - Math.PI / 2) * 25);
      ctx.moveTo(gx, gy - 20);
      ctx.lineTo(gx - Math.cos(armAngle - Math.PI / 2) * 25, gy - 20 + Math.sin(armAngle - Math.PI / 2) * 25);
      ctx.stroke();

      // Aim indicator
      if (phaseRef.current === 'aiming' && aimRef.current) {
        ctx.strokeStyle = 'rgba(0,240,255,0.4)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 8]);
        ctx.beginPath();
        ctx.moveTo(ball.x, ball.y);
        ctx.lineTo(aimRef.current.x, aimRef.current.y);
        ctx.stroke();
        ctx.setLineDash([]);
        // Target reticle
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(aimRef.current.x, aimRef.current.y, 12, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Ball
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Ball pattern
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, 4, 0, Math.PI * 2);
      ctx.fill();

      // Result text
      if (resultRef.current && phaseRef.current === 'done') {
        ctx.font = 'bold 32px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        if (resultRef.current.goal) {
          ctx.fillStyle = '#00ff88';
          ctx.shadowColor = '#00ff88';
          ctx.shadowBlur = 20;
          ctx.fillText('GOAL!', CANVAS_W / 2, CANVAS_H / 2);
        } else if (resultRef.current.saved) {
          ctx.fillStyle = '#ff3355';
          ctx.shadowColor = '#ff3355';
          ctx.shadowBlur = 20;
          ctx.fillText('SAVED!', CANVAS_W / 2, CANVAS_H / 2);
        } else {
          ctx.fillStyle = '#ffaa00';
          ctx.shadowColor = '#ffaa00';
          ctx.shadowBlur = 20;
          ctx.fillText('MISS!', CANVAS_W / 2, CANVAS_H / 2);
        }
        ctx.shadowBlur = 0;
      }

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [gameState, bestScore, maxShots]);

  return (
    <div className="flex flex-col items-center">
      {/* HUD */}
      <div className="flex items-center gap-3 mb-5">
        <div className="glass px-4 py-2 rounded-lg text-center">
          <div className="text-sm text-gray-400">Goals</div>
          <div className="font-display font-bold text-lg text-green-400">{score}</div>
        </div>
        <div className="glass px-4 py-2 rounded-lg text-center">
          <div className="text-sm text-gray-400">Shots</div>
          <div className="font-display font-bold text-lg text-cyan-400">{shots}/{maxShots}</div>
        </div>
      </div>

      {/* Message */}
      {gameState === 'playing' && (
        <div className="mb-3 text-sm text-gray-300 h-6 text-center">{message}</div>
      )}

      {/* Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onClick={handleCanvasClick}
          className="rounded-2xl border border-slate-700/50 cursor-crosshair touch-none"
          style={{ maxWidth: '100%', maxHeight: '400px' }}
        />

        {gameState === 'idle' && (
          <div className="absolute inset-0 rounded-2xl bg-black/70 flex flex-col items-center justify-center">
            <Goal className="w-12 h-12 text-green-400 mb-3" />
            <div className="font-display font-bold text-xl text-white mb-2">Penalty Shootout</div>
            <div className="text-sm text-gray-400 mb-4 text-center max-w-xs px-4">
              Take 5 penalty kicks against an AI goalkeeper. Click inside the goal to aim your shot. Score as many as you can!
            </div>
            <button onClick={startGame} className="btn-primary px-8 py-3 rounded-lg text-sm font-semibold flex items-center gap-2">
              <Goal className="w-4 h-4" />
              Start Shootout
            </button>
          </div>
        )}

        {gameState === 'over' && (
          <div className="absolute inset-0 rounded-2xl bg-black/80 flex flex-col items-center justify-center animate-fade-in">
            <Trophy className="w-10 h-10 text-green-400 mb-2" />
            <div className="font-display font-bold text-xl text-white mb-1">Shootout Over!</div>
            <div className="font-display font-bold text-3xl text-green-400 mb-1">{score}/{maxShots}</div>
            <div className="text-sm text-gray-400 mb-4">Best: {bestScore}/{maxShots}</div>
            <button onClick={startGame} className="btn-primary px-8 py-3 rounded-lg text-sm font-semibold flex items-center gap-2">
              <RotateCcw className="w-4 h-4" />
              Play Again
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 mt-5">
        <div className="flex items-center gap-2 glass px-4 py-2 rounded-lg">
          <Trophy className="w-4 h-4 text-pink-400" />
          <span className="text-sm text-gray-400">Best:</span>
          <span className="font-display font-bold text-pink-400">{bestScore}/{maxShots}</span>
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-4 text-center max-w-xs">
        Click inside the goal to aim. The AI keeper guesses a direction — aim for the corners to score!
      </p>
    </div>
  );
}
