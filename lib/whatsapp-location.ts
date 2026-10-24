// Only coordinates explicitly shared by the customer; never geocode an invented address.
export function whatsAppLocationLink(text:string){
 const link=text.match(/https:\/\/[^\s]+/i)?.[0];if(!link)return undefined;
 try{const url=new URL(link);if(!/^(?:www\.)?(?:google\.com|google\.com\.br|maps\.google\.com|maps\.apple\.com)$/.test(url.hostname))return undefined;
 const value=url.searchParams.get('q')||url.searchParams.get('query')||url.searchParams.get('ll')||url.pathname.match(/@(-?\d+\.\d+,-?\d+\.\d+)/)?.[1];
 const pair=value?.match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)(?:,|$)/);if(!pair)return undefined;
 const lat=Number(pair[1]),lng=Number(pair[2]);return Math.abs(lat)<=90&&Math.abs(lng)<=180?{lat,lng}:undefined;
 }catch{return undefined}
}
