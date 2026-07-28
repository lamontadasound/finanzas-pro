import { supabase } from './supabase';
import { uid } from '../utils/helpers';
import type { Documento, DocumentoEntityType, DocumentoTipo, Area } from '../types';

export const DOCUMENTOS_BUCKET = 'investment-invoices';

const TIPOS_MIME_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
const EXTENSIONES_PERMITIDAS = ['pdf', 'jpg', 'jpeg', 'png'];

export class StorageUploadError extends Error {}

const extensionDe = (nombre: string) => nombre.split('.').pop()?.toLowerCase() ?? '';

export const validarArchivo = (file: File) => {
  const ext = extensionDe(file.name);
  if (!TIPOS_MIME_PERMITIDOS.includes(file.type) && !EXTENSIONES_PERMITIDAS.includes(ext)) {
    throw new StorageUploadError('Formato no admitido. Solo se aceptan PDF, JPG, JPEG y PNG.');
  }
};

interface SubirDocumentoParams {
  file: File;
  entityType: DocumentoEntityType;
  entityId: string;
  area: Area;
  tipo: DocumentoTipo;
  subidoPor: string;
  subidoPorNombre: string;
}

// Sube el archivo al bucket privado "documentos" y devuelve el registro listo
// para guardar con addDocumento(). No inserta en la tabla — eso lo hace quien llama,
// para poder sustituir un documento existente (borrar antes de insertar el nuevo).
export const subirDocumento = async (params: SubirDocumentoParams): Promise<Documento> => {
  const { file, entityType, entityId, area, tipo, subidoPor, subidoPorNombre } = params;
  validarArchivo(file);

  const ext = extensionDe(file.name);
  const storageKey = `${entityType}/${entityId}/${uid()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(DOCUMENTOS_BUCKET)
    .upload(storageKey, file, { upsert: false });

  if (uploadError) {
    throw new StorageUploadError(`No se pudo subir el archivo: ${uploadError.message}`);
  }

  return {
    id: uid(),
    entityType,
    entityId,
    area,
    nombre: file.name,
    tipo,
    storageKey,
    url: '',
    fechaSubida: new Date().toISOString(),
    subidoPor,
    subidoPorNombre,
    tamano: file.size,
    createdAt: new Date().toISOString(),
  };
};

export const obtenerUrlFirmada = async (storageKey: string): Promise<string> => {
  const { data, error } = await supabase.storage
    .from(DOCUMENTOS_BUCKET)
    .createSignedUrl(storageKey, 60 * 10);
  if (error || !data) {
    throw new StorageUploadError(`No se pudo generar el enlace: ${error?.message ?? 'error desconocido'}`);
  }
  return data.signedUrl;
};

export const eliminarArchivoStorage = async (storageKey: string): Promise<void> => {
  const { error } = await supabase.storage.from(DOCUMENTOS_BUCKET).remove([storageKey]);
  if (error) throw new StorageUploadError(`No se pudo eliminar el archivo: ${error.message}`);
};
