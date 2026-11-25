import { el, empty, currency } from './ui.js'
import 'maplibre-gl/dist/maplibre-gl.css'
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

export const ufByCode = {
  11:'RO',12:'AC',13:'AM',14:'RR',15:'PA',16:'AP',17:'TO',21:'MA',22:'PI',23:'CE',24:'RN',25:'PB',26:'PE',27:'AL',28:'SE',29:'BA',31:'MG',32:'ES',33:'RJ',35:'SP',41:'PR',42:'SC',43:'RS',50:'MS',51:'MT',52:'GO',53:'DF'
}
export const origin = 'https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=UF'
function paint(token) {
  const canvas=document.createElement('canvas')
  canvas.width=canvas.height=1
  const context=canvas.getContext('2d')
  context.fillStyle=getComputedStyle(document.documentElement).getPropertyValue(token).trim()
  context.fillRect(0,0,1,1)
  const [r,g,b]=context.getImageData(0,0,1,1).data
  return 'rgb('+[r,g,b].join(',')+')'
}
export async function drawMap(container, states, choose, signal) {
  const response = await fetch('/geo/uf.geojson', {signal})
  if (!response.ok) throw new Error('Malha indisponível')
  const geo = await response.json()
  const counts = new Map(states.map(s => [s.uf, Number(s.count)]))
  geo.features.forEach(f => {
    f.properties.uf = ufByCode[f.properties.codarea]
    f.properties.total = counts.get(f.properties.uf) || 0
  })
  const {Map: BrazilMap,NavigationControl,Popup,setWorkerUrl} = await import('maplibre-gl')
  setWorkerUrl(mapWorkerUrl)
  if (signal.aborted) return
  const map = new BrazilMap({
    container, attributionControl:false, scrollZoom:false, dragRotate:false,
    pitchWithRotate:false, bounds:[[-74,-34],[-34,5.5]], fitBoundsOptions:{padding:12},
    style:{version:8,sources:{ufs:{type:'geojson',data:geo}},layers:[
      {id:'base',type:'fill',source:'ufs',paint:{'fill-color':['interpolate',['linear'],['get','total'],0,paint('--map-empty'),1,paint('--map-low'),20,paint('--map-mid'),60,paint('--map-high')]}},
      {id:'line',type:'line',source:'ufs',paint:{'line-color':paint('--line'),'line-width':0.7}}
    ]}
  })
  map.touchZoomRotate.disableRotation()
  map.addControl(new NavigationControl({showCompass:false}),'top-right')
  const popup=new Popup({closeButton:false,closeOnClick:false})
  map.on('mousemove','base',event=>{
    const state=event.features?.[0]?.properties
    if(!state)return
    const content=el('div',{},el('strong',{},state.uf),el('p',{},String(state.total)+' deputados federais indexados'))
    popup.setLngLat(event.lngLat).setDOMContent(content).addTo(map)
  })
  map.on('click','base', e => { if(e.features?.length) choose(e.features[0].properties.uf) })
  map.on('mouseenter','base',() => { map.getCanvas().style.cursor='pointer' })
  map.on('mouseleave','base',() => { map.getCanvas().style.cursor='';popup.remove() })
  signal.addEventListener('abort',() => map.remove(),{once:true})
}

export async function drawHistory(container, rows, signal) {
  if (!rows.length) { container.replaceChildren(empty('Histórico de despesas ainda sem registros indexados.')); return }
  const {init} = await import('./expense-chart.js')
  if (signal.aborted) return
  const host=el('div',{class:'chart',role:'img','aria-label':'Despesas líquidas indexadas por mês'})
  const table=el('table',{},el('thead',{},el('tr',{},el('th',{},'Mês'),el('th',{},'Valor líquido'))),
    el('tbody',{},...rows.map(r=>el('tr',{},el('td',{},String(r.month).slice(0,7)),el('td',{},currency(r.amount))))))
  container.replaceChildren(host,el('details',{},el('summary',{},'Ver valores mensais'),table))
  const chart = init(host)
  const muted=getComputedStyle(container).getPropertyValue('--muted').trim()
  chart.setOption({grid:{left:12,right:18,bottom:8,top:15,containLabel:true},tooltip:{trigger:'axis',renderMode:'richText',valueFormatter:currency},
    xAxis:{type:'category',data:rows.map(r=>String(r.month).slice(0,7)),axisLabel:{color:muted}},
    yAxis:{type:'value',axisLabel:{color:muted},splitLine:{lineStyle:{color:paint('--line'),type:'dashed'}}},
    series:[{type:'bar',name:'Valor líquido',data:rows.map(r=>Number(r.amount)),itemStyle:{color:paint('--accent')},barMaxWidth:32}]})
  const observer=new ResizeObserver(()=>chart.resize())
  observer.observe(host)
  signal.addEventListener('abort',()=>{observer.disconnect();chart.dispose()},{once:true})
}
export async function drawAffiliation(container, person, signal) {
  if (!person.data?.party) {container.append(empty('Sem vínculo partidário documentado neste registro.'));return}
  const cyto=(await import('cytoscape')).default
  if (signal.aborted) return
  const canvas=el('div',{class:'chart','aria-label':'Vínculo partidário documentado'})
  const label=String(person.data.party)
  container.append(canvas,el('p',{},person.title,' · Partido informado pela Câmara · ',label))
  const cy=cyto({container:canvas,boxSelectionEnabled:false,userZoomingEnabled:false,
    elements:[{data:{id:'person',label:person.title}},{data:{id:'party',label}},{data:{id:'edge',source:'person',target:'party'}}],
    style:[{selector:'node',style:{label:'data(label)',color:paint('--ink'),'background-color':paint('--accent'),'font-size':14}},{selector:'edge',style:{width:2,'line-color':paint('--accent')}}],
    layout:{name:'grid',rows:1,padding:45}})
  signal.addEventListener('abort',()=>cy.destroy(),{once:true})
}
