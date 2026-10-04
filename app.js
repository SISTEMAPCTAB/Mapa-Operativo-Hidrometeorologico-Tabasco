(()=>{"use strict";
const C=window.MAP_CONFIG;
const LEVEL_COLORS=["green","yellow","orange","red"], LEVEL_LABELS=["Verde","Amarillo","Naranja","Rojo"];
const map=L.map("map",{zoomControl:true}).setView([17.70,-92.65],8);
// Exposición mínima para la capa Tonalá; los cálculos existentes no se modifican.
window.TONALA_MAP=map;
window.dispatchEvent(new Event("tonala-map-ready"));
const base=L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18,attribution:"&copy; OpenStreetMap contributors",crossOrigin:true}).addTo(map);
base.on("tileerror",()=>{const s=document.getElementById("statusText");if(s)s.textContent="Mapa cargado, pero algunas teselas de OpenStreetMap no respondieron; reintentando…";});
map.createPane("forecastPane");
map.getPane("forecastPane").style.zIndex=450;
map.getPane("forecastPane").style.pointerEvents="auto";
const levelLayer=L.layerGroup().addTo(map),rainLayer=L.layerGroup().addTo(map),upstreamLayer=L.layerGroup().addTo(map),forecastLayer=L.layerGroup().addTo(map);
// Retención de eventos de lluvia relevante (no suma acumulados móviles).
// Ciclo operativo local: 08:00 de un día a 08:00 del siguiente.
// Memoria persistida por navegador; la fuente oficial siempre conserva prioridad.
const RAIN_MEMORY_KEY="mapa-lluvia-relevante-08-v1";
let rainMemory={cycle:"",items:{}};
function cycle08(value){
 const date=value?new Date(value):new Date();
 if(!Number.isFinite(date.getTime()))return null;
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Mexico_City",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",hourCycle:"h23"}).formatToParts(date);
 const v=k=>Number(parts.find(p=>p.type===k)?.value||0);
 let key=v("year")+"-"+String(v("month")).padStart(2,"0")+"-"+String(v("day")).padStart(2,"0");
 if(v("hour")<8){
   const d=new Date(Date.UTC(v("year"),v("month")-1,v("day")-1));
   key=d.toISOString().slice(0,10);
 }
 return key;
}
function restoreRainMemory(){
 const current=cycle08();
 try{
   const saved=JSON.parse(localStorage.getItem(RAIN_MEMORY_KEY)||"null");
   if(saved?.cycle===current&&saved.items&&typeof saved.items==="object")rainMemory=saved;
   else rainMemory={cycle:current,items:{}};
 }catch{rainMemory={cycle:current,items:{}}}
}
function relevantRainInCycle(rains){
 const cycle=cycle08();
 if(rainMemory.cycle!==cycle)rainMemory={cycle,items:{}};
 const live=new Set();
 for(const r of rains){
   if(!/CONAGUA/.test(r.source||"")||!finite(r.mm)||Number(r.mm)<50)continue;
   const sampleCycle=cycle08(r.time);
   // No utilizar boletines de ciclos anteriores ni informes con fecha futura.
   if(sampleCycle!==cycle)continue;
   const id=norm(r.source.includes("reporte horario")?"reporte:"+r.name:"boletin:"+r.name);
   live.add(id);
   const saved=rainMemory.items[id];
   if(!saved||Number(r.mm)>saved.mm)rainMemory.items[id]={...r,cycle,retained:false};
   else if(saved)rainMemory.items[id]={...saved,retained:Number(r.mm)<saved.mm,latestMm:Number(r.mm),latestTime:r.time};
 }
 try{localStorage.setItem(RAIN_MEMORY_KEY,JSON.stringify(rainMemory))}catch{}
 // No borrar un evento al descender en otro informe del mismo ciclo.
 const retained=Object.entries(rainMemory.items).filter(([id,r])=>r.cycle===cycle&&!live.has(id)||r.cycle===cycle&&r.retained)
   .map(([id,r])=>({...r,retained:true,period:"máximo 24 h reportado en ciclo 08:00–08:00",latestMm:r.latestMm}));
 const selected=rains.filter(r=>{
   if(!/CONAGUA/.test(r.source||"")||!finite(r.mm)||r.mm<50)return true;
   return cycle08(r.time)===cycle&&!rainMemory.items[norm(r.source.includes("reporte horario")?"reporte:"+r.name:"boletin:"+r.name)]?.retained;
 });
 return [...selected,...retained];
}
restoreRainMemory();
let latestForecastData=null;




const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim();
const finite=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v));
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const fmt=(v,n=2)=>finite(v)?Number(v).toFixed(n):"s/d";
const fetchJSON=async u=>{try{const r=await fetch(u+"?v="+Date.now(),{cache:"no-store"});return r.ok?await r.json():null}catch{return null}};
const fetchText=async u=>{try{const r=await fetch(u+"?v="+Date.now(),{cache:"no-store"});return r.ok?await r.text():""}catch{return ""}};
function coord(name){const hit=Object.entries(C.stations).find(([k])=>norm(k)===norm(name));return hit?hit[1]:null}
function rainCoord(r){
 const lat=Number(r?.latitude),lon=Number(r?.longitude);
 if(Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-90&&lat<=90&&lon>=-180&&lon<=180)return[lat,lon];
 return coord(r?.name);
}

function rainClass(mm){
  if(!finite(mm))return{level:-1,label:"Sin dato",color:"#888"};
  const x=Number(mm);
  return C.rainThresholds.find(r=>x>=r.min)||C.rainThresholds.at(-1);
}
function levelDot(level){
  const c=level<0?"gray":LEVEL_COLORS[Math.min(3,level)];
  return L.divIcon({className:"",html:`<div class="level-triangle s-${c}"></div>`,iconSize:[24,22],iconAnchor:[12,11]});
}
function rainDot(k){
  return L.divIcon({className:"",html:`<div class="rain-dot" style="background:${k.color}"></div>`,iconSize:[20,20],iconAnchor:[10,15]});
}
function forecastColor(min,max){
  const v=finite(max)?Number(max):finite(min)?Number(min):0;
  if(v>250)return "#6a2ca0";
  if(v>=150)return "#d62828";
  if(v>=75)return "#f28c00";
  if(v>=50)return "#f2d600";
  return "#61c9a8";
}
function forecastLabel(min,max){
  if(!finite(min)&&!finite(max))return "s/d";
  if(finite(min)&&finite(max))return `${Number(min).toFixed(0)}–${Number(max).toFixed(0)} mm`;
  return finite(min)?`≥${Number(min).toFixed(0)} mm`:`≤${Number(max).toFixed(0)} mm`;
}
let forecastMapping=null;
let forecastGeojson=null;
let forecastRenderSeq=0;

function zoneFeatures(name){
  const fs=forecastGeojson?.features||[];
  return fs.filter(ft=>Array.isArray(ft?.properties?.zonas_smn)&&ft.properties.zonas_smn.includes(name));
}

function geojsonZoneLayer(name,color){
  const fs=zoneFeatures(name);
  if(!fs.length)return null;
  return L.geoJSON({type:"FeatureCollection",features:fs},{
    pane:"forecastPane",
    style:{
      color,
      weight:1.8,
      fillColor:color,
      fillOpacity:.18,
      opacity:.90
    }
  });
}

function forecastIssueMeta(doc){
 const raw=String(doc?.fecha||"").trim(),time=String(doc?.emision||"").trim();
 const months={enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,setiembre:9,octubre:10,noviembre:11,diciembre:12};
 const match=raw.toLowerCase().match(/(\d{1,2})\s+de\s+([a-záéíóú]+)\s+del?\s+(\d{4})/i);
 let key="";
 if(match&&months[match[2]])key=match[3]+"-"+String(months[match[2]]).padStart(2,"0")+"-"+match[1].padStart(2,"0");
 const local=new Intl.DateTimeFormat("en-US",{timeZone:"America/Mexico_City",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
 const part=t=>local.find(x=>x.type===t)?.value||"";
 const today=part("year")+"-"+part("month")+"-"+part("day");
 const state=key?(key===today?"ACTUALIZADO HOY":key<today?"DATO ANTERIOR":"FECHA FUTURA · VERIFICAR"):"FECHA NO VERIFICADA";
 const label="SMN · Aviso "+(doc?.aviso||"s/d")+" · Emisión: "+(raw||"sin fecha")+(time?" · "+time:"")+" · "+state;
 return{label,state,url:doc?.url||"https://smn.conagua.gob.mx/es/pronosticos/pronosticossubmenu/pronostico-meteorologico-especial-cuencas-96h"};
}
async function renderForecast(){
  const seq=++forecastRenderSeq;
  forecastLayer.clearLayers();
  let rendered=0;
  const win=document.getElementById("forecastWindow")?.value||"off";
  const box=document.getElementById("forecastSummary");
  if(win==="off"||!latestForecastData){if(box)box.innerHTML="";return}

  const src=latestForecastData?.smn96?.ventanas?.[win]||{};
  const issue=forecastIssueMeta(latestForecastData?.smn96);
  const summary=[];

  for(const [name,val] of Object.entries(src)){
    if(seq!==forecastRenderSeq)return;
    const cfg=C.forecastBasins?.[name];
    if(!cfg)continue;
    const min=Number(val?.min_mm),max=Number(val?.max_mm);
    if(!Number.isFinite(max)||max<50)continue;

    const color=forecastColor(min,max);
    const layer=geojsonZoneLayer(name,color);

    if(layer){
      const codes=[...new Set((zoneFeatures(name)).map(ft=>ft?.properties?.SUBCUE).filter(Boolean))];
      const names=[...new Set((zoneFeatures(name)).map(ft=>ft?.properties?.SUBCUENCA).filter(Boolean))];
      layer.bindPopup(`<div class="popup-title">${esc(name)} · SMN</div><div class="popup-grid">
        <b>Ventana</b><span>${esc(win)} h</span>
        <b>Pronóstico</b><span>${forecastLabel(min,max)}</span>
        <b>Subcuencas RH30</b><span>${esc(codes.join(", ")||"s/d")}</span>
        <b>Cuencas</b><span>${esc(names.join(", ")||"s/d")}</span>
        <b>Fuente cartográfica</b><span>INEGI Red Hidrográfica 1:50 000, edición 2.0</span>
        <b>Emisión</b><span>${esc(issue.label)}</span>
        <b>Nota</b><span>Agrupación operativa aproximada de subcuencas oficiales para representar la zona SMN; no es una delimitación oficial publicada por SMN.</span>
      </div>`);
      layer.bindTooltip(`${esc(name)} · ${forecastLabel(min,max)}`,{
        sticky:true,direction:"top",className:"forecast-tooltip",opacity:.96
      });
      layer.addTo(forecastLayer);
      rendered++;
      summary.push({name,min,max,color,detail:codes.length+" subcuenca(s)"});
    }else{
      const marker=L.marker(cfg.center,{
        title:name,
        icon:L.divIcon({className:"",html:`<div class="forecast-diamond" style="background:${color}"></div>`,iconSize:[20,20],iconAnchor:[10,10]})
      }).bindPopup(`<div class="popup-title">${esc(name)} · SMN</div><div class="popup-grid">
        <b>Ventana</b><span>${esc(win)} h</span>
        <b>Pronóstico</b><span>${forecastLabel(min,max)}</span>
        <b>Cartografía</b><span>GeoJSON local de subcuencas aún no disponible; se conserva el punto operativo.</span>
      </div>`);
      marker.addTo(forecastLayer);
      rendered++;
      summary.push({name,min,max,color,detail:"punto operativo"});
    }
  }

  if(box){
    const header=`<div class="forecast-summary-title">Pronóstico SMN · ${esc(win)} h</div><div class="forecast-issue"><b>${esc(issue.label)}</b> · <a href="${esc(issue.url)}" target="_blank" rel="noopener noreferrer">Fuente oficial ↗</a></div>`;
    box.innerHTML=summary.length
      ? header+
        summary.map(x=>`<div class="forecast-summary-row"><span class="forecast-swatch" style="background:${x.color}"></span><span><b>${esc(x.name)}</b> · ${forecastLabel(x.min,x.max)} <small>· ${esc(x.detail)}</small></span></div>`).join("")
      : header+`<div class="forecast-summary-empty">Sin rangos ≥50 mm en esta ventana.</div>`;
  }

  const s=document.getElementById("statusText");
  if(s&&win!=="off"){
    const base=s.textContent.replace(/ · Pronóstico:.*$/,"");
    s.textContent=base+" · Pronóstico: "+rendered+" zona(s) operativa(s)";
  }
}

function parseOfficial(txt){
 const out=new Map(),lines=String(txt||"").split(/\n/);
 const rx=/^(Samaria|Gonzalez|Oxolotan|Tapijulapa|Teapa|Puyacatengo|San Joaquin|Pueblo Nuevo|Gaviotas|El Muelle|Porvenir|Macuspana|Salto de Agua|San Pedro|Boca del Cerro)\s+.+?\s+(-?\d+(?:\.\d+)?)\s+(?:\d+(?:\.\d+)?\s+)?(?:\d+(?:\.\d+)?\s+)?(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)$/i;
 for(const raw of lines){const m=raw.trim().match(rx);if(m)out.set(norm(m[1]),{critical:+m[3],overflow:+m[4],minimum:+m[5]})}
 return out;
}
function levelSeverity(r,off){
 let sev=0,reasons=[];
 if(off&&finite(r.ultimo_nivel)){
   const n=+r.ultimo_nivel;
   if(finite(off.overflow)&&n>=off.overflow){sev=3;reasons.push("nivel ≥ desbordamiento")}
   else if(finite(off.critical)&&n>=off.critical){sev=Math.max(sev,2);reasons.push("nivel ≥ crítico")}
   else if(finite(off.critical)&&(off.critical-n)<=0.50){sev=Math.max(sev,1);reasons.push("a ≤0.50 m del crítico")}
 }
 const d24=finite(r.delta_24h)?+r.delta_24h:0,dre=finite(r.delta_reporte)?+r.delta_reporte:0;
 if(d24>=1||dre>=0.30){sev=Math.min(3,sev+1);reasons.push("ascenso rápido")}
 else if(d24>=0.50||dre>=0.15){sev=Math.max(sev,1);reasons.push("ascenso relevante")}
 if(/ascenso/i.test(r.tendencia||"")&&sev===0){sev=1;reasons.push("tendencia ascendente")}
 return{level:sev,reasons};
}
function combined(levelSev,rainSev){
 const rLevel=rainSev?.level??-1;
 let x=Math.max(levelSev.level,Math.min(3,rLevel)),reasons=[...levelSev.reasons];
 if(rainSev&&rainSev.level>=1)reasons.push("lluvia "+rainSev.label.toLowerCase()+" en la misma estación");
 if(levelSev.level>=1&&rLevel>=2)x=Math.min(3,Math.max(x,levelSev.level+1));
 return{level:x,reasons};
}
function namoDistanceText(value){
 if(!finite(value))return "s/d";
 const n=Number(value);
 if(Math.abs(n)<0.005)return "En NAMO (0.00 m)";
 return n<0?"Faltan "+fmt(-n)+" m para NAMO":"Supera NAMO por "+fmt(n)+" m";
}
function levelObservedText(r){
 const ts=r.ultima_actualizacion_real||r.fecha_hora;
 if(!ts)return "s/d";
 const d=new Date(ts);
 const shown=Number.isNaN(d.getTime())?String(ts):d.toLocaleString("es-MX",{timeZone:"America/Mexico_City",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false});
 return shown+(r.estado_dato==="heredado"?" · último dato válido conservado":"");
}
// La fuente agrupa San Joaquín como «Ríos de la Sierra», pero su río específico es Pichucalco.
function riverForStation(r){return norm(r?.estacion)==="san joaquin"?"Río Pichucalco":r?.rio||"s/d";}
function popupLevel(r,off,sev,rain){
 return `<div class="popup-title">${esc(r.estacion)}</div><div class="popup-grid">
 <b>Río</b><span>${esc(riverForStation(r))}</span><b>Nivel</b><span>${fmt(r.ultimo_nivel)} m</span>
 <b>Lectura real</b><span>${esc(levelObservedText(r))}</span>
 <b>Tendencia</b><span>${esc(r.tendencia||"s/d")}</span>
 <b>Δ reporte anterior</b><span>${fmt(r.delta_reporte)} m · desde la lectura válida previa</span>
 <b>Δ24 h</b><span>${fmt(r.delta_24h)} m · respecto de 24 h atrás</span>
 <b>Diferencia al NAMO</b><span><strong>${esc(namoDistanceText(r.distancia_namo))}</strong></span>
 <b>Crítico</b><span>${off?fmt(off.critical)+" m":"s/d"}</span>
 <b>Desbordamiento</b><span>${off?fmt(off.overflow)+" m":"s/d"}</span><b>Lluvia en estación</b><span>${rain?fmt(rain.mm,1)+" mm · "+esc(rain.source)+" · "+esc(rain.period):"s/d"}</span>
 <b>Alerta operativa</b><span><strong>${sev.level<0?"Sin dato":LEVEL_LABELS[sev.level]}</strong></span>
 <b>Razón</b><span>${esc(sev.reasons.join(" · ")||"seguimiento ordinario")}</span></div>`;
}
function popupRain(r,k){
 return `<div class="popup-title">${esc(r.name)}</div><div class="popup-grid"><b>Fuente</b><span>${esc(r.source)}</span>
 <b>Acumulado</b><span>${fmt(r.mm,1)} mm</span><b>Periodo</b><span>${esc(r.period)}${r.retained?" · Registro conservado del ciclo":""}</span>
 <b>Categoría</b><span>${esc(k.label)}</span><b>Hora</b><span>${esc(r.time||"s/d")}</span>${/^(huimanguillo \(inifap\)|emiliano zapata \(chable\))$/.test(norm(r.name))?`<b>Ubicación</b><span>Punto representativo de la localidad, NO coordenada instrumental CONAGUA.</span>`:""}${norm(r.name)==="maya berriozabal pcivilchiapas"?`<b>Ubicación</b><span>Cabecera de Berriozábal, Chiapas (referencia INEGI; coordenadas instrumentales de WeatherLink aún no verificadas).</span>`:""}${norm(r.name)==="juarez pcivilchiapas"?`<b>Ubicación</b><span>Cabecera de Juárez, Chiapas (punto referencial; coordenadas instrumentales pendientes de validar).</span><b>Calidad 24 h</b><span>Mínimo observado; consultar hora de la última lectura.</span>`:""}</div>`;
}
function stationRainForLevel(r,rains){
  const key=norm(r.estacion);
  const matches=rains.filter(rr=>norm(rr.name)===key&&finite(rr.mm));
  if(!matches.length)return null;
  // Si hay más de una fuente para la misma estación, usar el dato más reciente
  // y conservar la fuente y el periodo para que el usuario sepa qué representa.
  const best=matches.sort((a,b)=>{
    const ta=Date.parse(a.time||"")||0,tb=Date.parse(b.time||"")||0;
    return tb-ta;
  })[0];
  return {...best,...rainClass(best.mm),relation:"misma estación"};
}
function isChiapasOrGuatemala(r){
 const t=norm((r.name||"")+" "+(r.source||"")+" "+(r.location||""));
 return /chiapas|guatemala|peten|insivumeh/.test(t);
}
function insLevelRows(doc){
 return (doc?.estaciones||[]).filter(x=>x.estado_dato==="observado"&&finite(x.nivel_instantaneo_m)).map(x=>({
   type:"INSIVUMEH nivel",name:x.estacion,river:x.rio||null,status:"Monitoreo",detail:`${fmt(x.nivel_instantaneo_m,2)} m · Máximo de referencia estadística: ${fmt(x.nivel_referencia_max_m,2)} m${finite(x.nivel_referencia_max_m)?` · Diferencia: ${Number(x.nivel_instantaneo_m)>=Number(x.nivel_referencia_max_m)?"+":""}${fmt(Number(x.nivel_instantaneo_m)-Number(x.nivel_referencia_max_m),2)} m`:""} · ${esc(x.rio||"río s/d")} · ${esc(x.ubicacion||"Guatemala")} · No equivale a NAMO ni a umbral de inundación`,priority:1
 }));
}
function insRainRows(doc){
 return (doc?.estaciones||[]).filter(x=>finite(x.precipitacion_24h_mm)).map(x=>{
   const k=rainClass(x.precipitacion_24h_mm);
   return {type:"INSIVUMEH lluvia",name:x.estacion,status:k.level>=1?k.label:"Monitoreo",detail:`${fmt(x.precipitacion_24h_mm,1)} mm / 24 h · Guatemala`,priority:k.level>=1?2:1};
 });
}

async function load(){
 document.getElementById("statusText").textContent="Actualizando…";
 const [levels,rainCon,climaCon,sihRain,weather,extra,f1,insRain,insLevels,publicSources,mapping,geojson]=await Promise.all([
   fetchJSON(C.urls.levels),fetchJSON(C.urls.rainConagua),fetchJSON(C.urls.climaConagua),fetchJSON(C.urls.sihRain),fetchJSON(C.urls.weather),fetchJSON(C.urls.weatherExtra),
   fetchText(C.urls.fuente1),fetchJSON(C.urls.insivumehRain),fetchJSON(C.urls.insivumehLevels),fetchJSON(C.urls.publicSources),fetchJSON(C.urls.forecastMapping),fetchJSON(C.urls.forecastGeojson)
 ]);
 // No borrar precipitaciones previamente dibujadas ante un fallo transitorio
 // del archivo primario del Agente: la capa se mantiene hasta la próxima consulta válida.
 if(!Array.isArray(rainCon)){
   document.getElementById("statusText").textContent="Lluvia CONAGUA: fuente temporalmente no disponible; se conserva la última visualización válida. Reintento automático cada 15 minutos.";
   return;
 }
 latestForecastData=publicSources;
 forecastMapping=mapping;
 forecastGeojson=geojson;
 const off=parseOfficial(f1),rains=[],seenConagua=new Set();
 // Mantener exactamente el periodo del resumen del Agente: 24 h precedentes,
 // NO la columna "hoy desde 08:00" (que se reinicia a cero cada mañana).
 for(const r of Array.isArray(rainCon)?rainCon:[]){
   if(r.estado_24h!=="observado"||!finite(r.lluvia_24h_precedentes_mm)||Number(r.lluvia_24h_precedentes_mm)<0)continue;
   // La lectura Peñitas >150 mm o advertida se excluye igual que en el Agente.
   if(norm(r.estacion)==="penitas"&&(Number(r.lluvia_24h_precedentes_mm)>150||r.advertencia))continue;
   const key=norm(r.estacion);seenConagua.add(key);
   rains.push({name:r.estacion,source:"CONAGUA · reporte horario",mm:+r.lluvia_24h_precedentes_mm,time:r.fecha_hora,period:"24 h precedentes",location:"Tabasco/Chiapas"});
 }
 // Complemento de boletín OCFS/CONAGUA Tabasco, sin duplicar el reporte horario.
 const boletin=Array.isArray(climaCon?.conagua_tabasco)?climaCon.conagua_tabasco:[];
 const latestBulletin=boletin.map(r=>Date.parse(r.fecha_hora_mensaje||"")).filter(Number.isFinite).reduce((a,b)=>Math.max(a,b),0);
 for(const r of boletin){
   if(r.estado_dato!=="observado"||!finite(r.lluvia_24h_mm)||Number(r.lluvia_24h_mm)<0)continue;
   if(Date.parse(r.fecha_hora_mensaje||"")!==latestBulletin||seenConagua.has(norm(r.estacion)))continue;
   rains.push({name:r.estacion,source:"CONAGUA Tabasco · boletín",mm:+r.lluvia_24h_mm,time:r.fecha_hora_mensaje,period:"24 h del boletín",location:"Tabasco"});
 }
 // SIH independiente: sólo estaciones no representadas por CONAGUA actual.
 const occupied=new Set(rains.filter(x=>/CONAGUA/.test(x.source)).map(x=>norm(x.name).replace(/\s*\([^)]*\)/g,"")));
 for(const r of sihRain?.estaciones_tabasco||[]){
   const mm=Number(r.precipitacion_24h_mm);
   if(!Number.isFinite(mm)||mm<0)continue;
   const name=String(r.estacion||"").replace(/,\s*Tab\..*$/i,"").trim();
   const key=norm(name);
   if(!name||occupied.has(key))continue;
   rains.push({name,source:"SIH-CONAGUA",mm,time:sihRain.fecha_fuente,period:sihRain.periodo_fuente||"24 h · fecha SIH",location:"Tabasco"});
   occupied.add(key);
 }
 for(const r of [...(weather?.stations||[]),...(extra?.stations||[])]){
   const mm=r.accumulations_mm?.["24"];
   if(finite(mm))rains.push({name:r.nombre,source:"WeatherLink",mm:+mm,time:r.observed_utc,period:"24 h",location:r.ubicacion||"",latitude:r.latitude,longitude:r.longitude});
 }
 for(const r of insRain?.estaciones||[]){
   if(finite(r.precipitacion_24h_mm))rains.push({name:r.estacion,source:"INSIVUMEH",mm:+r.precipitacion_24h_mm,time:insRain.consultado_utc,period:"24 h",location:"Guatemala"});
 }
 const displayedRains=relevantRainInCycle(rains);

 levelLayer.clearLayers();rainLayer.clearLayers();upstreamLayer.clearLayers();forecastLayer.clearLayers();
 const alerts=[];let maxRain=null,maxLevel=-1,maxCombined=-1,shownRain=0,missingRainGeo=0;const levelCounts=[0,0,0,0];
 for(const rr of displayedRains){
   const k=rainClass(rr.mm);
   if(k.level>=1 && (!maxRain||k.level>maxRain.level))maxRain=k;
   if(k.level<1)continue; // sólo muy fuertes o superiores
   const p=rainCoord(rr);
   if(p){
     const marker=L.marker(p,{icon:rainDot(k),title:rr.name}).bindPopup(popupRain(rr,k));
     if(isChiapasOrGuatemala(rr))marker.addTo(upstreamLayer);else marker.addTo(rainLayer);
     shownRain++;
   }else{
     missingRainGeo++;
   }
   alerts.push({type:"Lluvia",name:rr.name,status:k.label,detail:`${fmt(rr.mm,1)} mm · ${rr.source} · ${rr.period}${rr.retained?" · REGISTRO CONSERVADO; no es lectura actual":""}`,priority:3+k.level});
 }
 for(const r of Array.isArray(levels)?levels:[]){
   const p=coord(r.estacion);if(!p)continue;
   const ls=levelSeverity(r,off.get(norm(r.estacion))),near=stationRainForLevel(r,rains),cs=combined(ls,near);
   maxLevel=Math.max(maxLevel,ls.level);maxCombined=Math.max(maxCombined,cs.level);
   if(ls.level>=0&&ls.level<levelCounts.length)levelCounts[ls.level]++;
   L.marker(p,{icon:levelDot(cs.level),title:r.estacion}).bindPopup(popupLevel(r,off.get(norm(r.estacion)),cs,near)).addTo(levelLayer);
   if(cs.level>=1)alerts.push({type:"Río",name:r.estacion,river:riverForStation(r),status:LEVEL_LABELS[cs.level],detail:"Nivel "+fmt(r.ultimo_nivel)+" m · NAMO: "+namoDistanceText(r.distancia_namo)+" · "+(cs.reasons.join(" · ")||"seguimiento"),priority:5+cs.level});
 }

 // Niveles INSIVUMEH observados: visibles en la capa Aguas arriba.
 // La ubicación es referencial cuando la fuente sólo publica municipio/localidad.
 const usedGt={};
 for(const r of insLevels?.estaciones||[]){
   if(r.estado_dato!=="observado"||!finite(r.nivel_instantaneo_m))continue;
   let p=coord(r.estacion);
   if(!p)continue;
   const key=p.join(",");
   const n=usedGt[key]||0; usedGt[key]=n+1;
   if(n>0)p=[p[0]+0.015*n,p[1]+0.012*n];
   const maxRef=finite(r.nivel_referencia_max_m)?Number(r.nivel_referencia_max_m):null;
   const current=Number(r.nivel_instantaneo_m);
   let sev=0,reason="nivel observado INSIVUMEH";
   if(maxRef!==null){
     const ratio=current/maxRef;
     if(ratio>=1){sev=2;reason="sobre referencia máxima estadística"}
     else if(ratio>=0.90){sev=1;reason="cerca de referencia máxima estadística"}
   }
   const html=`<div class="popup-title">${esc(r.estacion)} · INSIVUMEH</div><div class="popup-grid">
     <b>Río</b><span>${esc(r.rio||"s/d")}</span>
     <b>Ubicación</b><span>${esc(r.ubicacion||"Guatemala")}</span>
     <b>Nivel</b><span>${fmt(r.nivel_instantaneo_m,2)} m</span>
     <b>Referencia</b><span>Máximo estadístico; no es NAMO ni umbral de inundación</span>
     <b>Referencia máx.</b><span>${maxRef===null?"s/d":fmt(maxRef,2)+" m"}</span>
     <b>Caudal</b><span>${finite(r.caudal_instantaneo_m3s)?fmt(r.caudal_instantaneo_m3s,2)+" m³/s":"s/d"}</span>
     <b>Dato</b><span>${esc(r.ultima_observacion_fuente||"s/d")}</span>
     <b>Nota</b><span>Ubicación geográfica referencial; la referencia máxima no equivale a umbral de inundación.</span>
   </div>`;
   L.marker(p,{icon:levelDot(sev),title:r.estacion+" · INSIVUMEH"}).bindPopup(html).addTo(upstreamLayer);
 }
 // Guatemala: conservar en el cuadro inferior todas las estaciones INSIVUMEH que sí reportan lluvia o nivel.
 alerts.push(...insRainRows(insRain),...insLevelRows(insLevels));

 const levelText=x=>x<0?"Sin dato":LEVEL_LABELS[x];
 document.getElementById("rainAlert").textContent=maxRain?"Precipitación relevante":"Sin lluvia ≥50 mm";
 document.getElementById("levelAlert").textContent=levelText(maxLevel);
 document.getElementById("combinedAlert").textContent=levelText(maxCombined);
 document.getElementById("rainDetail").textContent=shownRain+" puntos ≥50 mm en mapa"+(missingRainGeo?" · "+missingRainGeo+" sin georreferencia":"");
 document.getElementById("levelDetail").textContent=maxLevel>=0?levelCounts[maxLevel]+" estación(es) en "+LEVEL_LABELS[maxLevel].toLowerCase()+" · "+(Array.isArray(levels)?levels.length:0)+" estaciones reportadas":"Sin condición evaluable · "+(Array.isArray(levels)?levels.length:0)+" estaciones reportadas";
 document.getElementById("combinedDetail").textContent="Nivel + tendencia + lluvia ≥50 mm";

 // Orden de lectura: misma secuencia de sistemas que el Agente de Monitoreo.
 // Dentro de cada sistema: lluvia asociada y después nivel del río.
 // SEMAR Alvarado es una referencia costera del Papaloapan, NO del Tonalá.
 const rainFirst=a=>/lluvia/i.test(a.type||"")?0:1;
 function systemRank(a){
   const n=norm(a.name),type=norm(a.type);
   if(/alvarado/.test(n))return 5; // SEMAR Alvarado: Papaloapan, fuera de Tonalá.
   if(/el porvenir|el tigre/.test(n))return 4; // INSIVUMEH, alto Usumacinta.
   if(/tonala|san jose del carmen|agua dulce|aguadulcita|tancochapa|zanapa/.test(n))return 0;
   if(/samaria|gonzalez|carrizal|mezcalapa|platanar|penitas|ostuacan|juarez pcivilchiapas|impulsora|paso la mina|modesta|malpaso/.test(n))return 1;
   if(/oxolotan|tapijulapa|teapa|puyacatengo|san joaquin|pueblo nuevo|gaviotas|el muelle|porvenir$|amatan|pichucalco|ixhuatan|chapultenango|acala|berriozabal|cipat|reforma pcivilchiapas|san cayetano|villahermosa/.test(n))return 2;
   if(/tulija|puxcatan|chilapa|salto de agua|macuspana|palenque|sinai/.test(n))return 3;
   if(/usumacinta|boca del cerro|san pedro|el tigre|el porvenir|panzos|playa grande|cahabon|peten|chixoy|coban|machaquila|urrutia|yaxha|chil[oó]n|emiliano zapata/.test(n))return 4;
   if(/huimanguillo|inifap/.test(n))return 0;
   // INSIVUMEH se coloca en Usumacinta salvo estaciones identificadas arriba.
   if(type.includes("insivumeh"))return 4;
   return 5; // Referencias externas/sin adscripción validada, sin asociarlas a otra cuenca.
 }
 // En Usumacinta se respeta el tránsito: Guatemala/afluentes aguas arriba,
 // aportación Lacantún, después estaciones de Tabasco. Sin inferir lecturas.
 function usumacintaOrder(a){
   const n=norm(a.name),river=norm(a.river||""),type=norm(a.type||"");
   if(/boca del cerro/.test(n))return 30;
   if(/^san pedro$/.test(n))return 31;
   if(/lacantun/.test(n+" "+river))return 20;
   if(type.includes("insivumeh")||/el tigre|el porvenir|panzos|playa grande|cahabon|peten|chixoy|machaquila|urrutia|yaxha/.test(n))return rainFirst(a)?11:10;
   return 21;
 }
 alerts.sort((a,b)=>{
   const sa=systemRank(a),sb=systemRank(b);
   return sa-sb||(sa===4?usumacintaOrder(a)-usumacintaOrder(b):rainFirst(a)-rainFirst(b))||
     (b.priority||0)-(a.priority||0)||String(a.name).localeCompare(String(b.name),"es");
 });
 const seen=new Set(),filtered=alerts.filter(a=>{const k=[a.type,a.name,a.detail].join("|");if(seen.has(k))return false;seen.add(k);return true});
 document.getElementById("alertsTable").innerHTML=filtered.length?
 `<table><thead><tr><th>Tipo</th><th>Estación</th><th>Condición</th><th>Dato relevante</th></tr></thead><tbody>${filtered.map(a=>`<tr><td>${esc(a.type)}</td><td><b>${esc(a.name)}</b>${a.river?`<br><small class="muted">Río: ${esc(a.river)}</small>`:""}</td><td>${esc(a.status)}</td><td>${esc(a.detail)}</td></tr>`).join("")}</tbody></table>`:
 "<p>Sin datos relevantes con los criterios actuales.</p>";
 document.getElementById("statusText").textContent="Datos consultados del Agente Hidrometeorológico · "+new Date().toLocaleString("es-MX");
 await renderForecast();
 }
document.getElementById("refreshBtn").addEventListener("click",load);
document.getElementById("showLevels").addEventListener("change",e=>e.target.checked?levelLayer.addTo(map):map.removeLayer(levelLayer));
document.getElementById("showRain").addEventListener("change",e=>e.target.checked?rainLayer.addTo(map):map.removeLayer(rainLayer));
document.getElementById("showUpstream").addEventListener("change",e=>e.target.checked?upstreamLayer.addTo(map):map.removeLayer(upstreamLayer));
document.getElementById("forecastWindow").addEventListener("change",()=>{renderForecast();});
setTimeout(()=>map.invalidateSize(true),250);window.addEventListener("resize",()=>map.invalidateSize(false));
load();setInterval(load,15*60*1000);
})();