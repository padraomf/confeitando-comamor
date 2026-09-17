'use client';

export default function ErrorPage() {
  return <main className="setup-page"><div className="setup-card">
    <h1>Vamos carregar esta página novamente</h1>
    <p>A conexão pode ter sido interrompida ou o site pode ter recebido uma atualização. Os itens salvos na sacola serão mantidos.</p>
    <button className="btn-link" onClick={() => location.reload()}>Atualizar página</button>
    <a className="text-link" href="/catalogo">Voltar ao catálogo</a>
  </div></main>;
}
