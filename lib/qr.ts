import QRCode from 'qrcode/lib/core/qrcode.js';

// The matrix is generated locally: delivery addresses never go to a QR service.
export function qrSvg(text:string){
 const {modules}=QRCode.create(text,{errorCorrectionLevel:'M'});
 const margin=4,size=modules.size+margin*2;
 const paths:string[]=[];
 for(let row=0;row<modules.size;row++)for(let col=0;col<modules.size;col++)if(modules.get(row,col))paths.push(`M${col+margin} ${row+margin}h1v1h-1z`);
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="200" height="200" role="img" aria-label="QR code para abrir a rota do endereço" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${paths.join('')}" fill="#000"/></svg>`;
}
