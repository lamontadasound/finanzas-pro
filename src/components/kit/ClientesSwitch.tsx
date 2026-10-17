import { useLocation, useNavigate } from 'react-router-dom';
import { Segmented } from './index';

const BASE = '/lineas/montada-sound';

/** Clientes de La Montada: fichas de clientes y captación (CRM). */
export const ClientesSwitch = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const value = pathname.startsWith(`${BASE}/crm`) ? 'crm' : 'clientes';
  return (
    <Segmented
      id="clientes-switch"
      value={value}
      onChange={(v) => navigate(`${BASE}/${v}`)}
      options={[{ value: 'clientes', label: 'Cerrados' }, { value: 'crm', label: 'CRM' }]}
    />
  );
};
