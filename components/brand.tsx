'use client';
import {createContext,useContext} from 'react';
const Context=createContext({name:'Confeitando com Amor',logo:'/brand-transparent.png'});
export function BrandProvider({value,children}:{value:{name:string;logo:string};children:React.ReactNode}){return <Context.Provider value={value}>{children}</Context.Provider>}
export function Brand(){const b=useContext(Context);return <a className="brand" href="/catalogo" aria-label={b.name+', início'}><img className="brand-transparent" src={b.logo} width={188} height={92} alt={b.name}/></a>}
export function Footer(){const b=useContext(Context);return <footer className="catalog-footer"><span>{b.name}</span><a href="/encomendas">Encomendas</a><a href="/painel">Painel da confeitaria</a></footer>}
