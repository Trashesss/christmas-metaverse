# 눈 내리는 마을

여러 명이 광장을 산책하며 이야기하고, 둘이서 레터링 케이크나 트리를 함께 꾸미는 3D 웹 서비스입니다.

## 실행

```bash
npm install
npm run dev        # http://localhost:5173
npm run dev:lan    # 같은 와이파이의 휴대폰에서도 접속
npm test
npm run build && npm start   # 서버 하나로 실행, http://localhost:8787
```

브라우저 창 두 개를 열면 혼자서도 확인할 수 있습니다.

## 구조

- `shared/` 서버와 화면이 같이 쓰는 규칙(장식 목록, 맵, 메시지 형식)
- `server/world.ts` 광장, 초대, 2인 활동, 전시 로직 / `server/index.ts` WebSocket과 정적 파일
- `src/three/` 3D 장면 / `src/ui/` 화면 UI

모든 상태는 서버 메모리에 있어서 서버를 끄면 전시와 접속 정보가 사라집니다.

## 에셋

`public/assets/`의 모델은 모두 [KayKit](https://github.com/KayKit-Game-Assets)(Kay Lousberg) CC0 에셋이며 폴더마다 `LICENSE.txt`가 있습니다.
케이크 그림판 글꼴은 Jua와 Gaegu(SIL OFL)입니다.
캐릭터 GLB는 쓰지 않는 무기, 모자, 애니메이션을 제거해 용량을 줄였습니다.
케이크, 트리, 장식, 산타 모자는 코드로 만든 도형입니다.
