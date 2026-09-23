import {fetchJSON,HttpError,settings} from './server';
import {addressText,type Address} from './commerce';

const HEADERS = { 'User-Agent': 'ConfeitandoComAmor/1.0 (LocalDelivery)' };

export async function locateAddress(a:Address){
  const query=new URLSearchParams({q:`${a.street}, ${a.city} - ${a.state}`, format:'json', limit:'1', countrycodes:'br'});
  const r=await fetchJSON('https://nominatim.openstreetmap.org/search?'+query, {headers: HEADERS});
  const p=r?.[0];
  if(!p||!Number.isFinite(Number(p.lat))||!Number.isFinite(Number(p.lon)))throw new HttpError(422,'Endereço não localizado. Ajuste o ponto no mapa.');
  return {lat:Number(p.lat),lng:Number(p.lon)};
}

export async function reverseAddress(lat:number,lng:number){
  const query=new URLSearchParams({lat:String(lat),lon:String(lng),format:'json'});
  const r=await fetchJSON('https://nominatim.openstreetmap.org/reverse?'+query, {headers: HEADERS});
  const p=r?.address;
  if(!p)throw new HttpError(422,'Preencha seu endereço manualmente.');
  return {
    cep:p.postcode||'',
    street:p.road||p.pedestrian||'',
    number:p.house_number||'',
    district:p.suburb||p.neighbourhood||p.city_district||'',
    city:p.city||p.town||p.village||p.municipality||'',
    state:p.state||''
  };
}

export async function routeQuote(a:Address){
  const config=await settings();
  if(config.lat===null||config.lng===null)throw new HttpError(422,'A localização da confeitaria ainda não foi configurada.');
  if(!a.location?.confirmed)throw new HttpError(422,'Confirme o ponto de entrega.');
  
  const r=await fetchJSON(`https://router.project-osrm.org/route/v1/driving/${config.lng},${config.lat};${a.location.lng},${a.location.lat}?overview=false`, {headers: HEADERS});
  const distance=r.routes?.[0]?.distance;
  if(!Number.isFinite(distance)||distance<0)throw new HttpError(422,'Não encontramos uma rota. Confira o ponto no mapa.');
  if(distance>config.maxKm*1000)throw new HttpError(422,`Endereço fora da área de entrega de ${config.maxKm} km.`);
  
  return {
    distance:Math.round(distance),
    fee:Math.floor(Math.max(config.minFee,config.baseFee+Math.round(distance/1000*config.perKm))/100)*100
  };
}
