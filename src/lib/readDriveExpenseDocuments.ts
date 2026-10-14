import {supabase} from './supabase';
import {joinDriveExpenses,type DriveExpenseFile,type DriveExpenseAmount} from './driveExpenses';
import {readInvoiceAmounts} from './invoiceAmountReader';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import ocrWorkerUrl from 'tesseract.js/dist/worker.min.js?url';
let running:Promise<void>|null=null;
const VERSION='Lectura automática v1\n';
export function readDriveExpenseDocuments(onProgress:(message:string)=>void):Promise<void>{
 if(running)return running;
 running=readDocuments(onProgress).finally(()=>{running=null;});return running;
}
async function readDocuments(onProgress:(message:string)=>void){
 const [{data:files,error:fe},{data:amounts,error:ae},{data:{user}}]=await Promise.all([
  supabase.from('drive_invoice_files').select('*').eq('tipo','recibida'),
  supabase.from('drive_expense_amounts').select('*'),supabase.auth.getUser()]);
 if(fe||ae||!user)throw new Error('No se pudo cargar el archivo para leer los importes.');
 const rows=joinDriveExpenses(files as DriveExpenseFile[],amounts as DriveExpenseAmount[]);
 const pending=rows.filter(r=>r.estado==='pendiente'&&(!r.amount?.evidencia?.startsWith(VERSION)||r.amount.source_modified_at!==r.actualizado_en));
 if(!pending.length)return;
 const pdfjs=await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc=pdfWorkerUrl;
 let worker:Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>|undefined;
 const recognize=async(image:HTMLCanvasElement|Blob)=>{
  worker??=await (await import('tesseract.js')).createWorker('spa+eng',1,{workerPath:ocrWorkerUrl});
  const {data}=await worker.recognize(image,{}, {text:true,blocks:true});
  // Preserve reliable numbers even when a different number on the page is unclear.
  return data.blocks?.flatMap(b=>b.paragraphs.flatMap(p=>p.lines.map(l=>l.words.map(w=>/\d/.test(w.text)&&w.confidence<60?'?':w.text).join(' ')))).join('\n')??data.text;
 };
 let failed=0;
 try{
 for(let index=0;index<pending.length;index++){
  const row=pending[index];onProgress(`Leyendo factura ${index+1} de ${pending.length}…`);
  const {data:{user:current}}=await supabase.auth.getUser();if(current?.id!==user.id)throw new Error('La sesión ha cambiado. Vuelve a abrir los gastos.');
  try{
   const {data,error}=await supabase.functions.invoke('drive-expense-document',{body:{fileId:row.id}});
   if(error||!(data instanceof Blob))throw new Error('No se pudo leer el documento.');
   let text='';
   if(data.type.includes('pdf')){
    const doc=await pdfjs.getDocument({data:new Uint8Array(await data.arrayBuffer()),isEvalSupported:false}).promise;
    try{
     if(doc.numPages>30)throw new Error('Documento de más de 30 páginas.');
     for(let n=1;n<=doc.numPages;n++){
      const page=await doc.getPage(n);const content=await page.getTextContent();
      const items=content.items.filter((item):item is import('pdfjs-dist/types/src/display/api').TextItem=>'str' in item);
      const sorted=items.sort((a,b)=>Math.abs(a.transform[5]-b.transform[5])<3?a.transform[4]-b.transform[4]:b.transform[5]-a.transform[5]);
      let previousY:number|undefined;let pageText='';
      for(const item of sorted){const y=item.transform[5];pageText+=(previousY!==undefined&&Math.abs(previousY-y)>3?'\n':' ')+item.str;previousY=y;}
      if(pageText.replace(/\s/g,'').length<40){
       const unit=page.getViewport({scale:1});const scale=Math.min(2,2400/Math.max(unit.width,unit.height));
       const viewport=page.getViewport({scale});const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
       try{await page.render({canvas,canvasContext:canvas.getContext('2d')!,viewport}).promise;pageText=await recognize(canvas);}finally{canvas.width=canvas.height=0;}
      }
      text+=pageText+'\n';page.cleanup();
     }
    }finally{await doc.destroy();}
   }else text=await recognize(data);
   const parsed=readInvoiceAmounts(text);
   const result={file_id:row.id,source_modified_at:row.actualizado_en,proveedor:row.amount?.proveedor??'',numero_factura:row.amount?.numero_factura??'',fecha_factura:row.amount?.fecha_factura??null,...parsed,evidencia:VERSION+parsed.evidencia};
   // Optimistic write: never overwrite a review saved while OCR was running.
   const query=row.amount?supabase.from('drive_expense_amounts').update(result).eq('file_id',row.id).eq('actualizado_en',(row.amount as DriveExpenseAmount&{actualizado_en:string}).actualizado_en):supabase.from('drive_expense_amounts').insert(result);
   const {error:saveError}=await query;if(saveError)throw saveError;
  }catch{failed++;}
 }
 }finally{await worker?.terminate();onProgress('');}
 if(failed)throw new Error(`Se han leído los documentos disponibles. ${failed} no pudieron procesarse; vuelve a actualizar para reintentarlo.`);
}
