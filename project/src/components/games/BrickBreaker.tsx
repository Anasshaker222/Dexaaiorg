import { useState, useEffect, useRef, useCallback } from 'react';
import { RotateCcw, Trophy, Blocks } from 'lucide-react';

const CANVAS_W = 400;
const CANVAS_H = 420;
const PADDLE_W = 80;
const PADDLE_H = 12;
const BALL_R = 8;
const BRICK_ROWS = 5;
const BRICK_COLS = 8;
const BRICK_W = 44;
const BRICK_H = 18;
const BRICK_GAP = 4;
const BRICK_OFFSET_X = (CANVAS_W - (BRICK_COLS * (BRICK_W + BRICK_GAP) - BRICK_GAP)) / 2;
const BRICK_OFFSET_Y = 40;

const BRICK_COLORS = ['#ff3355', '#ff8800', '#ffcc00', '#00ff88', '#00f0ff'];

type Brick = { x: number; y: number; alive: boolean; color: string };

export default function BrickBreaker() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'over' | 'won'>('idle');
  const [bestScore, setBestScore] = useState(0);

  const paddleXRef = useRef(CANVAS_W / 2 - PADDLE_W / 2);
  const ballRef = useRef({ x: CANVAS_W / 2, y: CANVAS_H - 40, vx: 3, vy: -3 });
  const bricksRef = useRef<Brick[]>([]);
  const animRef = useRef<number>(0);
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const mouseControlRef = useRef(false);

  useEffect(() => {
    const stored = localStorage.getItem('brick-best');
    if (stored) setBestScore(parseInt(stored));
  }, []);

  const initBricks = useCallback(() => {
    const bricks: Brick[] = [];
    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        bricks.push({
          x: BRICK_OFFSET_X + c * (BRICK_W + BRICK_GAP),
          y: BRICK_OFFSET_Y + r * (BRICK_H + BRICK_GAP),
          alive: true,
          color: BRICK_COLORS[r % BRICK_COLORS.length],
        });
      }
    }
    bricksRef.current = bricks;
  }, []);

  const startGame = useCallback(() => {
    scoreRef.current = 0;
    livesRef.current = 3;
    setScore(0);
    setLives(3);
    paddleXRef.current = CANVAS_W / 2 - PADDLE_W / 2;
    ballRef.current = { x: CANVAS_W / 2, y: CANVAS_H - 40, vx: 3, vy: -3 };
    initBricks();
    setGameState('playing');
  }, [initBricks]);

  // Mouse control
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gameState !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
    paddleXRef.current = Math.max(0, Math.min(CANVAS_W - PADDLE_W, x - PADDLE_W / 2));
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (gameState !== 'playing') return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.touches[0].clientX - rect.left) / rect.width) * CANVAS_W;
    paddleXRef.current = Math.max(0, Math.min(CANVAS_W - PADDLE_W, x - PADDLE_W / 2));
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

      // Move ball
      ball.x += ball.vx;
      ball.y += ball.vy;

      // Wall collisions
      if (ball.x < BALL_R) { ball.x = BALL_R; ball.vx = -ball.vx; }
      if (ball.x > CANVAS_W - BALL_R) { ball.x = CANVAS_W - BALL_R; ball.vx = -ball.vx; }
      if (ball.y < BALL_R) { ball.y = BALL_R; ball.vy = -ball.vy; }

      // Paddle collision
      const paddleY = CANVAS_H - 24;
      if (ball.y + BALL_R >= paddleY && ball.y + BALL_R <= paddleY + PADDLE_H + 4 &&
          ball.x >= paddleXRef.current && ball.x <= paddleXRef.current + PADDLE_W && ball.vy > 0) {
        ball.vy = -Math.abs(ball.vy);
        const hitPos = (ball.x - paddleXRef.current) / PADDLE_W;
        ball.vx = (hitPos - 0.5) * 6;
      }

      // Bottom — lose life
      if (ball.y > CANVAS_H) {
        livesRef.current--;
        setLives(livesRef.current);
        if (livesRef.current <= 0) {
          setGameState('over');
          if (scoreRef.current > bestScore) {
            setBestScore(scoreRef.current);
            localStorage.setItem('brick-best', scoreRef.current.toString());
          }
          return;
        }
        ballRef.current = { x: CANVAS_W / 2, y: CANVAS_H - 40, vx: 3, vy: -3 };
      }

      // Brick collisions
      let allDead = true;
      bricksRef.current.forEach((b) => {
        if (!b.alive) return;
        allDead = false;
        if (ball.x + BALL_R > b.x && ball.x - BALL_R < b.x + BRICK_W &&
            ball.y + BALL_R > b.y && ball.y - BALL_R < b.y + BRICK_H) {
          b.alive = false;
          scoreRef.current += 10;
          setScore(scoreRef.current);
          // Bounce direction
          const overlapX = Math.min(ball.x + BALL_R - b.x, b.x + BRICK_W - (ball.x - BALL_R));
          const overlapY = Math.min(ball.y + BALL_R - b.y, b.y + BRICK_H - (ball.y - BALL_R));
          if (overlapX < overlapY) {
            ball.vx = -ball.vx;
          } else {
            ball.vy = -ball.vy;
          }
        }
      });

      if (allDead) {
        setGameState('won');
        if (scoreRef.current > bestScore) {
          setBestScore(scoreRef.current);
          localStorage.setItem('brick-best', scoreRef.current.toString());
        }
        return;
      }

      // Draw
      ctx.fillStyle = '#0a0a12';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Bricks
      bricksRef.current.forEach((b) => {
        if (!b.alive) return;
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, BRICK_W, BRICK_H, 3);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Paddle
      ctx.fillStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.roundRect(paddleXRef.current, paddleY, PADDLE_W, PADDLE_H, 6);
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
  }, [gameState, bestScore]);

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-3 mb-5">
        <div className="glass px-4 py-2 rounded-lg text-center">
          <div className="text-sm text-gray-400">Score</div>
          <div className="font-display font-bold text-lg text-cyan-400">{score}</div>
        </div>
        <div className="glass px-4 py-2 rounded-lg text-center">
          <div className="text-sm text-gray-400">Lives</div>
          <div className="font-display font-bold text-lg text-pink-400">{'❤'.repeat(lives) || '—'}</div>
        </div>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onMouseMove={handleMouseMove}
          onTouchMove={handleTouchMove}
          className="rounded-2xl border border-slate-700/50 touch-none cursor-none"
          style={{ maxWidth: '100%', maxHeight: '420px' }}
        />

        {gameState === 'idle' && (
          <div className="absolute inset-0 rounded-2xl bg-black/70 flex flex-col items-center justify-center">
            <Blocks className="w-12 h-12 text-cyan-400 mb-3" />
            <div className="font-display font-bold text-xl text-white mb-2">Brick Breaker</div>
            <div className="text-sm text-gray-400 mb-4 text-center max-w-xs px-4">
              Move the paddle to bounce the ball and smash all the bricks. Don't let the ball fall! Mouse or touch to control.
            </div>
            <button onClick={startGame} className="btn-primary px-8 py-3 rounded-lg text-sm font-semibold">
              Start Game
            </button>
          </div>
        )}

        {(gameState === 'over' || gameState === 'won') && (
          <div className="absolute inset-0 rounded-2xl bg-black/80 flex flex-col items-center justify-center animate-fade-in">
            <Trophy className={`w-10 h-10 mb-2 ${gameState === 'won' ? 'text-green-400' : 'text-pink-400'}`} />
            <div className="font-display font-bold text-xl text-white mb-1">
              {gameState === 'won' ? 'You Win!' : 'Game Over'}
            </div>
            <div className="font-display font-bold text-3xl text-cyan-400 mb-1">{score}</div>
            <div className="text-sm text-gray-400 mb-4">Best: {bestScore}</div>
            <button onClick={startGame} className="btn-primary px-8 py-3 rounded-lg text-sm font-semibold flex items-center gap-2">
              <RotateCcw className="w-4 h-4" />
              Play Again
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 glass px-4 py-2 rounded-lg mt-5">
        <Trophy className="w-4 h-4 text-pink-400" />
        <span className="text-sm text-gray-400">Best:</span>
        <span className="font-display font-bold text-pink-400">{bestScore}</span>
      </div>

      <p className="text-xs text-gray-500 mt-4 text-center max-w-xs">
        Move your mouse or finger to control the paddle. Break all bricks to win!
      </p>
    </div>
  );
}
