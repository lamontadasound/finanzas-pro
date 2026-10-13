let locks=0;let original='';
/** One shared lock for nested dialogs, released only when the last closes. */
export function lockPageScroll(){if(locks===0){original=document.body.style.overflow;document.body.style.overflow='hidden';}locks++;let released=false;return ()=>{if(released)return;released=true;locks--;if(locks===0)document.body.style.overflow=original;};}
