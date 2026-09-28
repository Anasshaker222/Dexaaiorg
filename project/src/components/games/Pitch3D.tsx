// عرض ثلاثي الأبعاد للمباراة (Three.js): بيقرأ نفس حالة اللعبة ويحرّك اللاعبين والكرة بسلاسة.
// التحكم بيضل من اللوحة التكتيكية ثنائية الأبعاد (زي شاشة الرادار بألعاب الكورة).
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { PITCH_W, PITCH_H, goalCenter, type MatchState, type Team } from '../../lib/tacticsEngine';

const K = 0.7; // وحدة اللعبة -> متر (الملعب 105 x 67.2)
const COLORS: Record<Team, number> = { home: 0x06b6d4, away: 0xf43f5e };

function pitchTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1050;
  c.height = 672;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 14; i++) {
    g.fillStyle = i % 2 ? '#2b8a3e' : '#34a047';
    g.fillRect(i * 75, 0, 75, 672);
  }
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 4;
  g.strokeRect(10, 10, 1030, 652);
  g.beginPath(); g.moveTo(525, 10); g.lineTo(525, 662); g.stroke();
  g.beginPath(); g.arc(525, 336, 91, 0, Math.PI * 2); g.stroke();
  [10, 875].forEach((x) => g.strokeRect(x, 135, 165, 403));
  g.strokeRect(10, 245, 55, 183);
  g.strokeRect(985, 245, 55, 183);
  g.fillStyle = '#fff';
  [[110, 336], [940, 336], [525, 336]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill(); });
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  return t;
}

function makePlayer(color: number, gk: boolean): THREE.Group {
  const g = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color: gk ? 0xf59e0b : color, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.7, 4, 10), shirt);
  body.position.y = 1.15;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 14, 14), new THREE.MeshStandardMaterial({ color: 0xe8b98f }));
  head.position.y = 1.95;
  const legs: THREE.Mesh[] = [-0.16, 0.16].map((x) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.8), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
    leg.geometry.translate(0, -0.4, 0);
    leg.position.set(x, 0.8, 0);
    return leg;
  });
  g.add(body, head, ...legs);
  g.traverse((o) => { o.castShadow = true; });
  g.userData.legs = legs;
  return g;
}

function makeGoal(side: number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const post = (x: number, y: number, z: number, w: number, h: number, d: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
  };
  post(0, 1.22, -3.65, 0.12, 2.44, 0.12);
  post(0, 1.22, 3.65, 0.12, 2.44, 0.12);
  post(0, 2.44, 0, 0.12, 0.12, 7.4);
  const net = new THREE.Mesh(new THREE.PlaneGeometry(7.3, 2.44), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, side: THREE.DoubleSide }));
  net.rotation.y = Math.PI / 2;
  net.position.set(side * 1.8, 1.22, 0);
  g.add(net);
  g.position.x = side * 52.5;
  return g;
}

export default function Pitch3D({ state, myTeam }: { state: MatchState; myTeam: Team }) {
  const host = useRef<HTMLDivElement>(null);
  const live = useRef({ state, myTeam });
  live.current = { state, myTeam };

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1220);
    scene.fog = new THREE.Fog(0x0b1220, 90, 200);
    const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 400);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x1f3d24, 0.85));
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(30, 60, 25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 45, bottom: -45, far: 160 });
    scene.add(sun);

    const pitch = new THREE.Mesh(new THREE.PlaneGeometry(105, 67.2), new THREE.MeshStandardMaterial({ map: pitchTexture(), roughness: 0.95 }));
    pitch.rotation.x = -Math.PI / 2;
    pitch.receiveShadow = true;
    scene.add(pitch);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x14301a }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    scene.add(ground);
    scene.add(makeGoal(-1), makeGoal(1));

    // المدرجات: بتتوهج حسب حماس الجمهور
    const standsMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, emissive: 0xfbbf24, emissiveIntensity: 0 });
    [[0, -43, 140, 4], [0, 43, 140, 4], [-63, 0, 4, 96], [63, 0, 4, 96]].forEach(([x, z, w, d]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 9, d), standsMat);
      m.position.set(x, 4.5, z);
      scene.add(m);
    });

    const meshes: Record<Team, THREE.Group[]> = { home: [], away: [] };
    (['home', 'away'] as Team[]).forEach((t) => {
      for (let i = 0; i < live.current.state.positions[t].length; i++) {
        const p = makePlayer(COLORS[t], i === 0);
        scene.add(p);
        meshes[t].push(p);
      }
    });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 20), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
    ball.castShadow = true;
    scene.add(ball);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 32), new THREE.MeshBasicMaterial({ color: 0xfde047, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    scene.add(ring);

    const resize = () => {
      const w = el.clientWidth || 640;
      const h = el.clientHeight || 360;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    const clock = new THREE.Clock();
    const ballPos = new THREE.Vector3(0, 0.25, 0);
    const look = new THREE.Vector3();
    const cam = new THREE.Vector3(0, 26, 42);
    let inited = false;
    let shake = 0;
    let lastPlay = live.current.state.play?.id ?? 0;
    let raf = 0;

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.05);
      const time = clock.elapsedTime;
      const { state: s, myTeam: me } = live.current;
      const sg = me === 'home' ? 1 : -1;
      const toW = (p: { x: number; y: number }) => new THREE.Vector3((p.x - PITCH_W / 2) * K * sg, 0, (p.y - PITCH_H / 2) * K * sg);

      (['home', 'away'] as Team[]).forEach((t) =>
        s.positions[t].forEach((p, i) => {
          const m = meshes[t][i];
          if (!m) return;
          const target = toW(p);
          if (!inited) m.position.copy(target);
          const d = target.clone().sub(m.position);
          const dist = d.length();
          const moving = dist > 0.05;
          if (moving) {
            m.position.addScaledVector(d, Math.min(dist, 9 * dt) / dist);
            m.rotation.y = Math.atan2(d.x, d.z);
          } else {
            m.rotation.y = Math.atan2(ballPos.x - m.position.x, ballPos.z - m.position.z);
          }
          const swing = moving ? Math.sin(time * 14) * 0.7 : 0;
          const legs = m.userData.legs as THREE.Mesh[];
          legs[0].rotation.x = swing;
          legs[1].rotation.x = -swing;
        })
      );
      inited = true;

      // الكرة: بتلحق حاملها، وبترتفع بقوس لما تكون بعيدة (تمريرة/تسديدة)
      const owner = meshes[s.ballOwner][s.ballIndex];
      if (owner) {
        const dir = toW(goalCenter(s.ballOwner)).sub(owner.position).setY(0).normalize().multiplyScalar(0.8);
        const target = owner.position.clone().add(dir);
        const d = target.clone().sub(ballPos);
        d.y = 0;
        const dist = d.length();
        if (dist > 0.001) ballPos.addScaledVector(d, Math.min(dist, (dist > 3 ? 30 : 12) * dt) / dist);
        ballPos.y = 0.25 + Math.min(4, dist * 0.15);
        ball.position.copy(ballPos);
        ball.rotation.x += dt * (dist > 0.3 ? 12 : 0);
        ring.position.set(owner.position.x, 0.04, owner.position.z);
      }

      if ((s.play?.id ?? 0) !== lastPlay) {
        lastPlay = s.play?.id ?? 0;
        if (s.play?.kind === 'goal') shake = 1;
      }
      shake = Math.max(0, shake - dt);
      standsMat.emissiveIntensity = ((s.crowd ?? 20) / 100) * 0.5;

      look.lerp(ballPos, 1 - Math.exp(-3 * dt));
      cam.lerp(new THREE.Vector3(look.x * 0.75, 26, look.z * 0.4 + 42), 1 - Math.exp(-2 * dt));
      camera.position.set(cam.x + Math.sin(time * 60) * shake * 0.4, cam.y + Math.cos(time * 55) * shake * 0.3, cam.z);
      camera.lookAt(look.x, 0, look.z);
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={host} className="w-full aspect-video rounded-2xl overflow-hidden border border-slate-700/50" />;
}
