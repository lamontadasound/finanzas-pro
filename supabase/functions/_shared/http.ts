export function serve(handler: (request: Request) => Promise<Response>) {
  Deno.serve(async req => {
    const origin=req.headers.get('origin');
    const allowed=(Deno.env.get('ALLOWED_ORIGINS')??'https://finanzas-pro10.vercel.app').split(',').map(s=>s.trim()).filter(Boolean);
    if(origin && !allowed.includes(origin)) return new Response('Origen no permitido',{status:403});
    const headers: Record<string,string>={'Vary':'Origin','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
    if(origin) headers['Access-Control-Allow-Origin']=origin;
    if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
    let response:Response;
    try { response=req.method==='POST'? await handler(req):json({error:'Método no permitido'},405); }
    catch {response=json({error:'No se pudo completar la operación. Puedes reintentar.'},500);}
    Object.entries(headers).forEach(([key,value])=>response.headers.set(key,value));return response;
  });
}
export function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});}
