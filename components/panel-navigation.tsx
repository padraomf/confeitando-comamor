'use client';

import {useEffect, useState} from 'react';
import {usePathname} from 'next/navigation';
import {panelPages} from '@/lib/panel-pages';

function keyForPath(path: string) {
  return panelPages.find(p => path.replace(/\/$/, '') === '/painel/' + p.slug)?.key || 'orders';
}
export function usePanelNavigation() {
  const pathname = usePathname();
  const [tab, selectTab] = useState(() => keyForPath(pathname || '/painel'));
  useEffect(() => {selectTab(keyForPath(pathname || '/painel'));}, [pathname]);
  useEffect(() => {
    const sync = () => selectTab(keyForPath(location.pathname));
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  function setTab(key: string, replace = false) {
    const page = panelPages.find(p => p.key === key);
    if (!page) return;
    selectTab(key);
    const href = '/painel/' + page.slug;
    if (replace) history.replaceState(history.state, '', href);
    else if (location.pathname !== href) history.pushState(history.state, '', href);
  }
  return {tab, setTab};
}
export function PanelNavigation({tab, onNavigate, role, activeOrders}: {
  tab: string; onNavigate: (key: string) => void; role: string; activeOrders: number;
}) {
  return <nav className="panel-nav" aria-label="Páginas do painel">
    {panelPages.filter(p => role === 'admin' || (role === 'production' ? ['orders', 'access'] : ['orders', 'history', 'budgets', 'customers', 'access']).includes(p.key)).map(p =>
      <a className={tab === p.key ? 'active' : ''} key={p.key} href={'/painel/' + p.slug}
        aria-current={tab === p.key ? 'page' : undefined} onClick={event => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          onNavigate(p.key);
        }}>{p.label}{p.key === 'orders' && activeOrders > 0 && <b>{activeOrders}</b>}</a>
    )}
  </nav>;
}
