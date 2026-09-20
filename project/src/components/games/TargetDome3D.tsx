import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RotateCcw, Trophy, Target } from 'lucide-react';

const CANVAS_W = 480;
const CANVAS_H = 360;
const ROUND_SECONDS = 30;
const DOME_RADIUS = 9;

type TargetObj = { mesh: THREE.Mesh; life: number; hit: boolean };

export default function TargetDome3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'over'>('idle');
  const [bestScore, setBestScore] = useState(0);

  const gameStateRef = useRef<'idle' | 'playing' | 'over'>('idle');
  const scoreRef = useRef(0);
  const timeLeftRef = useRef(ROUND_SECONDS);
  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const targetsRef = useRef<TargetObj[]>([]);
  const spawnTimerRef = useRef(0);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const stored = localStorage.getItem('targetdome3d-best');
    if (stored) setBestScore(parseInt(stored));
  }, []);

  const endGame = useCallback(() => {
    gameStateRef.current = 'over';
    setGameState('over');
    if (scoreRef.current > bestScore) {
      setBestScore(scoreRef.current);
      localStorage.setItem('targetdome3d-best', String(scoreRef.current));
    }
  }, [bestScore]);

  const startGame = useCallback(() => {
    scoreRef.current = 0;
    timeLeftRef.current = ROUND_SECONDS;
    setScore(0);
    setTimeLeft(ROUND_SECONDS);
    yawRef.current = 0;
    pitchRef.current = 0;
    spawnTimerRef.current = 0;
    gameStateRef.current = 'playing';
    setGameState('playing');
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05050f);

    const camera = new THREE.PerspectiveCamera(70, CANVAS_W / CANVAS_H, 0.1, 30);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(CANVAS_W, CANVAS_H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0x8888ff, 0.8));
    const light = new THREE.PointLight(0x00f0ff, 1.2, 25);
    scene.add(light);

    const gridHelper = new THREE.GridHelper(DOME_RADIUS * 2, 20, 0x1e3a4a, 0x14202a);
    gridHelper.position.y = -DOME_RADIUS * 0.4;
    scene.add(gridHelper);

    for (let i = 0; i < 200; i++) {
      const star = new THREE.Mesh(new THREE.SphereGeometry(0.015, 4, 4), new THREE.MeshBasicMaterial({ color: 0x334466 }));
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const r = DOME_RADIUS + 3;
      star.position.set(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
      scene.add(star);
    }

    const targetGeo = new THREE.SphereGeometry(0.5, 16, 16);
    const raycaster = new THREE.Raycaster();
    const centerNDC = new THREE.Vector2(0, 0);

    const spawnTarget = () => {
      const yaw = (Math.random() - 0.5) * Math.PI * 1.4;
      const pitch = (Math.random() - 0.5) * 0.9 + 0.1;
      const x = DOME_RADIUS * Math.sin(yaw) * Math.cos(pitch);
      const y = DOME_RADIUS * Math.sin(pitch) + 1;
      const z = -DOME_RADIUS * Math.cos(yaw) * Math.cos(pitch);
      const color = [0xff2e93, 0x00f0ff, 0xffaa00][Math.floor(Math.random() * 3)];
      const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6 });
      const mesh = new THREE.Mesh(targetGeo, mat);
      mesh.position.set(x, y, z);
      mesh.scale.setScalar(0.001);
      scene.add(mesh);
      targetsRef.current.push({ mesh, life: 1.8, hit: false });
    };

    const tryShoot = () => {
      if (gameStateRef.current !== 'playing') return;
      raycaster.setFromCamera(centerNDC, camera);
      const meshes = targetsRef.current.filter((t) => !t.hit).map((t) => t.mesh);
      const hits = raycaster.intersectObjects(meshes);
      if (hits.length > 0) {
        const hitMesh = hits[0].object as THREE.Mesh;
        const target = targetsRef.current.find((t) => t.mesh === hitMesh);
        if (target) {
          target.hit = true;
          scoreRef.current += 10;
          setScore(scoreRef.current);
        }
      }
    };

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const onDown = (x: number, y: number) => { dragging = true; lastX = x; lastY = y; };
    const onMove = (x: number, y: number) => {
      if (!dragging) return;
      yawRef.current -= (x - lastX) * 0.004;
      pitchRef.current = THREE.MathUtils.clamp(pitchRef.current + (y - lastY) * 0.004, -0.9, 0.9);
      lastX = x; lastY = y;
    };
    const onUp = () => { dragging = false; };

    const onMouseDown = (e: MouseEvent) => onDown(e.clientX, e.clientY);
    const onMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const onMouseUp = () => onUp();
    const onClick = () => { if (!dragging) tryShoot(); };

    let touchMoved = false;
    const onTouchStart = (e: TouchEvent) => { onDown(e.touches[0].clientX, e.touches[0].clientY); touchMoved = false; };
    const onTouchMoveHandler = (e: TouchEvent) => {
      const before = { x: lastX, y: lastY };
      onMove(e.touches[0].clientX, e.touches[0].clientY);
      if (Math.abs(e.touches[0].clientX - before.x) > 3 || Math.abs(e.touches[0].clientY - before.y) > 3) touchMoved = true;
    };
    const onTouchEndHandler = () => { onUp(); if (!touchMoved) tryShoot(); };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') yawRef.current += 0.08;
      if (e.key === 'ArrowRight') yawRef.current -= 0.08;
      if (e.key === 'ArrowUp') pitchRef.current = Math.min(0.9, pitchRef.current + 0.06);
      if (e.key === 'ArrowDown') pitchRef.current = Math.max(-0.9, pitchRef.current - 0.06);
      if (e.key === ' ') tryShoot();
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('click', onClick);
    renderer.domElement.addEventListener('touchstart', onTouchStart);
    renderer.domElement.addEventListener('touchmove', onTouchMoveHandler);
    renderer.domElement.addEventListener('touchend', onTouchEndHandler);
    window.addEventListener('keydown', onKeyDown);

    const clock = new THREE.Clock();

    const loop = () => {
      const dt = Math.min(clock.getDelta(), 0.05);

      if (gameStateRef.current === 'playing') {
        timeLeftRef.current -= dt;
        setTimeLeft(Math.max(0, Math.ceil(timeLeftRef.current)));
        if (timeLeftRef.current <= 0) {
          endGame();
        }

        spawnTimerRef.current -= dt;
        if (spawnTimerRef.current <= 0 && targetsRef.current.filter((t) => !t.hit).length < 4) {
          spawnTarget();
          spawnTimerRef.current = 0.55 + Math.random() * 0.5;
        }

        for (let i = targetsRef.current.length - 1; i >= 0; i--) {
          const t = targetsRef.current[i];
          const s = t.mesh.scale.x;
          if (t.hit) {
            t.mesh.scale.setScalar(Math.max(0, s - dt * 4));
            if (t.mesh.scale.x <= 0.01) {
              scene.remove(t.mesh);
              (t.mesh.material as THREE.Material).dispose();
              targetsRef.current.splice(i, 1);
            }
            continue;
          }
          if (s < 1) t.mesh.scale.setScalar(Math.min(1, s + dt * 3));
          t.life -= dt;
          if (t.life <= 0) {
            scene.remove(t.mesh);
            (t.mesh.material as THREE.Material).dispose();
            targetsRef.current.splice(i, 1);
          }
        }

        camera.rotation.order = 'YXZ';
        camera.rotation.y = yawRef.current;
        camera.rotation.x = pitchRef.current;
      }

      renderer.render(scene, camera);
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animRef.current);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      renderer.domElement.removeEventListener('click', onClick);
      renderer.domElement.removeEventListener('touchstart', onTouchStart);
      renderer.domElement.removeEventListener('touchmove', onTouchMoveHandler);
      renderer.domElement.removeEventListener('touchend', onTouchEndHandler);
      window.removeEventListener('keydown', onKeyDown);
      cancelAnimationFrame(animRef.current);
      targetsRef.current.forEach((t) => {
        scene.remove(t.mesh);
        (t.mesh.material as THREE.Material).dispose();
      });
      targetsRef.current = [];
      targetGeo.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [endGame]);

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-3 mb-5">
        <div className="glass px-4 py-2 rounded-lg text-center">
          <div className="text-sm text-gray-400">Score</div>
          <div className="font-display font-bold text-lg text-cyan-400">{score}</div>
        </div>
        <div className="glass px-4 py-2 rounded-lg text-center">
          <div className="text-sm text-gray-400">Time</div>
          <div className="font-display font-bold text-lg text-orange-400">{timeLeft}s</div>
        </div>
      </div>

      <div className="relative" style={{ width: CANVAS_W, maxWidth: '100%' }}>
        <div
          ref={containerRef}
          className="rounded-2xl border border-slate-700/50 overflow-hidden mx-auto"
          style={{ width: CANVAS_W, height: CANVAS_H, maxWidth: '100%' }}
        />

        {gameState === 'playing' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-6 h-6 border border-cyan-400/80 rounded-full flex items-center justify-center">
              <div className="w-1 h-1 bg-cyan-400 rounded-full" />
            </div>
          </div>
        )}

        {gameState === 'idle' && (
          <div className="absolute inset-0 rounded-2xl bg-black/70 flex flex-col items-center justify-center">
            <Target className="w-12 h-12 text-cyan-400 mb-3" />
            <div className="font-display font-bold text-xl text-white mb-2">Target Dome 3D</div>
            <div className="text-sm text-gray-400 mb-4 text-center max-w-xs px-4">
              Look around the 3D dome and shoot glowing targets before they vanish. Drag to aim, tap or click to fire — 30 seconds on the clock.
            </div>
            <button onClick={startGame} className="btn-primary px-8 py-3 rounded-lg text-sm font-semibold">
              Start Game
            </button>
          </div>
        )}

        {gameState === 'over' && (
          <div className="absolute inset-0 rounded-2xl bg-black/80 flex flex-col items-center justify-center animate-fade-in">
            <Trophy className="w-10 h-10 text-cyan-400 mb-2" />
            <div className="font-display font-bold text-xl text-white mb-1">Time's Up!</div>
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
        Drag (mouse or touch) or use arrow keys to look around. Click, tap, or Space to shoot the target under the crosshair.
      </p>
    </div>
  );
}
