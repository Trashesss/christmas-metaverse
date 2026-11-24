import { Html, useAnimations, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { KIND_EMOJI } from '../../shared/items';
import type { Look } from '../../shared/look';
import type { Emote, PlayerState } from '../../shared/protocol';
import { positions } from '../net';
import { useStore } from '../store';
import { HEAD_SCALE, LIFT, baseUrl, bodyMaterial, buildBody, partUrls, setPalette, withNormal } from './avatarParts';
import { drawFace } from './faceTexture';
import { LoadBoundary, useModel } from './LoadBoundary';

/** 몸을 낮추고 머리를 키워 아기자기한 비율로 만든다. 머리는 낮춘 만큼 세로를 되돌린다. */
const BODY_SCALE = new THREE.Vector3(0.8, 0.64, 0.8);
const HEAD_BOOST = new THREE.Vector3(1.3, 1.3 * (0.8 / 0.64), 1.3);
const EMOTE: Record<Emote, { clip?: string; emoji: string; loop?: boolean }> = {
  wave: { clip: 'Wave', emoji: '👋' },
  cheer: { clip: 'Cheer', emoji: '🎉' },
  jump: { clip: 'Jump', emoji: '✨' },
  sit: { clip: 'Sit', emoji: '☕', loop: true },
  laugh: { emoji: '😂' },
  snow: { emoji: '❄️' },
};

interface ModelProps {
  look: Look;
  clip: string;
  loop?: boolean;
  /** 얼굴 그림 한 변의 픽셀 수. 가까이서 보는 미리보기만 크게 한다. */
  faceSize?: number;
}

/** 새 부품을 받는 동안에는 이전 모습을 그대로 둔다. */
export function AvatarModel({ look, ...props }: ModelProps) {
  const shown = useDeferredValue(look);
  return (
    <LoadBoundary urls={[baseUrl(shown), ...partUrls(shown)]} fallback={<Placeholder />}>
      <Rig key={shown.body} look={shown} {...props} />
    </LoadBoundary>
  );
}

function Rig({ look, clip, loop = true, faceSize = 256 }: ModelProps) {
  const urls = partUrls(look);
  urls.forEach((u) => useGLTF.preload(u));
  const { scene, animations } = useModel(baseUrl(look));
  // 배열로 한 번에 읽으면 조합마다 따로 저장되어 같은 파일을 다시 받는다. useGLTF는 React 상태를 쓰지 않아 개수가 달라져도 된다.
  const parts = urls.map((u) => useModel(u));
  const rig = useMemo(() => {
    const object = SkeletonUtils.clone(scene);
    object.getObjectByName('shin')?.removeFromParent();
    const body = object.getObjectByName('head') as THREE.SkinnedMesh;
    const face = object.getObjectByName('face') as THREE.SkinnedMesh;
    face.bind(body.skeleton, body.bindMatrix);
    const { material, palette } = bodyMaterial();
    body.material = material;
    body.frustumCulled = face.frustumCulled = false;
    body.castShadow = true;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = faceSize;
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.flipY = false;
    map.anisotropy = 4;
    // 원본을 그리면 닫힌 캔버스가 도형에 묶여 남으므로 복사해서 쓴다.
    face.geometry = withNormal(face.geometry.clone());
    face.material = new THREE.MeshStandardMaterial({ map, roughness: 0.85, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: LIFT });
    const bone = object.getObjectByName('Head') as THREE.Bone;
    return { object, body, face, bone, palette, canvas, map, materials: [material, face.material] };
  }, [scene, faceSize]);
  useEffect(
    () => () => {
      rig.body.skeleton.dispose();
      rig.face.geometry.dispose();
      rig.map.dispose();
      rig.materials.forEach((m) => m.dispose());
    },
    [rig],
  );

  const { body, hair, top, bottom, shoes, hat } = look;
  useLayoutEffect(() => {
    const geometry = buildBody(look, scene, parts.map((p) => p.scene), rig.body.skeleton.bones.indexOf(rig.bone));
    rig.body.geometry = geometry;
    return () => geometry.dispose();
    // 색만 바뀌면 도형을 다시 만들지 않는다.
  }, [rig, scene, body, hair, top, bottom, shoes, hat]);
  useLayoutEffect(() => {
    setPalette(rig.palette, look);
    rig.bone.scale.fromArray(HEAD_SCALE[look.face]).multiply(HEAD_BOOST);
    drawFace(rig.canvas, look);
    rig.map.needsUpdate = true;
  }, [rig, look]);

  const { actions } = useAnimations(animations, useMemo(() => ({ current: rig.object }), [rig]));
  useEffect(() => {
    const action = actions[clip];
    if (!action) return;
    action.reset().setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = true;
    action.fadeIn(0.2).play();
    return () => void action.fadeOut(0.2);
  }, [actions, clip, loop]);
  return <primitive object={rig.object} scale={BODY_SCALE} />;
}

/** 모습을 받는 동안 서 있는 자리를 보여준다. */
function Placeholder() {
  return (
    <mesh position-y={0.75} raycast={() => null}>
      <capsuleGeometry args={[0.22, 0.9, 4, 10]} />
      <meshStandardMaterial color="#c9d8ea" transparent opacity={0.6} />
    </mesh>
  );
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
      <AvatarModel look={player.look} clip={moving ? 'Run' : (act?.clip ?? 'Idle')} loop={!act?.clip || !!act.loop} />
      <Html center position={[0, 1.9, 0]} zIndexRange={[10, 0]} className="tag" pointerEvents="none">
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
