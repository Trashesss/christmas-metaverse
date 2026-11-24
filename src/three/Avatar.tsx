import { Html, useAnimations, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { COLORS, KIND_EMOJI } from '../../shared/items';
import { CHARACTERS, type Character, type Emote, type PlayerState } from '../../shared/protocol';
import { positions } from '../net';
import { useStore } from '../store';

const url = (c: Character) => `/assets/character-pack-adventures/${c}.glb`;
CHARACTERS.forEach((c) => useGLTF.preload(url(c)));

const SCALE = 0.62;
const EMOTE: Record<Emote, { clip?: string; emoji: string; loop?: boolean }> = {
  wave: { clip: 'Interact', emoji: '👋' },
  cheer: { clip: 'Cheer', emoji: '🎉' },
  jump: { clip: 'Jump_Full_Short', emoji: '✨' },
  sit: { clip: 'Sit_Floor_Idle', emoji: '☕', loop: true },
  laugh: { emoji: '😂' },
  snow: { emoji: '❄️' },
};

// 모자 도형과 재질은 모든 아바타가 함께 쓴다.
const HAT_PARTS = [
  { geo: new THREE.TorusGeometry(0.5, 0.11, 8, 18).rotateX(Math.PI / 2), tint: false, pos: [0, 0, 0], rotZ: 0 },
  { geo: new THREE.CylinderGeometry(0.28, 0.52, 0.42, 14), tint: true, pos: [0.02, 0.2, 0], rotZ: -0.1 },
  { geo: new THREE.ConeGeometry(0.27, 0.5, 12), tint: true, pos: [0.16, 0.56, 0], rotZ: -0.5 },
  { geo: new THREE.SphereGeometry(0.13, 10, 8), tint: false, pos: [0.3, 0.8, 0], rotZ: 0 },
];
const fur = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 });
const felts = COLORS.map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));

function santaHat(color: number) {
  const hat = new THREE.Group();
  for (const { geo, tint, pos, rotZ } of HAT_PARTS) {
    const mesh = new THREE.Mesh(geo, tint ? felts[color] : fur);
    mesh.position.fromArray(pos);
    mesh.rotation.z = rotZ;
    mesh.castShadow = true;
    hat.add(mesh);
  }
  return hat;
}

export function AvatarModel({ character, color, clip, loop = true }: { character: Character; color: number; clip: string; loop?: boolean }) {
  const { scene, animations } = useGLTF(url(character));
  const object = useMemo(() => {
    const copy = SkeletonUtils.clone(scene);
    copy.traverse((o) => {
      o.frustumCulled = false;
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    const hat = santaHat(color);
    hat.position.y = 0.8;
    copy.getObjectByName('head')?.add(hat);
    return copy;
  }, [scene, color]);
  useEffect(
    () => () =>
      object.traverse((o) => {
        if (o instanceof THREE.SkinnedMesh) o.skeleton.dispose();
      }),
    [object],
  );
  const { actions } = useAnimations(animations, useMemo(() => ({ current: object }), [object]));
  useEffect(() => {
    const action = actions[clip];
    if (!action) return;
    action.reset().setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = true;
    action.fadeIn(0.2).play();
    return () => void action.fadeOut(0.2);
  }, [actions, clip, loop]);
  return <primitive object={object} scale={SCALE} />;
}

const damp = THREE.MathUtils.damp;

/** 위치는 positions에서 읽는다. pose를 주면 활동 장면처럼 고정된 자리에 선다. */
export function Avatar({ player, pose }: { player: PlayerState; pose?: { x: number; z: number; ry: number } }) {
  const group = useRef<THREE.Group>(null);
  const isMe = useStore((s) => s.me === player.id);
  const bubble = useStore((s) => s.bubbles[player.id]);
  const emote = useStore((s) => s.emotes[player.id]);
  const muted = useStore((s) => s.muted[player.id]);
  const moving = useMoving(player.id, !pose);

  useFrame((_, dt) => {
    const g = group.current;
    const p = pose ?? positions.get(player.id);
    if (!g || !p) return;
    const far = Math.hypot(p.x - g.position.x, p.z - g.position.z) > 4;
    if (isMe || far || pose) g.position.set(p.x, 0, p.z);
    else {
      g.position.x = damp(g.position.x, p.x, 12, dt);
      g.position.z = damp(g.position.z, p.z, 12, dt);
    }
    const turn = Math.atan2(Math.sin(p.ry - g.rotation.y), Math.cos(p.ry - g.rotation.y));
    g.rotation.y += turn * (1 - Math.exp(-12 * dt));
  });

  const act = !moving && emote ? EMOTE[emote.emote] : undefined;
  return (
    <group ref={group}>
      <AvatarModel
        key={player.character}
        character={player.character}
        color={player.color}
        clip={moving ? 'Running_A' : (act?.clip ?? 'Idle')}
        loop={!act?.clip || !!act.loop}
      />
      <Html center position={[0, 2.05, 0]} zIndexRange={[10, 0]} className="tag" pointerEvents="none">
        {emote && <div key={emote.key} className="emote">{EMOTE[emote.emote].emoji}</div>}
        {bubble && !muted && <div className="bubble">{bubble.text}</div>}
        <div className={isMe ? 'name me' : 'name'}>
          {!pose && (player.activity ?? player.waiting) && `${KIND_EMOJI[(player.activity ?? player.waiting)!]} `}
          {player.name}
          {!pose && player.activity && <small> 꾸미는 중</small>}
          {!pose && player.waiting && <small> 같이 할 사람 찾는 중</small>}
        </div>
      </Html>
    </group>
  );
}

function useMoving(id: string, enabled: boolean) {
  const [moving, setMoving] = useState(false);
  useFrame(() => {
    const next = enabled && !!positions.get(id)?.moving;
    if (next !== moving) setMoving(next);
  });
  return moving;
}
