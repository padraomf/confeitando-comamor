'use client';
import {Component, type ReactNode} from 'react';

export class SectionBoundary extends Component<{children: ReactNode}, {failed: boolean}> {
  state = {failed: false};
  static getDerivedStateFromError() {return {failed: true};}
  render() {
    if (this.state.failed) return <div className="notice" role="alert">
      <p>Não foi possível carregar esta área. Atualize a página para tentar novamente.</p>
      <button className="btn-link" onClick={() => location.reload()}>Atualizar página</button>
    </div>;
    return this.props.children;
  }
}
