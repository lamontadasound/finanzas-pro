import {GastosPage} from '../../shared/GastosPage';
import {GastosEventoPage} from '../../shared/GastosEventoPage';
export const InstallationsGastos=({variant}:{variant:'instalacion'|'generales'})=>variant==='instalacion'
 ? <GastosEventoPage area="dj" filterLinea="montada_installations" tituloOverride="Costes de instalación" singularOverride="instalación"/>
 : <GastosPage area="dj" filterLinea="montada_installations"/>;
