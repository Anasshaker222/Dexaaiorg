// ملعب ثلاثي الأبعاد تفاعلي (Three.js): يشارك نفس حالة المباراة ومحرك القواعد.
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { PITCH_W, PITCH_H, goalCenter, type MatchState, type Team, type Point } from '../../lib/tacticsEngine';

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

type Pitch3DProps = {
  state: MatchState;
  myTeam: Team;
  selected: number | null;
  passActive: boolean;
  passTargets: number[];
  tackleTargets: number[];
  movementRadius: number;
  canInteract: boolean;
  onPlayerClick: (team: Team, index: number) => void;
  onPitchClick: (point: Point) => void;
};

export default function Pitch3D({ state, myTeam, selected, passActive, passTargets, tackleTargets, movementRadius, canInteract, onPlayerClick, onPitchClick }: Pitch3DProps) {
  const host = useRef<HTMLDivElement>(null);
  const live = useRef({ state, myTeam, selected, passActive, passTargets, tackleTargets, movementRadius, canInteract, onPlayerClick, onPitchClick });
  live.current = { state, myTeam, selected, passActive, passTargets, tackleTargets, movementRadius, canInteract, onPlayerClick, onPitchClick };

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
    const rainCount = 320;
    const rainPositions = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      rainPositions[i * 3] = (Math.random() - 0.5) * 120;
      rainPositions[i * 3 + 1] = Math.random() * 24;
      rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 85;
    }
    const rainGeometry = new THREE.BufferGeometry();
    rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    const rain = new THREE.Points(rainGeometry, new THREE.PointsMaterial({ color: 0xc7e8ff, size: 0.13, transparent: true, opacity: 0.55 }));
    rain.visible = false;
    scene.add(rain);
    const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 400);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x1f3d24, 0.85));
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(30, 60, 25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 45, bottom: -45, far: 160 });
    scene.add(sun);

    const pitchMaterial = new THREE.MeshStandardMaterial({ map: pitchTexture(), roughness: 0.95 });
    const pitch = new THREE.Mesh(new THREE.PlaneGeometry(105, 67.2), pitchMaterial);
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

    // مقاعد وجمهور مبسّط يملأ المدرجات بدل الكتل الفارغة.
    const crowd = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.34, 6, 5),
      new THREE.MeshStandardMaterial({ roughness: 0.85, vertexColors: true, emissive: 0x111827, emissiveIntensity: 0.18 }),
      500,
    );
    const crowdColors = [0x22d3ee, 0xf43f5e, 0xfbbf24, 0xe2e8f0, 0x818cf8].map((c) => new THREE.Color(c));
    const crowdMatrix = new THREE.Object3D();
    let crowdCount = 0;
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 31; col++) {
        const x = -67 + col * 4.45;
        for (const side of [-1, 1]) {
          crowdMatrix.position.set(x, 1.8 + row * 1.35, side * (40.15 - row * 0.08));
          crowdMatrix.scale.setScalar(0.8 + Math.random() * 0.35);
          crowdMatrix.updateMatrix();
          crowd.setMatrixAt(crowdCount, crowdMatrix.matrix);
          crowd.setColorAt(crowdCount++, crowdColors[Math.floor(Math.random() * crowdColors.length)]);
        }
      }
    }
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 19; col++) {
        const z = -45 + col * 5;
        for (const side of [-1, 1]) {
          crowdMatrix.position.set(side * (60.15 - row * 0.08), 1.8 + row * 1.35, z);
          crowdMatrix.scale.setScalar(0.8 + Math.random() * 0.35);
          crowdMatrix.updateMatrix();
          crowd.setMatrixAt(crowdCount, crowdMatrix.matrix);
          crowd.setColorAt(crowdCount++, crowdColors[Math.floor(Math.random() * crowdColors.length)]);
        }
      }
    }
    crowd.count = crowdCount;
    crowd.instanceMatrix.needsUpdate = true;
    if (crowd.instanceColor) crowd.instanceColor.needsUpdate = true;
    scene.add(crowd);

    // لوحات مضيئة وأبراج إنارة حول الملعب.
    const boardMat = new THREE.MeshStandardMaterial({ color: 0x0f766e, emissive: 0x0e7490, emissiveIntensity: 0.8, roughness: 0.45 });
    for (const side of [-1, 1]) {
      const board = new THREE.Mesh(new THREE.BoxGeometry(130, 0.8, 0.65), boardMat);
      board.position.set(0, 0.65, side * 34.8);
      scene.add(board);
    }
    const mastMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.65, roughness: 0.3 });
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdbeafe, emissiveIntensity: 2.2 });
    for (const x of [-70, 70]) {
      for (const z of [-43, 43]) {
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.48, 22, 8), mastMat);
        mast.position.set(x, 11, z);
        scene.add(mast);
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.8, 1.2), lampMat);
        lamp.position.set(x * 0.96, 22.2, z * 0.9);
        scene.add(lamp);
        const flood = new THREE.SpotLight(0xdbeafe, 75, 115, Math.PI / 4, 0.65, 1.2);
        flood.position.copy(lamp.position);
        flood.target.position.set(x * 0.35, 0, z * 0.35);
        scene.add(flood, flood.target);
      }
    }

    const meshes: Record<Team, THREE.Group[]> = { home: [], away: [] };
    const indicators: Record<Team, THREE.Mesh[]> = { home: [], away: [] };
    (['home', 'away'] as Team[]).forEach((t) => {
      for (let i = 0; i < live.current.state.positions[t].length; i++) {
        const p = makePlayer(COLORS[t], i === 0);
        p.userData.playerRef = { team: t, index: i };
        scene.add(p);
        meshes[t].push(p);
        const indicator = new THREE.Mesh(
          new THREE.RingGeometry(0.9, 1.15, 28),
          new THREE.MeshBasicMaterial({ color: 0xfde047, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
        );
        indicator.rotation.x = -Math.PI / 2;
        indicator.position.y = 0.055;
        indicator.visible = false;
        scene.add(indicator);
        indicators[t].push(indicator);
      }
    });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 20), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
    ball.castShadow = true;
    scene.add(ball);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 32), new THREE.MeshBasicMaterial({ color: 0xfde047, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    scene.add(ring);
    const movementRing = new THREE.Mesh(
      new THREE.RingGeometry(Math.max(0.4, live.current.movementRadius * K - 0.16), live.current.movementRadius * K, 72),
      new THREE.MeshBasicMaterial({ color: 0x67e8f9, side: THREE.DoubleSide, transparent: true, opacity: 0.62 }),
    );
    movementRing.rotation.x = -Math.PI / 2;
    movementRing.position.y = 0.035;
    scene.add(movementRing);

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

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const playerObjects = (['home', 'away'] as Team[]).flatMap((t) => meshes[t]);
    const onPointerDown = (event: PointerEvent) => {
      const current = live.current;
      if (!current.canInteract) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, 1 - ((event.clientY - rect.top) / rect.height) * 2);
      raycaster.setFromCamera(pointer, camera);
      const playerHit = raycaster.intersectObjects(playerObjects, true)[0];
      if (playerHit) {
        let object: THREE.Object3D | null = playerHit.object;
        while (object && !object.userData.playerRef) object = object.parent;
        if (object?.userData.playerRef) {
          const ref = object.userData.playerRef as { team: Team; index: number };
          current.onPlayerClick(ref.team, ref.index);
          return;
        }
      }
      const pitchHit = raycaster.intersectObject(pitch, false)[0];
      if (!pitchHit) return;
      const sg = current.myTeam === 'home' ? 1 : -1;
      current.onPitchClick({
        x: THREE.MathUtils.clamp(pitchHit.point.x / (K * sg) + PITCH_W / 2, 0, PITCH_W),
        y: THREE.MathUtils.clamp(pitchHit.point.z / (K * sg) + PITCH_H / 2, 0, PITCH_H),
      });
    };
    renderer.domElement.style.touchAction = 'manipulation';
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

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
          const indicator = indicators[t][i];
          const isSelected = t === me && live.current.selected === i;
          const isPassTarget = t === me && live.current.passActive && live.current.passTargets.includes(i);
          const isTackleTarget = t === me && live.current.tackleTargets.includes(i);
          indicator.visible = isSelected || isPassTarget || isTackleTarget;
          const indicatorMat = indicator.material as THREE.MeshBasicMaterial;
          indicatorMat.color.set(isSelected ? 0xffffff : isPassTarget ? 0xfde047 : 0xfb7185);
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
          indicator.position.x = m.position.x;
          indicator.position.z = m.position.z;
          const swing = moving ? Math.sin(time * 14) * 0.7 : 0;
          const legs = m.userData.legs as THREE.Mesh[];
          legs[0].rotation.x = swing;
          legs[1].rotation.x = -swing;
        })
      );
      inited = true;
      const selectedPosition = live.current.selected === null ? null : s.positions[me][live.current.selected];
      movementRing.visible = Boolean(selectedPosition && s.ap > 0 && !live.current.passActive && live.current.canInteract);
      if (selectedPosition) {
        const selectedPlayer = meshes[me][live.current.selected ?? -1];
        if (selectedPlayer) {
          movementRing.position.x = selectedPlayer.position.x;
          movementRing.position.z = selectedPlayer.position.z;
        }
      }

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
      rain.visible = s.weather === 'wet';
      pitchMaterial.roughness = s.weather === 'wet' ? 0.62 : s.weather === 'damp' ? 0.78 : 0.95;
      if (rain.visible) {
        for (let i = 0; i < rainCount; i++) {
          const y = rainPositions[i * 3 + 1] - dt * 26;
          rainPositions[i * 3 + 1] = y < 0 ? 22 + Math.random() * 4 : y;
          rainPositions[i * 3] += dt * 1.8;
        }
        rainGeometry.attributes.position.needsUpdate = true;
      }

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
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh || object instanceof THREE.Points)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      });
      pitchMaterial.map?.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div ref={host} className={`group relative w-full aspect-video rounded-2xl overflow-hidden border border-cyan-400/25 shadow-[0_0_32px_rgba(34,211,238,0.08)] ${canInteract ? 'cursor-crosshair' : ''}`}>
      <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-lg border border-white/10 bg-slate-950/65 px-2.5 py-1.5 text-[10px] text-cyan-100 backdrop-blur-sm">
        ملعب ثلاثي الأبعاد · {canInteract ? 'انقر لاعبًا أو نقطة على العشب للتحكم' : 'دور الخصم'}
      </div>
      <div className="pointer-events-none absolute bottom-3 right-3 z-10 rounded-lg bg-slate-950/60 px-2 py-1 text-[10px] text-white/75 backdrop-blur-sm">
        {state.weather === 'wet' ? '🌧️ ملعب ممطر' : state.weather === 'damp' ? '🌦️ عشب رطب' : '☀️ أجواء صافية'} · الجمهور {Math.round(state.crowd ?? 20)}%
      </div>
    </div>
  );
}
