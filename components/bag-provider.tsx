'use client';

import {createContext, useContext, useEffect, useState, type Dispatch, type SetStateAction, type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {ShoppingBag, ArrowRight} from 'lucide-react';
import {api} from '@/lib/client';
import {money, type Product} from '@/lib/commerce';

type Cart = Record<string, number>;
type BagState = {
  cart: Cart;
  setCart: Dispatch<SetStateAction<Cart>>;
  cartReady: boolean;
  products: Product[];
  setProducts: Dispatch<SetStateAction<Product[]>>;
  bag: boolean;
  setBag: Dispatch<SetStateAction<boolean>>;
};
const BagContext = createContext<BagState | null>(null);
function readCart(): Cart {
  try {
    const saved = JSON.parse(localStorage.getItem('cca-bag') || '{}');
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
    return Object.fromEntries(Object.entries(saved).filter(([, n]) => typeof n === 'number' && Number.isInteger(n) && n > 0 && n <= 30)) as Cart;
  } catch { return {}; }
}
export function useBag() {
  const value = useContext(BagContext);
  if (!value) throw new Error('BagProvider is required');
  return value;
}
export function BagProvider({children}: {children: ReactNode}) {
  const [cart, setCart] = useState<Cart>({});
  const [cartReady, setCartReady] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [bag, setBag] = useState(false);
  useEffect(() => {
    setCart(readCart());
    setCartReady(true);
    const sync = (event: StorageEvent) => {if (event.key === 'cca-bag' || event.key === null) setCart(readCart());};
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  useEffect(() => {
    if (cartReady) try {localStorage.setItem('cca-bag', JSON.stringify(cart));} catch {}
  }, [cart, cartReady]);
  return <BagContext.Provider value={{cart, setCart, cartReady, products, setProducts, bag, setBag}}>
    {children}<FloatingBag/>
  </BagContext.Provider>;
}
function FloatingBag() {
  const {cart, cartReady, products, setProducts, bag} = useBag();
  const pathname = usePathname();
  const customerPage = !/^\/(painel|primeiro-acesso|api|signin|signout)(\/|-|$)/.test(pathname || '');
  const catalogPage = pathname === '/' || pathname === '/catalogo' || pathname?.startsWith('/produto/');
  const count = Object.values(cart).reduce((sum, n) => sum + n, 0);
  const priced = Object.entries(cart).every(([id]) => products.some(p => p.id === id));
  const subtotal = Object.entries(cart).reduce((sum, [id, n]) => sum + n * (products.find(p => p.id === id)?.price || 0), 0);
  useEffect(() => {
    if (!customerPage || catalogPage || !cartReady || !count) return;
    let active = true;
    api('catalog').then(r => {if (active) setProducts(r.products);}).catch(() => {});
    return () => {active = false;};
  }, [customerPage, catalogPage, cartReady, count, setProducts]);
  if (!customerPage || bag || !count) return null;
  return <a className="floating-bag" href="/sacola" aria-label={`Abrir sacola, ${count} ${count === 1 ? 'item' : 'itens'}`} onClick={event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    // The catalog opens its drawer immediately; other pages follow the real URL.
    const open = new Event('cca-open-bag', {cancelable: true});
    if (!window.dispatchEvent(open)) event.preventDefault();
  }}>
    <span className="floating-bag-icon"><ShoppingBag size={22}/><b>{count}</b></span>
    <span><strong>Minha sacola</strong><small>{count ? `${count} ${count === 1 ? 'item' : 'itens'}${priced ? ' · ' + money(subtotal) : ''}` : 'Escolha seus doces favoritos'}</small></span>
    <ArrowRight size={19}/>
  </a>;
}
