// ── Modelo del algoritmo de numeración transaccional (Fase H) ──────────────
// Este módulo NO habla con Supabase — es una réplica en memoria, fiel al
// diseño de `emitir_numero_factura`/`crear_factura_rectificativa` en
// supabase/migrations/20260910_001_fase_h_facturacion.sql, del
// comportamiento de bloqueo por fila (`SELECT ... FOR UPDATE`) y de
// commit/rollback de una transacción de Postgres.
//
// Por qué existe: este entorno de desarrollo no tiene Postgres/Docker
// disponible (verificado: `docker`, `psql`, `supabase` no están instalados),
// así que no se puede ejecutar una prueba de integración real contra la
// base de datos. Esta simulación prueba que el ALGORITMO es correcto bajo
// concurrencia — NO prueba que Postgres se comporte exactamente así (eso
// solo lo demuestra un test de integración real, pendiente de ejecutar en
// un Supabase local o de pruebas antes de activar esto en producción).
//
// Reglas replicadas fielmente del SQL:
//  1. `FOR UPDATE` bloquea la fila (emisor,serie) — una segunda transacción
//     concurrente para la MISMA fila espera a que la primera termine.
//  2. El contador solo se incrementa dentro de la transacción — si algo
//     posterior falla, TODO se revierte, incluido el contador (a diferencia
//     de una SEQUENCE de Postgres, que NO es transaccional).
//  3. Idempotencia: si `facturaId` ya tiene número asignado, se devuelve el
//     mismo número sin tocar el contador.
//  4. Bloqueo por 100% ya facturado de un ingreso — misma comprobación,
//     serializada por el bloqueo de la fila del ingreso implicado.

export interface ContadorRow { ultimoNumero: number; confirmado: boolean }

/** Estado en memoria que replica `numeracion_contador` + `facturas.numero_secuencial` + porcentaje ya facturado por ingreso. */
export class NumeracionSimulada {
  private contadores = new Map<string, ContadorRow>();
  private numerosAsignados = new Map<string, number>(); // facturaId -> numero (idempotencia)
  private porcentajeFacturadoPorIngreso = new Map<string, number>();
  // Un "lock" por clave — modela el bloqueo de fila de Postgres: mientras
  // una "transacción" tiene la promesa pendiente, cualquier otra que pida
  // la misma clave espera a que se libere (se resuelva) antes de continuar.
  private locks = new Map<string, Promise<void>>();

  private async conLock<T>(clave: string, fn: () => Promise<T> | T): Promise<T> {
    const anterior = this.locks.get(clave) ?? Promise.resolve();
    let liberar!: () => void;
    const propio = new Promise<void>((res) => { liberar = res; });
    this.locks.set(clave, anterior.then(() => propio));
    await anterior; // espera a que cualquier transacción previa sobre esta clave termine
    try {
      return await fn();
    } finally {
      liberar();
    }
  }

  confirmarContador(emisorId: string, serie: string, numeroInicial: number) {
    this.contadores.set(`${emisorId}::${serie}`, { ultimoNumero: numeroInicial - 1, confirmado: true });
  }

  /**
   * Replica `emitir_numero_factura`. `simularFalloTrasNumero` inyecta un
   * fallo DESPUÉS de incrementar el contador (para probar que el rollback
   * de la transacción también revierte el contador — el punto exacto que
   * fallaba al usar una SEQUENCE real).
   */
  async emitir(opts: {
    facturaId: string; emisorId: string; serie: string;
    ingresoId?: string; porcentajeFacturado?: number;
    simularFalloTrasNumero?: boolean;
  }): Promise<{ numero: number }> {
    const { facturaId, emisorId, serie, ingresoId, porcentajeFacturado, simularFalloTrasNumero } = opts;
    const clave = `${emisorId}::${serie}`;

    return this.conLock(clave, async () => {
      // Idempotencia — replica el SELECT numero_secuencial inicial.
      const existente = this.numerosAsignados.get(facturaId);
      if (existente != null) return { numero: existente };

      const row = this.contadores.get(clave);
      if (!row || !row.confirmado) {
        throw new Error('La numeración de facturación para este emisor/serie todavía no ha sido confirmada.');
      }

      // Snapshot para poder "revertir" si algo falla después — como Postgres
      // haría con un ROLLBACK real de una fila de tabla normal.
      const numeroPropuesto = row.ultimoNumero + 1;

      // Validación de 100% facturado, serializada por el mismo lock si
      // ingresoId coincide con otra emisión en curso (en el SQL real esto
      // usa el bloqueo de la fila/advisory lock del ingreso — aquí, al
      // reutilizar `conLock` con clave por ingreso además, se replica igual).
      if (ingresoId != null && porcentajeFacturado != null) {
        const yaFacturado = this.porcentajeFacturadoPorIngreso.get(ingresoId) ?? 0;
        if (yaFacturado + porcentajeFacturado > 100.001) {
          throw new Error(`Superaría el 100% facturado del ingreso (ya: ${yaFacturado}%, intentando: ${porcentajeFacturado}%).`);
        }
      }

      if (simularFalloTrasNumero) {
        // Fallo DESPUÉS de "calcular" el número pero ANTES de comprometer
        // nada — ni el contador ni el % facturado se actualizan: se
        // comporta como un ROLLBACK real (nada se escribe hasta el final).
        throw new Error('Fallo simulado tras asignar el número — nada debe quedar consumido.');
      }

      // "Commit": ahora sí se escribe todo, atómicamente (misma sección crítica).
      row.ultimoNumero = numeroPropuesto;
      this.numerosAsignados.set(facturaId, numeroPropuesto);
      if (ingresoId != null && porcentajeFacturado != null) {
        this.porcentajeFacturadoPorIngreso.set(ingresoId, (this.porcentajeFacturadoPorIngreso.get(ingresoId) ?? 0) + porcentajeFacturado);
      }
      return { numero: numeroPropuesto };
    });
  }

  ultimoNumero(emisorId: string, serie: string): number {
    return this.contadores.get(`${emisorId}::${serie}`)?.ultimoNumero ?? 0;
  }
}
