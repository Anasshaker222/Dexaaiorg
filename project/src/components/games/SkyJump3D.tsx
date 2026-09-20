import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RotateCcw, Trophy, ArrowUpCircle } from 'lucide-react';

const CANVAS_W = 480;
const CANVAS_H = 360;
const X_RANGE = 2.6;
const GRAVITY = -14;
const JUMP_VEL = 7.2;
const PLATFORM_GAP = 1.7;

type Platform = { mesh: THREE.Mesh; x: number; y: number; moving: boolean; dir: number };

export default function SkyJump3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'over'>('idle');
  const [bestScore, setBestScore] = useState(0);

  const gameStateRef = useRef<'idle' | 'playing' | 'over'>('idle');
  const scoreRef = useRef(0);
  const playerPosRef = useRef({ x: 0, y: 0 });
  const velRef = useRef({ x: 0, y: JUMP_VEL });
  const platformsRef = useRef<Platform[]>([]);
  const topYRef = useRef(0);
  const camYRef = useRef(0);
  const animRef = useRef<number>(0);
  const keysRef = useRef<Record<string, boolean>>({});
  const touchDirRef = useRef(0);

  useEffect(() => {
    const stored = localStorage.getItem('skyjump3d-best');
    if (stored) setBestScore(parseInt(stored));
  }, []);

  const endGame = useCallback(() => {
    gameStateRef.current = 'over';
    setGameState('over');
    const final = Math.floor(scoreRef.current);
    if (final > bestScore) {
      setBestScore(final);
      localStorage.setItem('skyjump3d-best', String(final));
    }
  }, [bestScore]);

  const startGame = useCallback(() => {
    scoreRef.current = 0;
    setScore(0);
    playerPosRef.current = { x: 0, y: 0 };
    velRef.current = { x: 0, y: JUMP_VEL };
    topYRef.current = 0;
    camYRef.current = 0;
    gameStateRef.current = 'playing';
    setGameState('playing');
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0a0a16, 8, 26);
    scene.background = new THREE.Color(0x0a0a16);

    const camera = new THREE.PerspectiveCamera(60, CANVAS_W / CANVAS_H, 0.1, 60);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(CANVAS_W, CANVAS_H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0x8888ff, 0.7));
    const light = new THREE.PointLight(0x00f0ff, 1.6, 20);
    scene.add(light);

    const playerGeo = new THREE.SphereGeometry(0.35, 16, 16);
    const playerMat = new THREE.MeshStandardMaterial({ color: 0xff2e93, emissive: 0xff2e93, emissiveIntensity: 0.6 });
    const player = new THREE.Mesh(playerGeo, playerMat);
    scene.add(player);

    const platGeo = new THREE.BoxGeometry(1.3, 0.25, 1);
    const platColors = [0x00f0ff, 0x39ff88, 0xffaa00];

    const spawnPlatform = (y: number) => {
      const x = (Math.random() - 0.5) * 2 * X_RANGE;
      const moving = Math.random() < 0.3;
      const color = platColors[Math.floor(Math.random() * platColors.length)];
      const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35 });
      const mesh = new THREE.Mesh(platGeo, mat);
      mesh.position.set(x, y, 0);
      scene.add(mesh);
      platformsRef.current.push({ mesh, x, y, moving, dir: Math.random() < 0.5 ? 1 : -1 });
    };

    const resetWorld = () => {
      platformsRef.current.forEach((p) => {
        scene.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
      });
      platformsRef.current = [];
      spawnPlatform(-0.5);
      let y = -0.5;
      for (let i = 0; i < 12; i++) {
        y += PLATFORM_GAP;
        spawnPlatform(y);
      }
      topYRef.current = y;
    };
    resetWorld();

    const onKeyDown = (e: KeyboardEvent) => { keysRef.current[e.key] = true; };
    const onKeyUp = (e: KeyboardEvent) => { keysRef.current[e.key] = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const onTouchStart = (e: TouchEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const localX = e.touches[0].clientX - rect.left;
      touchDirRef.current = localX < rect.width / 2 ? -1 : 1;
    };
    const onTouchEnd = () => { touchDirRef.current = 0; };
    renderer.domElement.addEventListener('touchstart', onTouchStart);
    renderer.domElement.addEventListener('touchend', onTouchEnd);

    let wasIdle = true;
    const clock = new THREE.Clock();

    const loop = () => {
      const dt = Math.min(clock.getDelta(), 0.033);

      if (gameStateRef.current === 'playing') {
        if (wasIdle) { resetWorld(); wasIdle = false; }

        let dir = 0;
        if (keysRef.current['ArrowLeft'] || keysRef.current['a']) dir -= 1;
        if (keysRef.current['ArrowRight'] || keysRef.current['d']) dir += 1;
        if (dir === 0) dir = touchDirRef.current;

        velRef.current.x = dir * 3.6;
        playerPosRef.current.x += velRef.current.x * dt;
        playerPosRef.current.x = THREE.MathUtils.clamp(playerPosRef.current.x, -X_RANGE - 0.5, X_RANGE + 0.5);

        velRef.current.y += GRAVITY * dt;
        playerPosRef.current.y += velRef.current.y * dt;

        platformsRef.current.forEach((p) => {
          if (p.moving) {
            p.x += p.dir * 1.1 * dt;
            if (p.x > X_RANGE) p.dir = -1;
            if (p.x < -X_RANGE) p.dir = 1;
            p.mesh.position.x = p.x;
          }
          if (
            velRef.current.y < 0 &&
            playerPosRef.current.y - 0.35 <= p.y + 0.15 &&
            playerPosRef.current.y - 0.35 >= p.y - 0.25 &&
            Math.abs(playerPosRef.current.x - p.x) < 0.85
          ) {
            velRef.current.y = JUMP_VEL;
          }
        });

        if (playerPosRef.current.y > topYRef.current - PLATFORM_GAP * 4) {
          const newY = topYRef.current + PLATFORM_GAP;
          spawnPlatform(newY);
          topYRef.current = newY;
        }
        for (let i = platformsRef.current.length - 1; i >= 0; i--) {
          const p = platformsRef.current[i];
          if (p.y < playerPosRef.current.y - 7) {
            scene.remove(p.mesh);
            (p.mesh.material as THREE.Material).dispose();
            platformsRef.current.splice(i, 1);
          }
        }

        if (playerPosRef.current.y > scoreRef.current) {
          scoreRef.current = playerPosRef.current.y;
          setScore(Math.max(0, Math.floor(scoreRef.current)));
        }

        camYRef.current += (playerPosRef.current.y + 1.5 - camYRef.current) * 0.08;

        player.position.set(playerPosRef.current.x, playerPosRef.current.y, 0);
        player.rotation.x += dt * 4;

        light.position.set(playerPosRef.current.x, playerPosRef.current.y + 2, 3);

        camera.position.set(playerPosRef.current.x * 0.4, camYRef.current + 3.2, 6.5);
        camera.lookAt(playerPosRef.current.x * 0.4, camYRef.current, 0);

        if (playerPosRef.current.y < camYRef.current - 6) {
          endGame();
        }
      } else {
        wasIdle = true;
        camera.position.set(0, 3.2, 6.5);
        camera.lookAt(0, 0, 0);
      }

      renderer.render(scene, camera);
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      renderer.domElement.removeEventListener('touchstart', onTouchStart);
      renderer.domElement.removeEventListener('touchend', onTouchEnd);
      platformsRef.current.forEach((p) => {
        scene.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
      });
      platformsRef.current = [];
      platGeo.dispose();
      playerGeo.dispose();
      playerMat.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [endGame]);

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-3 mb-5">
        <div className="glass px-4 py-2 rounded-lg text-center">
          <div className="text-sm text-gray-400">Height</div>
          <div className="font-display font-bold text-lg text-cyan-400">{score}m</div>
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
            <ArrowUpCircle className="w-12 h-12 text-cyan-400 mb-3" />
            <div className="font-display font-bold text-xl text-white mb-2">Sky Jump 3D</div>
            <div className="text-sm text-gray-400 mb-4 text-center max-w-xs px-4">
              Bounce automatically from platform to platform and climb as high as you can. Arrow keys / A-D or tap left-right to steer.
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
            <div className="font-display font-bold text-3xl text-cyan-400 mb-1">{score}m</div>
            <div className="text-sm text-gray-400 mb-4">Best: {bestScore}m</div>
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
          <span className="font-display font-bold text-pink-400">{bestScore}m</span>
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-4 text-center max-w-xs">
        You bounce automatically — just steer left and right. Watch out for moving platforms and don't fall behind the camera!
      </p>
    </div>
  );
}
