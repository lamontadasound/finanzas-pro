import { Wrench } from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState';

// La Montada Installations nace vacía — sin datos legados que migrar. La
// estructura completa (proyectos, gastos de instalación, informes) llega en
// la Fase D, tras la aprobación de la muestra de La Montada Sound.
export const InstallationsStub = () => (
  <div className="space-y-5">
    <div>
      <h1 className="text-2xl font-bold text-gray-900 tracking-tight">La Montada Installations</h1>
      <p className="text-sm text-gray-400 mt-0.5">Nueva línea de negocio — todavía sin datos</p>
    </div>
    <EmptyState
      icon={<Wrench size={22} />}
      title="Línea preparada, sin proyectos todavía"
      description="La gestión de proyectos, gastos de instalación e informes se implementa en la Fase D, tras tu aprobación de la primera muestra."
    />
  </div>
);
