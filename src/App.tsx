import { Canvas, useThree } from '@react-three/fiber';
import { Suspense, useLayoutEffect } from 'react';
import type { PerspectiveCamera } from 'three';
import { useStore } from './store';
import { Plaza } from './three/Plaza';
import { Studio } from './three/Studio';
import { Hud } from './ui/Hud';
import { Lobby } from './ui/Lobby';

/** 휴대폰을 돌려도 화면 방향에 맞는 시야각을 쓴다. */
function FitView() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const portrait = useThree((s) => s.size.width < s.size.height);
  useLayoutEffect(() => {
    camera.fov = portrait ? 62 : 48;
    camera.updateProjectionMatrix();
  }, [camera, portrait]);
  return null;
}

export function App() {
  const online = useStore((s) => s.status === 'online');
  const session = useStore((s) => s.session);
  const toasts = useStore((s) => s.toasts);
  return (
    <>
      {/* 장면을 바꿀 때 캔버스를 다시 만들면 3D 이름표(Html) 정리가 깨지므로 하나를 계속 쓴다. */}
      <Canvas
        className="world"
        shadows="percentage"
        dpr={[1, 1.75]}
        frameloop={online ? 'always' : 'never'}
        camera={{ position: [0, 3.4, 8], near: 0.2, far: 130 }}
      >
        <FitView />
        <Suspense fallback={null}>{online && (session ? <Studio key={session.id} session={session} /> : <Plaza />)}</Suspense>
      </Canvas>
      {online ? <Hud /> : <Lobby />}
      <div className="toasts" role="status">
        {toasts.map((t) => (
          <div key={t.key}>{t.text}</div>
        ))}
      </div>
    </>
  );
}
