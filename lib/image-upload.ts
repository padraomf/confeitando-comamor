// Resize and re-encode before upload; the original photo and its metadata are not sent.
export async function standardPhoto(file:File,product=false):Promise<File>{
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Escolha uma foto JPG, PNG ou WebP.');
 if(!file.size||file.size>20*1024*1024)throw new Error('Escolha uma foto de até 20 MB.');
 const url=URL.createObjectURL(file),img=new Image();
 try{
  img.src=url;await img.decode();
  const w=img.naturalWidth,h=img.naturalHeight;if(!w||!h||w*h>60000000)throw new Error('Esta foto é muito grande. Escolha uma versão menor.');
  const canvas=document.createElement('canvas');
  const scale=Math.min(1,1200/Math.max(w,h));canvas.width=product?1200:Math.max(1,Math.round(w*scale));canvas.height=product?1200:Math.max(1,Math.round(h*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Não foi possível preparar a foto neste navegador.');
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
  const ratio=product?Math.max(canvas.width/w,canvas.height/h):Math.min(canvas.width/w,canvas.height/h);ctx.drawImage(img,(canvas.width-w*ratio)/2,(canvas.height-h*ratio)/2,w*ratio,h*ratio);
  const encode=(type:string,quality:number)=>new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Não foi possível converter a foto.')),type,quality));
  let blob=await encode('image/webp',.82);if(blob.type!=='image/webp')blob=await encode('image/jpeg',.82);
  if(blob.size>1024*1024)blob=await encode(blob.type,.65);
  if(blob.size>1500000)throw new Error('Não foi possível reduzir esta foto. Escolha outra imagem.');
  return new File([blob],product?'produto.'+(blob.type==='image/webp'?'webp':'jpg'):'referencia.'+(blob.type==='image/webp'?'webp':'jpg'),{type:blob.type});
 }catch(e){if(e instanceof Error&&e.name==='EncodingError')throw new Error('Não foi possível abrir a foto. Escolha outra imagem.');throw e}finally{URL.revokeObjectURL(url)}
}
