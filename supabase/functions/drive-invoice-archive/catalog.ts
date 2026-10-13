const API='https://www.googleapis.com/drive/v3/files';
const FOLDER='application/vnd.google-apps.folder';
const MONTHS=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
interface DriveFile {id:string;name:string;mimeType:string;modifiedTime?:string;webViewLink?:string}
export const invoiceNumber=(name:string):number|null=>{
 if(/proforma/i.test(name))return null;const match=name.match(/^Factura\s+(\d+)\b/i);if(!match)return null;
 const n=Number(match[1]);return Number.isSafeInteger(n)&&n>0?n:null;
};
export async function listChildren(token:string,parent:string):Promise<DriveFile[]>{
 if(!/^[\w-]+$/.test(parent))throw new Error('Carpeta no válida.');
 const files:DriveFile[]=[];let pageToken='';
 do{
  const params=new URLSearchParams({q:`'${parent}' in parents and trashed=false`,fields:'nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink)',pageSize:'1000',supportsAllDrives:'true',includeItemsFromAllDrives:'true'});
  if(pageToken)params.set('pageToken',pageToken);
  const res=await fetch(`${API}?${params}`,{headers:{Authorization:`Bearer ${token}`}});
  if(!res.ok)throw new Error('No se pudo leer la carpeta de Drive. Comprueba la conexión y sus permisos.');
  const data=await res.json();files.push(...(data.files??[]));pageToken=data.nextPageToken??'';
  if(files.length>10000)throw new Error('La carpeta supera el límite de lectura. El archivo anterior se conserva.');
 }while(pageToken);return files;
}
export async function readArchive(token:string,root:string){
 const files:Record<string,unknown>[]=[];const folders:Record<string,unknown>[]=[];
 const years=(await listChildren(token,root)).filter(f=>f.mimeType===FOLDER&&/^20\d{2}$/.test(f.name.trim()));
 if(!years.length)throw new Error('No se encontraron carpetas anuales; se conserva el archivo anterior.');
 for(const year of years){
  const children=await listChildren(token,year.id);
  const quarters=children.filter(f=>f.mimeType===FOLDER&&/trimestre/i.test(f.name));
  const candidates=children.concat(...await Promise.all(quarters.map(q=>listChildren(token,q.id))));
  for(const month of candidates.filter(f=>f.mimeType===FOLDER&&MONTHS.includes(f.name.trim().toLowerCase()))){
   const mes=MONTHS.indexOf(month.name.trim().toLowerCase())+1,anio=Number(year.name);
   folders.push({id:month.id,anio,mes,tipo:'emitida',nombre:month.name});
   const docs=await listChildren(token,month.id);
   const add=(items:DriveFile[],tipo:string,parent:string)=>{for(const d of items.filter(f=>f.mimeType!==FOLDER)){files.push({id:d.id,nombre:d.name,tipo,anio,mes,carpeta_id:parent,numero:tipo==='emitida'?invoiceNumber(d.name):null,mime_type:d.mimeType,url:`https://drive.google.com/file/d/${d.id}/view`,actualizado_en:d.modifiedTime??null});}};
   add(docs.filter(d=>/^factura\b/i.test(d.name)),'emitida',month.id);
   for(const expense of docs.filter(d=>d.mimeType===FOLDER&&/^gastos\b/i.test(d.name))){
    folders.push({id:expense.id,anio,mes,tipo:'recibida',nombre:expense.name});
    add(await listChildren(token,expense.id),'recibida',expense.id);
   }
  }
 }
 if(!folders.length)throw new Error('No se encontraron carpetas mensuales; se conserva el archivo anterior.');
 return {files,folders};
}
