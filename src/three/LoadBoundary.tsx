import { useGLTF } from '@react-three/drei';
import { Component, Suspense, type ReactNode } from 'react';

const RETRY_DELAYS = [2000, 6000, 15_000];
const broken = new Set<string>();

/** 실패한 파일을 기억해 두는 useGLTF. 다시 받을 때 멀쩡한 파일까지 버리지 않게 한다. */
export function useModel(url: string) {
  try {
    return useGLTF(url);
  } catch (e) {
    if (e instanceof Error) broken.add(url);
    throw e;
  }
}

interface Props {
  urls: string[];
  fallback: ReactNode;
  children: ReactNode;
}

/** 모델 하나를 받지 못해도 화면 전체가 사라지지 않게 하고, 몇 번 다시 받아본다. */
export class LoadBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };
  private tries = 0;
  private timer?: ReturnType<typeof setTimeout>;

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    // 로더는 실패도 기억하므로 지워야 다시 받는다.
    for (const u of this.props.urls) if (broken.delete(u)) useGLTF.clear(u);
    clearTimeout(this.timer);
    const delay = RETRY_DELAYS[this.tries++];
    if (delay) this.timer = setTimeout(() => this.setState({ failed: false }), delay);
  }

  componentDidUpdate(prev: Props) {
    if (prev.urls.join() === this.props.urls.join()) return;
    this.tries = 0;
    clearTimeout(this.timer);
    if (this.state.failed) this.setState({ failed: false });
  }

  componentWillUnmount() {
    clearTimeout(this.timer);
  }

  render() {
    const { fallback, children } = this.props;
    // 다시 받는 동안에도 다른 모델이 함께 사라지지 않게 따로 기다린다.
    return this.state.failed ? fallback : <Suspense fallback={fallback}>{children}</Suspense>;
  }
}
