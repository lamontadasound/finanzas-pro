export const EVENT_CATEGORIES = ['DJ','Técnico','Montador','Gasolina','Furgoneta','Alquiler','Decoración','Almacén'];
export function normalizeEventCategory(value: string): string {
 const category=value.trim().replace(/\s+/g,' ');
 if(!category||category.length>80)throw new Error('Escribe una categoría de entre 1 y 80 caracteres.');
 return category;
}
export function eventCategoryOptions(values:string[]){
 const options=new Map(EVENT_CATEGORIES.map(v=>[v.toLocaleLowerCase('es'),v]));
 for(const v of values){const clean=v?.trim();if(clean&&!options.has(clean.toLocaleLowerCase('es')))options.set(clean.toLocaleLowerCase('es'),clean);}
 return [...options.values()];
}
