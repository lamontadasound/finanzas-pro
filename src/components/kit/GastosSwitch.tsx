import { useLocation, useNavigate } from 'react-router-dom';
import { spaceForPath } from '../shell/spaces';
import { Segmented } from './index';

/** Alterna entre gastos por evento y gastos generales dentro de una línea. */
export const GastosSwitch = ({ eventosLabel = 'Por eventos' }: { eventosLabel?: string }) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const item = spaceForPath(pathname).items.find((i) => i.label === 'Gastos');
  if (!item?.alsoActive?.[0]) return null;
  const eventos = item.to;
  const generales = item.alsoActive[0];
  const value = pathname.startsWith(generales) && !pathname.startsWith(eventos) ? 'generales' : 'eventos';
  return (
    <Segmented
      id="gastos-switch"
      value={value}
      onChange={(v) => navigate(v === 'eventos' ? eventos : generales)}
      options={[{ value: 'eventos', label: eventosLabel }, { value: 'generales', label: 'Generales' }]}
    />
  );
};
