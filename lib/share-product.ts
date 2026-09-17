import {toast} from 'sonner';
import {money,type Product} from './commerce';
import {productPath} from './product-sharing';
export async function shareProduct(product:Product){const url=location.origin+productPath(product.id,product.name);try{if(navigator.share)await navigator.share({title:product.name,text:product.name+' · '+money(product.price)+' — Confeitando com Amor',url});else{await navigator.clipboard.writeText(url);toast.success('Link do produto copiado. Envie para seus amigos!')}}catch(e){if((e as Error).name!=='AbortError')toast.error('Não foi possível compartilhar. Copie o link na barra de endereço.')}}
