import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RotateCcw, Trophy, Flag } from 'lucide-react';

const CANVAS_W = 480;
const CANVAS_H = 360;
const TRACK_RADIUS = 7;
const TRACK_HALF_WIDTH = 1.8;
const TOTAL_LAPS = 3;

export default function DriftRacer3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [lap, setLap] = useState(1);
  const [time, setTime] = useState(0);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'finished'>('idle');
  const [bestTime, setBestTime] = useState<number | null>(null);

  const gameStateRef = useRef<'idle' | 'playing' | 'finished'>('idle');
  const carRef = useRef({ x: TRACK_RADIUS, z: 0, heading: Math.PI / 2, speed: 0 });
  const lapRef = useRef(1);
  const prevAngleRef = useRef(0);
  const startTimeRef = useRef(0);
  const finishTimeRef = useRef(0);
  const animRef = useRef<number>(0);
  const keysRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const stored = localStorage.getItem('drift3d-best');
    if (stored) setBestTime(parseFloat(stored));
  }, []);

  const startGame = useCallback(() => {
    carRef.current = { x: TRACK_RADIUS, z: 0, heading: Math.PI / 2, speed: 0 };
    lapRef.current = 1;
    prevAngleRef.current = 0;
    startTimeRef.current = performance.now();
    setLap(1);
    setTime(0);
    gameStateRef.current = 'playing';
    setGameState('playing');
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a16);
    scene.fog = new THREE.Fog(0x0a0a16, 12, 40);

    const camera = new THREE.PerspectiveCamera(65, CANVAS_W / CANVAS_H, 0.1, 80);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(CANVAS_W, CANVAS_H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0x8888ff, 0.7));
    const sun = new THREE.DirectionalLight(0xffffff, 0.6);
    sun.position.set(5, 12, 5);
    scene.add(sun);

    const groundGeo = new THREE.CircleGeometry(TRACK_RADIUS + 6, 48);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x0e2e1a });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const trackGeo = new THREE.RingGeometry(TRACK_RADIUS - TRACK_HALF_WIDTH, TRACK_RADIUS + TRACK_HALF_WIDTH, 64);
    const trackMat = new THREE.MeshStandardMaterial({ color: 0x222233 });
    const track = new THREE.Mesh(trackGeo, trackMat);
    track.rotation.x = -Math.PI / 2;
    track.position.y = 0.01;
    scene.add(track);

    const lineMat = new THREE.LineBasicMaterial({ color: 0x00f0ff });
    const centerPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      centerPoints.push(new THREE.Vector3(Math.cos(a) * TRACK_RADIUS, 0.02, Math.sin(a) * TRACK_RADIUS));
    }
    const centerLine = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(centerPoints), lineMat);
    scene.add(centerLine);

    const finishGeo = new THREE.PlaneGeometry(TRACK_HALF_WIDTH * 2, 0.5);
    const finishMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const finishLine = new THREE.Mesh(finishGeo, finishMat);
    finishLine.rotation.x = -Math.PI / 2;
    finishLine.position.set(TRACK_RADIUS, 0.03, 0);
    scene.add(finishLine);

    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const pylon = new THREE.Mesh(
        new THREE.ConeGeometry(0.25, 0.6, 8),
        new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xffaa00, emissiveIntensity: 0.4 })
      );
      pylon.position.set(Math.cos(a) * (TRACK_RADIUS + TRACK_HALF_WIDTH + 0.4), 0.3, Math.sin(a) * (TRACK_RADIUS + TRACK_HALF_WIDTH + 0.4));
      scene.add(pylon);
    }

    const carGeo = new THREE.BoxGeometry(0.7, 0.4, 1.2);
    const carMat = new THREE.MeshStandardMaterial({ color: 0xff2e93, emissive: 0xff2e93, emissiveIntensity: 0.4 });
    const car = new THREE.Mesh(carGeo, carMat);
    scene.add(car);

    const onKeyDown = (e: KeyboardEvent) => { keysRef.current[e.key] = true; };
    const onKeyUp = (e: KeyboardEvent) => { keysRef.current[e.key] = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const touchRef = { left: false, right: false, gas: false };
    const bindTouch = (id: string, key: 'left' | 'right' | 'gas') => {
      const el = container.querySelector(`[data-ctrl="${id}"]`);
      if (!el) return () => {};
      const down = () => { touchRef[key] = true; };
      const up = () => { touchRef[key] = false; };
      el.addEventListener('touchstart', down);
      el.addEventListener('touchend', up);
      el.addEventListener('mousedown', down);
      el.addEventListener('mouseup', up);
      return () => {
        el.removeEventListener('touchstart', down);
        el.removeEventListener('touchend', up);
        el.removeEventListener('mousedown', down);
        el.removeEventListener('mouseup', up);
      };
    };

    const clock = new THREE.Clock();

    const loop = () => {
      const dt = Math.min(clock.getDelta(), 0.033);

      if (gameStateRef.current === 'playing') {
        const c = carRef.current;
        const accel = (keysRef.current['ArrowUp'] || keysRef.current['w'] || touchRef.gas) ? 6 : 0;
        const brake = (keysRef.current['ArrowDown'] || keysRef.current['s']) ? 8 : 0;
        c.speed += (accel - brake) * dt;
        c.speed -= c.speed * 0.6 * dt;
        c.speed = THREE.MathUtils.clamp(c.speed, -2, 9);

        const steer = (
          ((keysRef.current['ArrowLeft'] || keysRef.current['a'] || touchRef.left) ? 1 : 0) -
          ((keysRef.current['ArrowRight'] || keysRef.current['d'] || touchRef.right) ? 1 : 0)
        );
        c.heading += steer * dt * 2.2 * (0.3 + Math.abs(c.speed) / 9);

        c.x += Math.cos(c.heading) * c.speed * dt;
        c.z += Math.sin(c.heading) * c.speed * dt;

        const distFromCenter = Math.hypot(c.x, c.z);
        if (distFromCenter < TRACK_RADIUS - TRACK_HALF_WIDTH - 0.6 || distFromCenter > TRACK_RADIUS + TRACK_HALF_WIDTH + 0.6) {
          c.speed *= 0.94;
        }

        car.position.set(c.x, 0.25, c.z);
        car.rotation.y = -c.heading + Math.PI / 2;

        const angle = Math.atan2(c.z, c.x);
        if (prevAngleRef.current > 2.4 && angle < -2.4) {
          lapRef.current += 1;
          if (lapRef.current > TOTAL_LAPS) {
            const totalTime = (performance.now() - startTimeRef.current) / 1000;
            finishTimeRef.current = totalTime;
            gameStateRef.current = 'finished';
            setGameState('finished');
            setBestTime((prev) => {
              if (prev === null || totalTime < prev) {
                localStorage.setItem('drift3d-best', String(totalTime));
                return totalTime;
              }
              return prev;
            });
          } else {
            setLap(lapRef.current);
          }
        }
        prevAngleRef.current = angle;

        if (gameStateRef.current === 'playing') {
          setTime((performance.now() - startTimeRef.current) / 1000);
        }

        const camDist = 5.5;
        const camX = c.x - Math.cos(c.heading) * camDist;
        const camZ = c.z - Math.sin(c.heading) * camDist;
        camera.position.x += (camX - camera.position.x) * 0.12;
        camera.position.z += (camZ - camera.position.z) * 0.12;
        camera.position.y = 3;
        camera.lookAt(c.x, 0.4, c.z);
      } else {
        camera.position.set(TRACK_RADIUS - 5.5, 3, 0);
        camera.lookAt(TRACK_RADIUS, 0.4, 0);
      }

      renderer.render(scene, camera);
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);

    const unbindLeft = bindTouch('left', 'left');
    const unbindRight = bindTouch('right', 'right');
    const unbindGas = bindTouch('gas', 'gas');

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      unbindLeft(); unbindRight(); unbindGas();
      groundGeo.dispose(); groundMat.dispose();
      trackGeo.dispose(); trackMat.dispose();
      finishGeo.dispose(); finishMat.dispose();
      carGeo.dispose(); carMat.dispose();
      lineMat.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-3 mb-5">
        <div className="glass px-4 py-2 rounded-lg text-center">
          <div className="text-sm text-gray-400">Lap</div>
          <div className="font-display font-bold text-lg text-cyan-400">{lap}/{TOTAL_LAPS}</div>
        </div>
        <div className="glass px-4 py-2 rounded-lg text-center">
          <div className="text-sm text-gray-400">Time</div>
          <div className="font-display font-bold text-lg text-green-400">{time.toFixed(1)}s</div>
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
            <Flag className="w-12 h-12 text-cyan-400 mb-3" />
            <div className="font-display font-bold text-xl text-white mb-2">Drift Racer 3D</div>
            <div className="text-sm text-gray-400 mb-4 text-center max-w-xs px-4">
              Complete {TOTAL_LAPS} laps around the neon circuit as fast as you can. Up/Down to accelerate and brake, Left/Right to steer.
            </div>
            <button onClick={startGame} className="btn-primary px-8 py-3 rounded-lg text-sm font-semibold">
              Start Race
            </button>
          </div>
        )}

        {gameState === 'finished' && (
          <div className="absolute inset-0 rounded-2xl bg-black/80 flex flex-col items-center justify-center animate-fade-in">
            <Trophy className="w-10 h-10 text-cyan-400 mb-2" />
            <div className="font-display font-bold text-xl text-white mb-1">Race Finished!</div>
            <div className="font-display font-bold text-3xl text-cyan-400 mb-1">{time.toFixed(1)}s</div>
            <div className="text-sm text-gray-400 mb-4">Best: {bestTime !== null ? `${bestTime.toFixed(1)}s` : '—'}</div>
            <button onClick={startGame} className="btn-primary px-8 py-3 rounded-lg text-sm font-semibold flex items-center gap-2">
              <RotateCcw className="w-4 h-4" />
              Race Again
            </button>
          </div>
        )}

        {gameState === 'playing' && (
          <div className="absolute bottom-3 inset-x-3 flex justify-between pointer-events-none md:hidden">
            <div className="flex gap-2 pointer-events-auto">
              <div data-ctrl="left" className="w-12 h-12 rounded-lg glass flex items-center justify-center text-lg select-none">◀</div>
              <div data-ctrl="right" className="w-12 h-12 rounded-lg glass flex items-center justify-center text-lg select-none">▶</div>
            </div>
            <div data-ctrl="gas" className="w-16 h-12 rounded-lg glass flex items-center justify-center text-xs font-semibold pointer-events-auto select-none">GAS</div>
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
        Stay on the track — drifting onto the grass slows you down. Finish {TOTAL_LAPS} laps as fast as possible.
      </p>
    </div>
  );
}
