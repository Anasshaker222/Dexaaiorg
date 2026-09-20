import { useState, useEffect, useRef, useCallback } from 'react';
import { RotateCcw, Trophy, Disc } from 'lucide-react';

const CANVAS_W = 400;
const CANVAS_H = 300;
const PADDLE_W = 10;
const PADDLE_H = 70;
const BALL_R = 8;

export default function PongGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState({ player: 0, ai: 0 });
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'over'>('idle');
  const [bestDiff, setBestDiff] = useState(0);

  const playerYRef = useRef(CANVAS_H / 2 - PADDLE_H / 2);
  const aiYRef = useRef(CANVAS_H / 2 - PADDLE_H / 2);
  const ballRef = useRef({ x: CANVAS_W / 2, y: CANVAS_H / 2, vx: 4, vy: 2 });
  const animRef = useRef<number>(0);
  const scoreRef = useRef({ player: 0, ai: 0 });
  const keysRef = useRef<Record<string, boolean>>({});
  const winningScore = 7;

  useEffect(() => {
    const stored = localStorage.getItem('pong-best');
    if (stored) setBestDiff(parseInt(stored));
  }, []);

  const resetBall = useCallback((dir: number) => {
    ballRef.current = {
      x: CANVAS_W / 2,
      y: CANVAS_H / 2,
      vx: dir * (3 + Math.random() * 2),
      vy: (Math.random() - 0.5) * 4,
    };
  }, []);

  const startGame = useCallback(() => {
    scoreRef.current = { player: 0, ai: 0 };
    setScore({ player: 0, ai: 0 });
    playerYRef.current = CANVAS_H / 2 - PADDLE_H / 2;
    aiYRef.current = CANVAS_H / 2 - PADDLE_H / 2;
    resetBall(Math.random() < 0.5 ? 1 : -1);
    setGameState('playing');
  }, [resetBall]);

  // Keyboard
  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => {
      keysRef.current[e.key] = true;
      if (['ArrowUp', 'ArrowDown', 'w', 's'].includes(e.key)) e.preventDefault();
    };
    const handleUp = (e: KeyboardEvent) => { keysRef.current[e.key] = false; };
    window.addEventListener('keydown', handleDown);
    window.addEventListener('keyup', handleUp);
    return () => {
      window.removeEventListener('keydown', handleDown);
      window.removeEventListener('keyup', handleUp);
    };
  }, []);

  // Mouse / touch
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gameState !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const y = ((e.clientY - rect.top) / rect.height) * CANVAS_H;
    playerYRef.current = Math.max(0, Math.min(CANVAS_H - PADDLE_H, y - PADDLE_H / 2));
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (gameState !== 'playing') return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const y = ((e.touches[0].clientY - rect.top) / rect.height) * CANVAS_H;
    playerYRef.current = Math.max(0, Math.min(CANVAS_H - PADDLE_H, y - PADDLE_H / 2));
  };

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = () => {
      // Player movement (keyboard)
      if (keysRef.current['ArrowUp'] || keysRef.current['w']) {
        playerYRef.current = Math.max(0, playerYRef.current - 5);
      }
      if (keysRef.current['ArrowDown'] || keysRef.current['s']) {
        playerYRef.current = Math.min(CANVAS_H - PADDLE_H, playerYRef.current + 5);
      }

      // AI movement — tracks ball with slight delay
      const aiCenter = aiYRef.current + PADDLE_H / 2;
      const ball = ballRef.current;
      const aiSpeed = 3.5;
      if (ball.x > CANVAS_W / 2) {
        // Ball coming toward AI — track it
        const targetY = ball.y;
        if (aiCenter < targetY - 5) aiYRef.current += aiSpeed;
        else if (aiCenter > targetY + 5) aiYRef.current -= aiSpeed;
      } else {
        // Ball going away — drift to center
        const center = CANVAS_H / 2;
        if (Math.abs(aiCenter - center) > 10) {
          aiYRef.current += aiCenter < center ? aiSpeed * 0.5 : -aiSpeed * 0.5;
        }
      }
      aiYRef.current = Math.max(0, Math.min(CANVAS_H - PADDLE_H, aiYRef.current));

      // Move ball
      ball.x += ball.vx;
      ball.y += ball.vy;

      // Top/bottom walls
      if (ball.y < BALL_R) { ball.y = BALL_R; ball.vy = -ball.vy; }
      if (ball.y > CANVAS_H - BALL_R) { ball.y = CANVAS_H - BALL_R; ball.vy = -ball.vy; }

      // Player paddle (left)
      if (ball.x - BALL_R < 20 + PADDLE_W && ball.x - BALL_R > 16 &&
          ball.y > playerYRef.current && ball.y < playerYRef.current + PADDLE_H && ball.vx < 0) {
        ball.vx = -ball.vx * 1.05;
        const hitPos = (ball.y - (playerYRef.current + PADDLE_H / 2)) / (PADDLE_H / 2);
        ball.vy = hitPos * 5;
        ball.x = 20 + PADDLE_W + BALL_R;
      }

      // AI paddle (right)
      if (ball.x + BALL_R > CANVAS_W - 20 - PADDLE_W && ball.x + BALL_R < CANVAS_W - 16 &&
          ball.y > aiYRef.current && ball.y < aiYRef.current + PADDLE_H && ball.vx > 0) {
        ball.vx = -ball.vx * 1.05;
        const hitPos = (ball.y - (aiYRef.current + PADDLE_H / 2)) / (PADDLE_H / 2);
        ball.vy = hitPos * 5;
        ball.x = CANVAS_W - 20 - PADDLE_W - BALL_R;
      }

      // Cap speed
      const maxSpeed = 9;
      if (Math.abs(ball.vx) > maxSpeed) ball.vx = Math.sign(ball.vx) * maxSpeed;

      // Score
      if (ball.x < 0) {
        scoreRef.current.ai++;
        setScore({ ...scoreRef.current });
        if (scoreRef.current.ai >= winningScore) {
          setGameState('over');
          const diff = scoreRef.current.player - scoreRef.current.ai;
          if (diff > bestDiff) { setBestDiff(diff); localStorage.setItem('pong-best', diff.toString()); }
          return;
        }
        resetBall(1);
      }
      if (ball.x > CANVAS_W) {
        scoreRef.current.player++;
        setScore({ ...scoreRef.current });
        if (scoreRef.current.player >= winningScore) {
          setGameState('over');
          const diff = scoreRef.current.player - scoreRef.current.ai;
          if (diff > bestDiff) { setBestDiff(diff); localStorage.setItem('pong-best', diff.toString()); }
          return;
        }
        resetBall(-1);
      }

      // Draw
      ctx.fillStyle = '#0a0a12';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Center line
      ctx.strokeStyle = 'rgba(0,240,255,0.15)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 12]);
      ctx.beginPath();
      ctx.moveTo(CANVAS_W / 2, 0);
      ctx.lineTo(CANVAS_W / 2, CANVAS_H);
      ctx.stroke();
      ctx.setLineDash([]);

      // Player paddle
      ctx.fillStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.roundRect(20, playerYRef.current, PADDLE_W, PADDLE_H, 5);
      ctx.fill();

      // AI paddle
      ctx.fillStyle = '#ff2e93';
      ctx.shadowColor = '#ff2e93';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.roundRect(CANVAS_W - 20 - PADDLE_W, aiYRef.current, PADDLE_W, PADDLE_H, 5);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Ball
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [gameState, bestDiff, resetBall]);

  const won = gameState === 'over' && score.player > score.ai;

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-8 mb-5">
        <div className="text-center">
          <div className="text-sm text-gray-400">You</div>
          <div className="font-display font-bold text-2xl text-cyan-400">{score.player}</div>
        </div>
        <div className="text-gray-600 font-display text-xl">vs</div>
        <div className="text-center">
          <div className="text-sm text-gray-400">AI</div>
          <div className="font-display font-bold text-2xl text-pink-400">{score.ai}</div>
        </div>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onMouseMove={handleMouseMove}
          onTouchMove={handleTouchMove}
          className="rounded-2xl border border-slate-700/50 touch-none"
          style={{ maxWidth: '100%', maxHeight: '300px' }}
        />

        {gameState === 'idle' && (
          <div className="absolute inset-0 rounded-2xl bg-black/70 flex flex-col items-center justify-center">
            <Disc className="w-12 h-12 text-cyan-400 mb-3" />
            <div className="font-display font-bold text-xl text-white mb-2">Pong vs AI</div>
            <div className="text-sm text-gray-400 mb-4 text-center max-w-xs px-4">
              Classic Pong against an AI opponent. First to {winningScore} wins. Mouse, touch, or arrow keys to move your paddle.
            </div>
            <button onClick={startGame} className="btn-primary px-8 py-3 rounded-lg text-sm font-semibold">
              Start Match
            </button>
          </div>
        )}

        {gameState === 'over' && (
          <div className="absolute inset-0 rounded-2xl bg-black/80 flex flex-col items-center justify-center animate-fade-in">
            <Trophy className={`w-10 h-10 mb-2 ${won ? 'text-green-400' : 'text-pink-400'}`} />
            <div className="font-display font-bold text-xl text-white mb-1">
              {won ? 'You Win!' : 'AI Wins!'}
            </div>
            <div className="font-display font-bold text-2xl text-cyan-400 mb-4">
              {score.player} — {score.ai}
            </div>
            <button onClick={startGame} className="btn-primary px-8 py-3 rounded-lg text-sm font-semibold flex items-center gap-2">
              <RotateCcw className="w-4 h-4" />
              Rematch
            </button>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500 mt-4 text-center max-w-xs">
        Move your paddle up and down to hit the ball past the AI. First to {winningScore} points wins!
      </p>
    </div>
  );
}
