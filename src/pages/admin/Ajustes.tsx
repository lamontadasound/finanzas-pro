export const AdminAjustes = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Ajustes</h1>
      <p className="text-sm text-gray-500">Configuración general de la aplicación</p>
    </div>

    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
      <h2 className="text-sm font-semibold text-gray-800">Información de la cuenta</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-600">
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Empresa principal</p>
          <p className="font-semibold text-gray-900">La Montada Sound</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Versión</p>
          <p className="font-semibold text-gray-900">Finanzas Pro v4</p>
        </div>
      </div>
    </div>

    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm text-amber-800">
      <p className="font-semibold mb-1">Próximamente</p>
      <p className="text-amber-700">Configuración de IVA por defecto, datos fiscales de empresa, preferencias de exportación y más.</p>
    </div>
  </div>
);
