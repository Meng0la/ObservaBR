import {el,button,link,icon} from './ui.js'

export function designSystem() {
  const tokens=['bg','panel','ink','muted','line','accent','accent-bg','focus','info','warning','danger']
  const swatches=el('div',{class:'system-grid'},...tokens.map(name=>{
    const sample=el('div',{class:'token-swatch'})
    sample.style.backgroundColor='var(--'+name+')'
    return el('div',{},sample,el('code',{},'--'+name))
  }))
  const feedback=el('p',{role:'status',class:'notice'},'Os controles abaixo demonstram os estados de interação.')
  return el('article',{class:'system-page'},
    el('header',{class:'intro'},el('div',{},el('p',{class:'eyebrow'},'ObservaBR · Componentes'),el('h1',{},'Design system'),el('p',{},'Temas, tipografia e componentes da interface.'))),
    el('section',{class:'panel'},el('h2',{},'Cores semânticas'),swatches),
    el('section',{class:'panel'},el('h2',{},'Tipografia'),
      el('p',{class:'editorial-sample'},'A informação pública pede contexto.'),
      el('p',{},'Manrope organiza a leitura, a navegação e as ações.'),
      el('p',{class:'mono'},'IBM Plex Mono · 0123456789 · R$ · SHA-256')),
    el('section',{class:'panel'},el('h2',{},'Ações e foco'),
      el('div',{class:'actions'},button('Testar feedback',()=>{feedback.textContent='Ação recebida. O foco permanece no controle.'}),el('button',{disabled:true},'Indisponível'),link('Consultar metodologia','#metodologia'),icon('inspect')),feedback),
    el('section',{class:'panel'},el('h2',{},'Estados documentais'),
      el('p',{class:'coverage-note'},'Cobertura parcial · o contexto acompanha o indicador.'),
      el('p',{class:'empty'},'Ausência de registros · resultado vazio da consulta.'),
      el('p',{class:'notice'},'Coleta pendente · consultar o andamento em Fontes e Cobertura.')),
    el('section',{class:'panel'},el('h2',{},'Tokens semânticos'),
      el('div',{class:'system-grid'},...['bg','panel','ink','muted','line','accent','focus','warning','error'].map(token=>
        el('div',{},el('div',{class:'token-swatch',style:'background:var(--'+token+');height:3rem;border:1px solid var(--line)'}),el('code',{},'--'+token))))),
    el('section',{class:'panel'},el('h2',{},'Tabela'),
      el('div',{class:'table-wrap'},el('table',{},el('thead',{},el('tr',{},el('th',{scope:'col'},'Campo'),el('th',{scope:'col'},'Apresentação'))),
        el('tbody',{},el('tr',{},el('td',{},'Data indisponível'),el('td',{class:'mono'},'Indisponível')),el('tr',{},el('td',{},'Fonte original'),el('td',{},link('Metodologia','#metodologia'))))))),
    el('p',{class:'empty'},'Esta página demonstra componentes. Os registros públicos são consultados nas páginas de exploração.'))
}
