import { useLocation, useNavigate } from 'react-router-dom';
import { Segmented } from './index';

const BASE = '/lineas/montada-sound';

/** La Montada: Resultados e Informes en un mismo apartado. */
export const ResultadosSwitch = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const value = pathname.startsWith(`${BASE}/informes`) ? 'informes' : 'resultados';
  return (
    <Segmented
      id="resultados-switch"
      value={value}
      onChange={(v) => navigate(`${BASE}/${v}`)}
      options={[{ value: 'resultados', label: 'Resultados' }, { value: 'informes', label: 'Informes' }]}
    />
  );
};
