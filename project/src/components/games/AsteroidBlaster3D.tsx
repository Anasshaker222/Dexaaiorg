import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RotateCcw, Trophy, Rocket, Heart } from 'lucide-react';

const CANVAS_W = 480;
const CANVAS_H = 360;
const PLAY_HALF_X = 3.4;
const PLAY_HALF_Y = 2.2;

type Body = { mesh: THREE.Mesh; vx: number; vy: number };

export default function AsteroidBlaster3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'over'>('idle');
  const [bestScore, setBestScore] = useState(0);

  const gameStateRef = useRef<'idle' | 'playing' | 'over'>('idle');
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const shipPosRef = useRef({ x: 0, y: 0 });
  const asteroidsRef = useRef<Body[]>([]);
  const bulletsRef = useRef<THREE.Mesh[]>([]);
  const spawnTimerRef = useRef(0);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const stored = localStorage.getItem('asteroid3d-best');
    if (stored) setBestScore(parseInt(stored));
  }, []);

  const endGame = useCallback(() => {
    gameStateRef.current = 'over';
    setGameState('over');
    if (scoreRef.current > bestScore) {
      setBestScore(scoreRef.current);
      localStorage.setItem('asteroid3d-best', String(scoreRef.current));
    }
  }, [bestScore]);

  const startGame = useCallback(() => {
    scoreRef.current = 0;
    livesRef.current = 3;
    setScore(0);
    setLives(3);
    shipPosRef.current = { x: 0, y: 0 };
    spawnTimerRef.current = 0;
    gameStateRef.current = 'playing';
    setGameState('playing');
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05050f);

    for (let i = 0; i < 120; i++) {
      const star = new THREE.Mesh(
        new THREE.SphereGeometry(0.015, 4, 4),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      star.position.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 8, -Math.random() * 30 - 2);
      scene.add(star);
    }

    const camera = new THREE.PerspectiveCamera(60, CANVAS_W / CANVAS_H, 0.1, 100);
    camera.position.set(0, 0, 7);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(CANVAS_W, CANVAS_H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0x8888ff, 0.7));
    const light = new THREE.PointLight(0x00f0ff, 1.5, 30);
    light.position.set(0, 0, 8);
    scene.add(light);

    const shipGeo = new THREE.ConeGeometry(0.32, 0.9, 6);
    const shipMat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00f0ff, emissiveIntensity: 0.6 });
    const ship = new THREE.Mesh(shipGeo, shipMat);
    ship.rotation.x = Math.PI / 2;
    scene.add(ship);

    const asteroidGeo = new THREE.IcosahedronGeometry(0.5, 0);
    const bulletGeo = new THREE.SphereGeometry(0.08, 6, 6);
    const bulletMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });

    const keysRef = { current: {} as Record<string, boolean> };
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key] = true;
      if (e.key === ' ' && gameStateRef.current === 'playing') fireBullet();
    };
    const onKeyUp = (e: KeyboardEvent) => { keysRef.current[e.key] = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const fireBullet = () => {
      const bullet = new THREE.Mesh(bulletGeo, bulletMat);
      bullet.position.set(shipPosRef.current.x, shipPosRef.current.y, 6.2);
      scene.add(bullet);
      bulletsRef.current.push(bullet);
    };

    const onPointerDown = () => {
      if (gameStateRef.current === 'playing') fireBullet();
    };
    renderer.domElement.addEventListener('mousedown', onPointerDown);
    renderer.domElement.addEventListener('touchstart', onPointerDown);

    let dragging = false;
    const onPointerMove = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((clientY - rect.top) / rect.height) * 2 - 1);
      shipPosRef.current.x = THREE.MathUtils.clamp(nx * PLAY_HALF_X, -PLAY_HALF_X, PLAY_HALF_X);
      shipPosRef.current.y = THREE.MathUtils.clamp(ny * PLAY_HALF_Y, -PLAY_HALF_Y, PLAY_HALF_Y);
    };
    const onMouseMove = (e: MouseEvent) => { if (gameStateRef.current === 'playing') onPointerMove(e.clientX, e.clientY); };
    const onTouchMove = (e: TouchEvent) => {
      if (gameStateRef.current === 'playing') { onPointerMove(e.touches[0].clientX, e.touches[0].clientY); dragging = true; }
    };
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('touchmove', onTouchMove);

    const spawnAsteroid = () => {
      const color = [0xff2e93, 0x00f0ff, 0xffaa00][Math.floor(Math.random() * 3)];
      const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3, flatShading: true });
      const mesh = new THREE.Mesh(asteroidGeo, mat);
      const angle = Math.random() * Math.PI * 2;
      const r = 2 + Math.random() * 2;
      mesh.position.set(Math.cos(angle) * r, Math.sin(angle) * r, -22);
      const scale = 0.6 + Math.random() * 0.9;
      mesh.scale.setScalar(scale);
      asteroidsRef.current.push({
        mesh,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
      });
      scene.add(mesh);
    };

    const clock = new THREE.Clock();

    const loop = () => {
      const dt = Math.min(clock.getDelta(), 0.05);

      if (gameStateRef.current === 'playing') {
        const moveSpeed = 4.2 * dt;
        if (keysRef.current['ArrowLeft'] || keysRef.current['a']) shipPosRef.current.x -= moveSpeed;
        if (keysRef.current['ArrowRight'] || keysRef.current['d']) shipPosRef.current.x += moveSpeed;
        if (keysRef.current['ArrowUp'] || keysRef.current['w']) shipPosRef.current.y += moveSpeed;
        if (keysRef.current['ArrowDown'] || keysRef.current['s']) shipPosRef.current.y -= moveSpeed;
        shipPosRef.current.x = THREE.MathUtils.clamp(shipPosRef.current.x, -PLAY_HALF_X, PLAY_HALF_X);
        shipPosRef.current.y = THREE.MathUtils.clamp(shipPosRef.current.y, -PLAY_HALF_Y, PLAY_HALF_Y);
        ship.position.x += (shipPosRef.current.x - ship.position.x) * 0.35;
        ship.position.y += (shipPosRef.current.y - ship.position.y) * 0.35;
        ship.rotation.z = (ship.position.x - shipPosRef.current.x) * 0.3;

        spawnTimerRef.current -= dt;
        if (spawnTimerRef.current <= 0) {
          spawnAsteroid();
          spawnTimerRef.current = Math.max(0.4, 1.3 - scoreRef.current * 0.01);
        }

        for (let i = bulletsRef.current.length - 1; i >= 0; i--) {
          const b = bulletsRef.current[i];
          b.position.z -= 18 * dt;
          if (b.position.z < -22) {
            scene.remove(b);
            bulletsRef.current.splice(i, 1);
          }
        }

        for (let i = asteroidsRef.current.length - 1; i >= 0; i--) {
          const a = asteroidsRef.current[i];
          a.mesh.position.z += 4.6 * dt * (1 + scoreRef.current * 0.004);
          a.mesh.position.x += a.vx * dt;
          a.mesh.position.y += a.vy * dt;
          a.mesh.rotation.x += dt;
          a.mesh.rotation.y += dt * 0.7;

          let hit = false;
          for (let j = bulletsRef.current.length - 1; j >= 0; j--) {
            const b = bulletsRef.current[j];
            if (a.mesh.position.distanceTo(b.position) < 0.55 * a.mesh.scale.x + 0.2) {
              scene.remove(b);
              bulletsRef.current.splice(j, 1);
              hit = true;
              break;
            }
          }
          if (hit) {
            scene.remove(a.mesh);
            asteroidsRef.current.splice(i, 1);
            scoreRef.current += 10;
            setScore(scoreRef.current);
            continue;
          }

          if (a.mesh.position.z > 7) {
            scene.remove(a.mesh);
            asteroidsRef.current.splice(i, 1);
            livesRef.current -= 1;
            setLives(livesRef.current);
            if (livesRef.current <= 0) endGame();
            continue;
          }

          if (a.mesh.position.z > 5.5 && a.mesh.position.distanceTo(ship.position) < 0.6 * a.mesh.scale.x + 0.3) {
            scene.remove(a.mesh);
            asteroidsRef.current.splice(i, 1);
            livesRef.current -= 1;
            setLives(livesRef.current);
            if (livesRef.current <= 0) endGame();
          }
        }
      }

      renderer.render(scene, camera);
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      renderer.domElement.removeEventListener('mousedown', onPointerDown);
      renderer.domElement.removeEventListener('touchstart', onPointerDown);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('touchmove', onTouchMove);
      asteroidsRef.current.forEach((a) => {
        scene.remove(a.mesh);
        (a.mesh.material as THREE.Material).dispose();
      });
      bulletsRef.current.forEach((b) => scene.remove(b));
      asteroidsRef.current = [];
      bulletsRef.current = [];
      asteroidGeo.dispose();
      bulletGeo.dispose();
      bulletMat.dispose();
      shipGeo.dispose();
      shipMat.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      void dragging;
    };
  }, [endGame]);

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-3 mb-5">
        <div className="glass px-4 py-2 rounded-lg text-center">
          <div className="text-sm text-gray-400">Score</div>
          <div className="font-display font-bold text-lg text-cyan-400">{score}</div>
        </div>
        <div className="glass px-4 py-2 rounded-lg text-center flex items-center gap-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <Heart key={i} className={`w-4 h-4 ${i < lives ? 'text-pink-400 fill-pink-400' : 'text-gray-700'}`} />
          ))}
        </div>
      </div>

      <div className="relative" style={{ width: CANVAS_W, maxWidth: '100%' }}>
        <div
          ref={containerRef}
          className="rounded-2xl border border-slate-700/50 overflow-hidden mx-auto"
          style={{ width: CANVAS_W, height: CANVAS_H, maxWidth: '100%' }}
        />

        {gameState === 'idle' && (
          <div className="absolute inset-0 rounded-2xl bg-black/70 flex flex-col items-center justify-center">
            <Rocket className="w-12 h-12 text-cyan-400 mb-3" />
            <div className="font-display font-bold text-xl text-white mb-2">Asteroid Blaster 3D</div>
            <div className="text-sm text-gray-400 mb-4 text-center max-w-xs px-4">
              Move your ship and blast incoming asteroids before they reach you. Mouse/touch to move, click or Space to fire.
            </div>
            <button onClick={startGame} className="btn-primary px-8 py-3 rounded-lg text-sm font-semibold">
              Start Game
            </button>
          </div>
        )}

        {gameState === 'over' && (
          <div className="absolute inset-0 rounded-2xl bg-black/80 flex flex-col items-center justify-center animate-fade-in">
            <Trophy className="w-10 h-10 text-cyan-400 mb-2" />
            <div className="font-display font-bold text-xl text-white mb-1">Game Over</div>
            <div className="font-display font-bold text-3xl text-cyan-400 mb-1">{score}</div>
            <div className="text-sm text-gray-400 mb-4">Best: {bestScore}</div>
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
          <span className="font-display font-bold text-pink-400">{bestScore}</span>
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-4 text-center max-w-xs">
        Move with mouse, touch, or arrow keys. Click, tap, or Space to fire. You have 3 lives.
      </p>
    </div>
  );
}
