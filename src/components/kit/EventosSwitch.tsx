import { useLocation, useNavigate } from 'react-router-dom';
import { Segmented } from './index';

const BASE = '/lineas/montada-sound';

/** La Montada · Eventos: listado de eventos y calendario. */
export const EventosSwitch = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const value = pathname.startsWith(`${BASE}/calendario`) ? 'calendario' : 'eventos';
  return (
    <Segmented
      id="eventos-switch"
      value={value}
      onChange={(v) => navigate(`${BASE}/${v}`)}
      options={[{ value: 'eventos', label: 'Eventos' }, { value: 'calendario', label: 'Calendario' }]}
    />
  );
};
