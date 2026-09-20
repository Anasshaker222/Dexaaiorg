import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RotateCcw, Trophy, Map as MapIcon } from 'lucide-react';

const CANVAS_W = 480;
const CANVAS_H = 360;
const SIZE = 9;
const CELL = 2;

function generateMaze(size: number): boolean[][] {
  const w = size * 2 + 1;
  const grid: boolean[][] = Array.from({ length: w }, () => Array(w).fill(true));
  const visited = Array.from({ length: size }, () => Array(size).fill(false));

  const carve = (cx: number, cy: number) => {
    visited[cy][cx] = true;
    grid[cy * 2 + 1][cx * 2 + 1] = false;
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]].sort(() => Math.random() - 0.5);
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx >= 0 && ny >= 0 && nx < size && ny < size && !visited[ny][nx]) {
        grid[cy * 2 + 1 + dy][cx * 2 + 1 + dx] = false;
        carve(nx, ny);
      }
    }
  };
  carve(0, 0);
  return grid;
}

export default function MazeEscape3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'won'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [bestTime, setBestTime] = useState<number | null>(null);

  const gameStateRef = useRef<'idle' | 'playing' | 'won'>('idle');
  const mazeRef = useRef<boolean[][]>([]);
  const posRef = useRef({ x: 1.5 * CELL, z: 1.5 * CELL });
  const angleRef = useRef(0);
  const startTimeRef = useRef(0);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const stored = localStorage.getItem('maze3d-best');
    if (stored) setBestTime(parseFloat(stored));
  }, []);

  const wallAt = useCallback((gx: number, gz: number) => {
    const maze = mazeRef.current;
    if (gz < 0 || gz >= maze.length || gx < 0 || gx >= maze[0].length) return true;
    return maze[gz][gx];
  }, []);

  const startGame = useCallback(() => {
    mazeRef.current = generateMaze(SIZE);
    posRef.current = { x: 1.5 * CELL, z: 1.5 * CELL };
    angleRef.current = Math.PI / 2;
    startTimeRef.current = performance.now();
    setElapsed(0);
    gameStateRef.current = 'playing';
    setGameState('playing');
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05050f);
    scene.fog = new THREE.Fog(0x05050f, 3, 16);

    const camera = new THREE.PerspectiveCamera(75, CANVAS_W / CANVAS_H, 0.05, 50);
    camera.position.set(posRef.current.x, 0.9, posRef.current.z);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(CANVAS_W, CANVAS_H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0x8888ff, 0.5));
    const headlamp = new THREE.PointLight(0x00f0ff, 1.8, 9);
    camera.add(headlamp);
    scene.add(camera);

    const floorGeo = new THREE.PlaneGeometry(SIZE * 2 * CELL + CELL, SIZE * 2 * CELL + CELL);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x101022 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((SIZE * 2 * CELL) / 2, 0, (SIZE * 2 * CELL) / 2);
    scene.add(floor);

    const wallGeo = new THREE.BoxGeometry(CELL, 1.8, CELL);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1e1e3a, emissive: 0x00f0ff, emissiveIntensity: 0.08 });
    const wallMeshes: THREE.Mesh[] = [];

    let exitMarker: THREE.Mesh | null = null;

    const buildMaze = () => {
      wallMeshes.forEach((m) => scene.remove(m));
      wallMeshes.length = 0;
      const maze = mazeRef.current;
      for (let gz = 0; gz < maze.length; gz++) {
        for (let gx = 0; gx < maze[0].length; gx++) {
          if (maze[gz][gx]) {
            const wall = new THREE.Mesh(wallGeo, wallMat);
            wall.position.set(gx * CELL + CELL / 2, 0.9, gz * CELL + CELL / 2);
            scene.add(wall);
            wallMeshes.push(wall);
          }
        }
      }
      const exitGx = maze[0].length - 2;
      const exitGz = maze.length - 2;
      if (exitMarker) scene.remove(exitMarker);
      exitMarker = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.35, 1.4, 12),
        new THREE.MeshStandardMaterial({ color: 0x39ff88, emissive: 0x39ff88, emissiveIntensity: 0.9 })
      );
      exitMarker.position.set(exitGx * CELL + CELL / 2, 0.7, exitGz * CELL + CELL / 2);
      scene.add(exitMarker);
    };

    const keysRef = { current: {} as Record<string, boolean> };
    const onKeyDown = (e: KeyboardEvent) => { keysRef.current[e.key.toLowerCase()] = true; };
    const onKeyUp = (e: KeyboardEvent) => { keysRef.current[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    let dragStartX = 0;
    let dragging = false;
    let touchForward = false;
    const onTouchStart = (e: TouchEvent) => { dragging = true; dragStartX = e.touches[0].clientX; touchForward = true; };
    const onTouchMove = (e: TouchEvent) => {
      if (!dragging) return;
      const dx = e.touches[0].clientX - dragStartX;
      angleRef.current -= dx * 0.004;
      dragStartX = e.touches[0].clientX;
    };
    const onTouchEnd = () => { dragging = false; touchForward = false; };
    renderer.domElement.addEventListener('touchstart', onTouchStart);
    renderer.domElement.addEventListener('touchmove', onTouchMove);
    renderer.domElement.addEventListener('touchend', onTouchEnd);

    const minimapCtx = minimapRef.current?.getContext('2d') || null;

    const drawMinimap = () => {
      if (!minimapCtx || !minimapRef.current) return;
      const maze = mazeRef.current;
      const s = minimapRef.current.width / maze.length;
      minimapCtx.clearRect(0, 0, minimapRef.current.width, minimapRef.current.height);
      minimapCtx.fillStyle = 'rgba(10,10,20,0.85)';
      minimapCtx.fillRect(0, 0, minimapRef.current.width, minimapRef.current.height);
      for (let gz = 0; gz < maze.length; gz++) {
        for (let gx = 0; gx < maze[0].length; gx++) {
          if (maze[gz][gx]) {
            minimapCtx.fillStyle = '#2a2a4a';
            minimapCtx.fillRect(gx * s, gz * s, s + 0.5, s + 0.5);
          }
        }
      }
      minimapCtx.fillStyle = '#39ff88';
      const exGx = maze[0].length - 2;
      const exGz = maze.length - 2;
      minimapCtx.beginPath();
      minimapCtx.arc(exGx * s + s / 2, exGz * s + s / 2, s * 0.6, 0, Math.PI * 2);
      minimapCtx.fill();

      const px = (posRef.current.x / CELL) * s;
      const pz = (posRef.current.z / CELL) * s;
      minimapCtx.fillStyle = '#00f0ff';
      minimapCtx.beginPath();
      minimapCtx.arc(px, pz, s * 0.5, 0, Math.PI * 2);
      minimapCtx.fill();
      minimapCtx.strokeStyle = '#00f0ff';
      minimapCtx.beginPath();
      minimapCtx.moveTo(px, pz);
      minimapCtx.lineTo(px + Math.cos(angleRef.current) * s * 1.4, pz - Math.sin(angleRef.current) * s * 1.4);
      minimapCtx.stroke();
    };

    let mazeBuilt = false;
    const clock = new THREE.Clock();

    const loop = () => {
      const dt = Math.min(clock.getDelta(), 0.05);

      if (gameStateRef.current === 'playing') {
        if (!mazeBuilt) { buildMaze(); mazeBuilt = true; }

        const turnSpeed = 2.4 * dt;
        if (keysRef.current['arrowleft'] || keysRef.current['a']) angleRef.current += turnSpeed;
        if (keysRef.current['arrowright'] || keysRef.current['d']) angleRef.current -= turnSpeed;

        const moveDir =
          (keysRef.current['arrowup'] || keysRef.current['w'] ? 1 : 0) -
          (keysRef.current['arrowdown'] || keysRef.current['s'] ? 1 : 0) +
          (dragging && touchForward ? 1 : 0);

        if (moveDir !== 0) {
          const speed = 2.6 * dt * moveDir;
          const nx = posRef.current.x + Math.cos(angleRef.current) * speed;
          const nz = posRef.current.z - Math.sin(angleRef.current) * speed;

          const gx = Math.floor(nx / CELL);
          const gzCur = Math.floor(posRef.current.z / CELL);
          if (!wallAt(gx, gzCur)) posRef.current.x = nx;

          const gxCur = Math.floor(posRef.current.x / CELL);
          const gz = Math.floor(nz / CELL);
          if (!wallAt(gxCur, gz)) posRef.current.z = nz;
        }

        camera.position.set(posRef.current.x, 0.9, posRef.current.z);
        camera.rotation.y = angleRef.current + Math.PI / 2;

        const maze = mazeRef.current;
        const exitX = (maze[0].length - 2) * CELL + CELL / 2;
        const exitZ = (maze.length - 2) * CELL + CELL / 2;
        const dist = Math.hypot(posRef.current.x - exitX, posRef.current.z - exitZ);
        if (dist < 0.6) {
          const timeTaken = (performance.now() - startTimeRef.current) / 1000;
          gameStateRef.current = 'won';
          setGameState('won');
          setElapsed(timeTaken);
          setBestTime((prev) => {
            if (prev === null || timeTaken < prev) {
              localStorage.setItem('maze3d-best', String(timeTaken));
              return timeTaken;
            }
            return prev;
          });
        } else {
          setElapsed((performance.now() - startTimeRef.current) / 1000);
        }

        drawMinimap();
      } else {
        mazeBuilt = false;
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
      renderer.domElement.removeEventListener('touchmove', onTouchMove);
      renderer.domElement.removeEventListener('touchend', onTouchEnd);
      wallMeshes.forEach((m) => scene.remove(m));
      if (exitMarker) scene.remove(exitMarker);
      wallGeo.dispose();
      wallMat.dispose();
      floorGeo.dispose();
      floorMat.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [wallAt]);

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-3 mb-5">
        <div className="glass px-4 py-2 rounded-lg text-center">
          <div className="text-sm text-gray-400">Time</div>
          <div className="font-display font-bold text-lg text-cyan-400">{elapsed.toFixed(1)}s</div>
        </div>
      </div>

      <div className="relative" style={{ width: CANVAS_W, maxWidth: '100%' }}>
        <div
          ref={containerRef}
          className="rounded-2xl border border-slate-700/50 overflow-hidden mx-auto"
          style={{ width: CANVAS_W, height: CANVAS_H, maxWidth: '100%' }}
        />

        <canvas
          ref={minimapRef}
          width={90}
          height={90}
          className="absolute top-3 right-3 rounded-lg border border-cyan-500/40 pointer-events-none"
        />

        {gameState === 'idle' && (
          <div className="absolute inset-0 rounded-2xl bg-black/70 flex flex-col items-center justify-center">
            <MapIcon className="w-12 h-12 text-cyan-400 mb-3" />
            <div className="font-display font-bold text-xl text-white mb-2">Maze Escape 3D</div>
            <div className="text-sm text-gray-400 mb-4 text-center max-w-xs px-4">
              Find your way to the glowing green exit as fast as you can. WASD / arrows to move and turn, drag to look on touch.
            </div>
            <button onClick={startGame} className="btn-primary px-8 py-3 rounded-lg text-sm font-semibold">
              Start Game
            </button>
          </div>
        )}

        {gameState === 'won' && (
          <div className="absolute inset-0 rounded-2xl bg-black/80 flex flex-col items-center justify-center animate-fade-in">
            <Trophy className="w-10 h-10 text-cyan-400 mb-2" />
            <div className="font-display font-bold text-xl text-white mb-1">Escaped!</div>
            <div className="font-display font-bold text-3xl text-cyan-400 mb-1">{elapsed.toFixed(1)}s</div>
            <div className="text-sm text-gray-400 mb-4">Best: {bestTime !== null ? `${bestTime.toFixed(1)}s` : '—'}</div>
            <button onClick={startGame} className="btn-primary px-8 py-3 rounded-lg text-sm font-semibold flex items-center gap-2">
              <RotateCcw className="w-4 h-4" />
              New Maze
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 mt-5">
        <div className="flex items-center gap-2 glass px-4 py-2 rounded-lg">
          <Trophy className="w-4 h-4 text-pink-400" />
          <span className="text-sm text-gray-400">Best:</span>
          <span className="font-display font-bold text-pink-400">{bestTime !== null ? `${bestTime.toFixed(1)}s` : '—'}</span>
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-4 text-center max-w-xs">
        W/S or arrows to move, A/D or left/right to turn. Drag on touch screens to steer. Reach the green pillar to win.
      </p>
    </div>
  );
}
