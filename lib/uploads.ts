import {HttpError,runtime} from './server';
function identify(bytes:Uint8Array){if(bytes.length>=12&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return {type:'image/jpeg',ext:'jpg'};if(bytes.length>=24&&bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71&&bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10)return {type:'image/png',ext:'png'};if(bytes.length>=20&&new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP')return {type:'image/webp',ext:'webp'};throw new HttpError(422,'Use uma foto JPG, PNG ou WebP válida.')}
export async function readPhoto(req:Request,preserve=false){
 if(!runtime.BUCKET)throw new HttpError(503,'Envio de fotos temporariamente indisponível.');
 if(Number(req.headers.get('content-length')||0)>(preserve?23000000:1600000))throw new HttpError(413,'Arquivo muito grande. Escolha uma foto de até 20 MB.');
 const form=await req.formData(),f=form.get('file');if(!(f instanceof File)||!f.size||f.size>1500000)throw new HttpError(422,'Escolha uma foto e aguarde a otimização.');
 const bytes=new Uint8Array(await f.arrayBuffer()),format=identify(bytes),raw=form.get('original');let original:({bytes:Uint8Array;type:string;ext:string})|undefined;
 if(preserve){if(!(raw instanceof File)||!raw.size||raw.size>20*1024*1024)throw new HttpError(422,'Escolha a imagem original de até 20 MB.');const data=new Uint8Array(await raw.arrayBuffer());original={bytes:data,...identify(data)}}
 return {bytes,...format,original};
}
