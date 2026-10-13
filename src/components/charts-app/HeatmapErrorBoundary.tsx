import { Component } from 'react';
import type { ReactNode } from 'react';
import { RotateCw } from 'lucide-react';

interface Props { children: ReactNode }
interface State { hasError: boolean }

// Estado de error limpio, sin detalles técnicos — solo para fallos reales
// de renderizado (no para reintentos de montaje: ActivityHeatmap ya no
// depende de ninguna medición de contenedor que pueda fallar de forma
// intermitente, así que si esto se activa es un error genuino).
export class HeatmapErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-white border border-gray-100 rounded-[28px] p-8 flex flex-col items-center justify-center text-center gap-3">
          <p className="text-sm text-gray-500">No se ha podido cargar el mapa de actividad</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gray-900 text-white text-xs font-semibold hover:bg-black transition-colors"
          >
            <RotateCw size={12} />
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
