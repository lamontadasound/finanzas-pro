import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return this.props.fallback ?? (
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 p-8">
          <div className="bg-white border border-red-200 rounded-2xl p-8 max-w-lg w-full shadow-sm space-y-3 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <span className="text-red-500 text-xl">⚠</span>
            </div>
            <p className="text-red-600 font-semibold">Error al cargar esta sección</p>
            <p className="text-xs text-gray-500 font-mono bg-gray-50 rounded-lg p-3 break-all text-left">
              {this.state.error.message}
            </p>
            <button
              onClick={() => this.setState({ error: null })}
              className="mt-2 px-5 py-2 bg-amber-500 text-black text-sm font-semibold rounded-lg hover:bg-amber-400 transition-colors"
            >
              Reintentar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
