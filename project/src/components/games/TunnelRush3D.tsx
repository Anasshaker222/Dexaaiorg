import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RotateCcw, Trophy, Zap } from 'lucide-react';

const LANES = [-1.6, 0, 1.6];
const CANVAS_W = 480;
const CANVAS_H = 360;

type Obstacle = {
  mesh: THREE.Mesh;
  lane: number;
};

export default function TunnelRush3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'over'>('idle');
  const [bestScore, setBestScore] = useState(0);

  const laneIndexRef = useRef(1);
  const jumpVelRef = useRef(0);
  const playerYRef = useRef(0);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const speedRef = useRef(0.16);
  const scoreRef = useRef(0);
  const animRef = useRef<number>(0);
  const gameStateRef = useRef<'idle' | 'playing' | 'over'>('idle');
  const spawnTimerRef = useRef(0);

  useEffect(() => {
    const stored = localStorage.getItem('tunnel3d-best');
    if (stored) setBestScore(parseInt(stored));
  }, []);

  const endGame = useCallback(() => {
    gameStateRef.current = 'over';
    setGameState('over');
    if (scoreRef.current > bestScore) {
      setBestScore(scoreRef.current);
      localStorage.setItem('tunnel3d-best', String(scoreRef.current));
    }
  }, [bestScore]);

  const startGame = useCallback(() => {
    scoreRef.current = 0;
    setScore(0);
    laneIndexRef.current = 1;
    jumpVelRef.current = 0;
    playerYRef.current = 0;
    speedRef.current = 0.16;
    spawnTimerRef.current = 0;
    gameStateRef.current = 'playing';
    setGameState('playing');
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0a0a16, 8, 34);
    scene.background = new THREE.Color(0x0a0a16);

    const camera = new THREE.PerspectiveCamera(70, CANVAS_W / CANVAS_H, 0.1, 100);
    camera.position.set(0, 1.6, 5.5);
    camera.lookAt(0, 0.6, -10);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(CANVAS_W, CANVAS_H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0x8888ff, 0.6);
    scene.add(ambient);
    const pointLight = new THREE.PointLight(0x00f0ff, 2, 20);
    pointLight.position.set(0, 3, 3);
    scene.add(pointLight);

    const floorGeo = new THREE.PlaneGeometry(6, 200);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x14142a, emissive: 0x0a0a20 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = -90;
    scene.add(floor);

    const lineMat = new THREE.LineBasicMaterial({ color: 0x00f0ff });
    const railLines: THREE.Line[] = [];
    [-2.4, -0.8, 0.8, 2.4].forEach((x) => {
      const points = [new THREE.Vector3(x, 0.01, 6), new THREE.Vector3(x, 0.01, -200)];
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geo, lineMat);
      scene.add(line);
      railLines.push(line);
    });

    const playerGeo = new THREE.OctahedronGeometry(0.4, 0);
    const playerMat = new THREE.MeshStandardMaterial({ color: 0xff2e93, emissive: 0xff2e93, emissiveIntensity: 0.7 });
    const player = new THREE.Mesh(playerGeo, playerMat);
    player.position.set(0, 0.4, 3.6);
    scene.add(player);

    const obstacleGeo = new THREE.BoxGeometry(1, 1, 1);
    const obstacleColors = [0x00f0ff, 0xff2e93, 0xffaa00];

    const keysRef = { current: {} as Record<string, boolean> };
    const onKeyDown = (e: KeyboardEvent) => {
      if (gameStateRef.current !== 'playing') return;
      if ((e.key === 'ArrowLeft' || e.key === 'a') && laneIndexRef.current > 0) {
        laneIndexRef.current -= 1;
      } else if ((e.key === 'ArrowRight' || e.key === 'd') && laneIndexRef.current < 2) {
        laneIndexRef.current += 1;
      } else if ((e.key === 'ArrowUp' || e.key === ' ' || e.key === 'w') && playerYRef.current <= 0.01) {
        jumpVelRef.current = 0.19;
      }
      keysRef.current[e.key] = true;
    };
    window.addEventListener('keydown', onKeyDown);

    let touchStartX = 0;
    const onTouchStart = (e: TouchEvent) => { touchStartX = e.touches[0].clientX; };
    const onTouchEnd = (e: TouchEvent) => {
      if (gameStateRef.current !== 'playing') return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 30) {
        if (dx < 0 && laneIndexRef.current > 0) laneIndexRef.current -= 1;
        else if (dx > 0 && laneIndexRef.current < 2) laneIndexRef.current += 1;
      } else if (playerYRef.current <= 0.01) {
        jumpVelRef.current = 0.19;
      }
    };
    renderer.domElement.addEventListener('touchstart', onTouchStart);
    renderer.domElement.addEventListener('touchend', onTouchEnd);

    const spawnObstacle = () => {
      const lane = Math.floor(Math.random() * 3);
      const color = obstacleColors[Math.floor(Math.random() * obstacleColors.length)];
      const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4 });
      const mesh = new THREE.Mesh(obstacleGeo, mat);
      mesh.position.set(LANES[lane], 0.5, -60);
      scene.add(mesh);
      obstaclesRef.current.push({ mesh, lane });
    };

    const clock = new THREE.Clock();

    const loop = () => {
      const dt = Math.min(clock.getDelta(), 0.05);

      if (gameStateRef.current === 'playing') {
        speedRef.current += dt * 0.01;
        scoreRef.current += dt * speedRef.current * 40;
        setScore(Math.floor(scoreRef.current));

        const targetX = LANES[laneIndexRef.current];
        player.position.x += (targetX - player.position.x) * 0.25;

        jumpVelRef.current -= dt * 0.9;
        playerYRef.current = Math.max(0, playerYRef.current + jumpVelRef.current);
        if (playerYRef.current <= 0) { playerYRef.current = 0; jumpVelRef.current = 0; }
        player.position.y = 0.4 + playerYRef.current * 1.6;
        player.rotation.x += dt * 3;
        player.rotation.y += dt * 2;

        spawnTimerRef.current -= dt;
        if (spawnTimerRef.current <= 0) {
          spawnObstacle();
          spawnTimerRef.current = Math.max(0.45, 1.1 - speedRef.current * 0.6);
        }

        railLines.forEach((line) => {
          const posAttr = line.geometry.attributes.position as THREE.BufferAttribute;
          posAttr.setZ(0, posAttr.getZ(0) + speedRef.current * 60 * dt);
          posAttr.setZ(1, posAttr.getZ(1) + speedRef.current * 60 * dt);
          if (posAttr.getZ(0) > 10) {
            posAttr.setZ(0, posAttr.getZ(0) - 206);
            posAttr.setZ(1, posAttr.getZ(1) - 206);
          }
          posAttr.needsUpdate = true;
        });

        for (let i = obstaclesRef.current.length - 1; i >= 0; i--) {
          const obs = obstaclesRef.current[i];
          obs.mesh.position.z += speedRef.current * 60 * dt;
          obs.mesh.rotation.y += dt;

          if (obs.mesh.position.z > 4.2) {
            scene.remove(obs.mesh);
            obstaclesRef.current.splice(i, 1);
            continue;
          }

          if (
            obs.mesh.position.z > 3.0 &&
            obs.mesh.position.z < 4.0 &&
            Math.abs(obs.mesh.position.x - player.position.x) < 0.65 &&
            player.position.y < 0.85
          ) {
            endGame();
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
      renderer.domElement.removeEventListener('touchstart', onTouchStart);
      renderer.domElement.removeEventListener('touchend', onTouchEnd);
      obstaclesRef.current.forEach((o) => {
        scene.remove(o.mesh);
        o.mesh.geometry.dispose();
        (o.mesh.material as THREE.Material).dispose();
      });
      obstaclesRef.current = [];
      obstacleGeo.dispose();
      playerGeo.dispose();
      playerMat.dispose();
      floorGeo.dispose();
      floorMat.dispose();
      lineMat.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [endGame]);

  const moveLane = (dir: -1 | 1) => {
    if (dir === -1 && laneIndexRef.current > 0) laneIndexRef.current -= 1;
    if (dir === 1 && laneIndexRef.current < 2) laneIndexRef.current += 1;
  };
  const jump = () => {
    if (playerYRef.current <= 0.01) jumpVelRef.current = 0.19;
  };

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-3 mb-5">
        <div className="glass px-4 py-2 rounded-lg text-center">
          <div className="text-sm text-gray-400">Score</div>
          <div className="font-display font-bold text-lg text-cyan-400">{score}</div>
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
            <Zap className="w-12 h-12 text-cyan-400 mb-3" />
            <div className="font-display font-bold text-xl text-white mb-2">Tunnel Rush 3D</div>
            <div className="text-sm text-gray-400 mb-4 text-center max-w-xs px-4">
              Switch lanes and jump to dodge the blocks racing toward you. Arrow keys / A-D to move, Space or Up to jump.
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
        {gameState === 'playing' && (
          <div className="flex gap-2">
            <button onClick={() => moveLane(-1)} className="btn-ghost w-10 h-10 rounded-lg flex items-center justify-center text-lg">←</button>
            <button onClick={jump} className="btn-ghost w-10 h-10 rounded-lg flex items-center justify-center text-lg">↑</button>
            <button onClick={() => moveLane(1)} className="btn-ghost w-10 h-10 rounded-lg flex items-center justify-center text-lg">→</button>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500 mt-4 text-center max-w-xs">
        Arrow keys or swipe to switch lanes, Space or tap to jump. Speed ramps up the longer you survive!
      </p>
    </div>
  );
}
