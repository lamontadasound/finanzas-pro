export interface FotoMontaje { dataUrl: string; nombre: string; ancho: number; alto: number }
export async function prepararFotoMontaje(file: File): Promise<FotoMontaje> {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Elige una imagen JPG, PNG o WebP.');
  if (file.size > 10 * 1024 * 1024) throw new Error('La foto debe ocupar como máximo 10 MB.');
  const url=URL.createObjectURL(file);
  try {
    const img=new Image(); img.src=url; await img.decode();
    if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth*img.naturalHeight>50000000) throw new Error('La imagen es demasiado grande. Elige una foto de menos de 50 megapíxeles.');
    let scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement('canvas');
    for(let attempt=0;attempt<8;attempt++){
      canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
      const ctx=canvas.getContext('2d');if(!ctx)throw new Error('No se pudo preparar la foto.');
      ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
      const dataUrl=canvas.toDataURL('image/jpeg',.85);
      if(dataUrl.length<=280000)return {dataUrl,nombre:file.name,ancho:canvas.width,alto:canvas.height};
      scale*=.8;
    }
    throw new Error('No se pudo optimizar la foto. Prueba con una imagen más pequeña.');
  } catch(e) {
    if(e instanceof Error && e.name!=='EncodingError')throw e;
    throw new Error('No se pudo abrir esta imagen. Prueba con otro JPG o PNG.', {cause:e});
  } finally {URL.revokeObjectURL(url);}
}
