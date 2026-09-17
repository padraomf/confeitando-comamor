import {secrets,saveSecrets,fetchJSON,HttpError} from './server';
export const graphVersion='v23.0';
export async function whatsappStatus(){const s=await secrets();if(!s.waToken||!s.waPhoneId)return {connected:false};try{const r=await fetchJSON(`https://graph.facebook.com/${graphVersion}/${s.waPhoneId}?fields=display_phone_number,verified_name,platform_type`,{headers:{Authorization:`Bearer ${s.waToken}`}});return {connected:true,phone:r.display_phone_number,name:r.verified_name}}catch{return {connected:false,needsReconnect:true}}}
