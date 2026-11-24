import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense, useState } from 'react';
import { COLORS } from '../../shared/items';
import { CHARACTERS_BY_GENDER, GENDERS, type Character, type Gender } from '../../shared/protocol';
import { connect } from '../net';
import { useStore } from '../store';
import { AvatarModel } from '../three/Avatar';
import { Snow } from '../three/Effects';

const GENDER_LABEL: Record<Gender, string> = { male: '남', female: '여' };
const LABEL: Record<Character, string> = { Barbarian: '숲지기', Knight: '문지기', Mage: '별지기', Rogue: '여행자' };

export function Lobby() {
  const connecting = useStore((s) => s.status === 'connecting');
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('female');
  const [picked, setPicked] = useState<Record<Gender, Character>>({ male: 'Knight', female: 'Mage' });
  const character = picked[gender];
  const [color, setColor] = useState(0);
  return (
    <main className="lobby">
      <div className="preview">
        <Canvas shadows="percentage" camera={{ position: [0, 1.5, 4], fov: 40 }}>
          <hemisphereLight args={['#c9d8ff', '#6b5a68', 2]} />
          <directionalLight position={[3, 5, 4]} intensity={2} color="#ffe6c4" castShadow />
          <Suspense fallback={null}>
            <AvatarModel key={`${character}:${color}`} character={character} color={color} clip="Idle" />
          </Suspense>
          <mesh rotation-x={-Math.PI / 2} receiveShadow>
            <circleGeometry args={[1.3, 40]} />
            <meshStandardMaterial color="#e6eefb" />
          </mesh>
          <Snow count={120} area={7} height={5} />
          <OrbitControls target={[0, 0.95, 0]} enableZoom={false} enablePan={false} minPolarAngle={1.3} maxPolarAngle={1.5} />
        </Canvas>
      </div>
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) connect({ name: name.trim().slice(0, 12), character, color });
        }}
      >
        <h1>눈 내리는 마을</h1>
        <p>산책하고, 이야기하고, 케이크와 트리를 같이 꾸며요.</p>
        <label>
          닉네임
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={12} placeholder="12자까지" autoComplete="off" />
        </label>
        <fieldset>
          <legend>남/여</legend>
          <div className="choices">
            {GENDERS.map((g) => (
              <button type="button" key={g} aria-pressed={g === gender} onClick={() => setGender(g)}>
                {GENDER_LABEL[g]}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>캐릭터</legend>
          <div className="choices">
            {CHARACTERS_BY_GENDER[gender].map((c) => (
              <button type="button" key={c} aria-pressed={c === character} onClick={() => setPicked({ ...picked, [gender]: c })}>
                {LABEL[c]}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>모자 색</legend>
          <Swatches value={color} onChange={setColor} />
        </fieldset>
        <button className="primary" disabled={!name.trim() || connecting}>
          {connecting ? '들어가는 중…' : '마을로 들어가기'}
        </button>
      </form>
    </main>
  );
}

const COLOR_LABEL = ['빨강', '금색', '초록', '파랑', '보라', '크림'];

export function Swatches({ value, onChange }: { value: number; onChange: (i: number) => void }) {
  return (
    <div className="swatches">
      {COLORS.map((c, i) => (
        <button type="button" key={c} aria-label={COLOR_LABEL[i]} aria-pressed={i === value} style={{ background: c }} onClick={() => onChange(i)} />
      ))}
    </div>
  );
}
