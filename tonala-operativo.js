(()=>{
"use strict";
// Solo presentación cartográfica: consume datos publicados por el Agente, sin modificarlo.
const BASE="/Agente-Hidrometeorologico-Cloud/data/";
const URLS={levels:BASE+"coatzacoalcos_tonala/latest.json",rain:BASE+"niveles/Lluvia_CONAGUA/ultimo_corte.json",weather:BASE+"weatherlink/latest.json"};
const STATIONS=[
 {name:"Impulsora",at:[18.0054,-93.58133],place:"Ingenio Presidente Benito Juárez · ubicación de localidad"},
 {name:"PASO LA MINA",at:[18.0090,-93.58133],place:"Ingenio Presidente Benito Juárez · punto indicativo desplazado para distinguir estaciones"},
 {name:"Modesta_1",at:[18.06778,-93.56139],place:"Poblado C-21 · ubicación de localidad"}
];
// CitrusMax no tiene ubicación instrumental verificada y su última observación está atrasada: no se inventa marcador.
const LOCATIONS={
 "san-jose-del-carmen":{at:[17.86948,-94.08515],name:"San José del Carmen",note:"Ubicación indicativa de localidad; coordenada instrumental pendiente"},
 "agua-dulce":{at:[18.139,-94.145],name:"Agua Dulce",note:"Ubicación indicativa de localidad; coordenada instrumental pendiente"}
};
const BRIDGE=[18.096,-94.113]; // Referencia general del corredor Puente Tonalá; coordenada instrumental pendiente.
const $=id=>document.getElementById(id);
const finite=x=>x!==null&&x!==undefined&&x!==""&&Number.isFinite(Number(x));
const fmt=(v,d=2)=>finite(v)?Number(v).toFixed(d):"s/d";
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const date=x=>{let t=Date.parse(x||"");return Number.isFinite(t)?new Date(t).toLocaleString("es-MX",{timeZone:"America/Mexico_City",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false}):"s/d"};
const localDay=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Mexico_City",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const fresh=x=>{const t=Date.parse(x||"");return Number.isFinite(t)&&t<=Date.now()+300000&&Date.now()-t<=3*3600000};
const colors={1:"#f2d600",2:"#f28c00",3:"#d62828",4:"#6a2ca0"};
function rainClass(v){
 if(!finite(v))return null;
 const x=Number(v);
 return x>=250?{n:4,label:"Extraordinaria"}:x>=150?{n:3,label:"Torrencial"}:x>=75?{n:2,label:"Intensa"}:x>=50?{n:1,label:"Muy fuerte"}:null;
}
const levelIcon=n=>L.divIcon({className:"",html:'<div class="level-triangle s-'+["gray","green","yellow","orange","red"][n+1]+'"></div>',iconSize:[24,22],iconAnchor:[12,11]});
const dropIcon=n=>L.divIcon({className:"",html:'<div class="rain-dot" style="background:'+colors[n]+'"></div>',iconSize:[20,20],iconAnchor:[10,15]});
const referenceIcon=()=>L.divIcon({className:"",html:'<div style="background:#fff;border:2px solid #79858a;border-radius:50%;width:22px;height:22px;font-size:8px;line-height:18px;text-align:center;font-weight:800;color:#53616b">WL</div>',iconSize:[22,22],iconAnchor:[11,11]});
async function get(u){try{const r=await fetch(u+"?v="+Date.now(),{cache:"no-store"});return r.ok?await r.json():null}catch{return null}}
let snapshot=null,levelLayer=null,rainLayer=null,run=0;
function ensureLayers(){
 const map=window.TONALA_MAP;
 if(!map||!window.L)return false;
 if(!levelLayer)levelLayer=L.layerGroup();
 if(!rainLayer)rainLayer=L.layerGroup();
 return true;
}
function draw(){
 if(!ensureLayers()||!snapshot)return;
 const map=window.TONALA_MAP;
 levelLayer.clearLayers();rainLayer.clearLayers();
 for(const row of snapshot.levels){
  const info=LOCATIONS[row.id];if(!info||!finite(row.current_m))continue;
  const validity=snapshot.current,actual=Number(row.current_m),namo=Number(row.namo_m),delta=Number(row.delta_m);
  let severity=0,reason="Seguimiento ordinario";
  if(validity&&finite(row.namo_m)){
   if(actual>=namo){severity=3;reason="Igual o superior al NAMO"}
   else if(namo-actual<=.30){severity=2;reason="A 30 cm o menos del NAMO"}
   else if(namo-actual<=.50){severity=1;reason="A 50 cm o menos del NAMO"}
   if(finite(row.delta_m)&&delta>=.30){severity=Math.max(2,severity);reason+="; ascenso ≥30 cm entre escalas"}
   else if(finite(row.delta_m)&&delta>=.15){severity=Math.max(1,severity);reason+="; ascenso ≥15 cm entre escalas"}
  }
  const icon=levelIcon(validity?severity:-1);
  L.marker(info.at,{icon,title:row.name+" · nivel"})
   .bindPopup('<div class="popup-title">'+esc(row.name)+' · '+esc(row.river)+'</div><div class="popup-grid"><b>Nivel</b><span>'+fmt(row.current_m)+' m</span><b>Escala anterior</b><span>'+fmt(row.previous_m)+' m</span><b>Δ informe</b><span>'+((delta>0)?"+":"")+fmt(row.delta_m)+' m</span><b>NAMO</b><span>'+fmt(row.namo_m)+' m</span><b>Distancia NAMO</b><span>'+fmt(row.below_namo_m)+' m abajo</span><b>Emisión oficial</b><span>'+esc(snapshot.date||"s/d")+'</span><b>Estado</b><span>'+esc(validity?reason:"Dato anterior; no genera alerta actual")+'</span></div><p>'+esc(info.note)+'</p>')
   .addTo(levelLayer);
 }
 const bridge=snapshot.bridge;
 if(bridge){
  const valid=fresh(bridge.fecha_hora)&&bridge.estado_24h==="observado";
  const classification=valid?rainClass(bridge.lluvia_24h_precedentes_mm):null;
  if(classification)L.marker(BRIDGE,{icon:dropIcon(classification.n),title:"Puente Tonalá · lluvia"})
   .bindPopup('<div class="popup-title">Puente Tonalá · CONAGUA</div><div class="popup-grid"><b>Lluvia 24 h</b><span>'+fmt(bridge.lluvia_24h_precedentes_mm,1)+' mm</span><b>Fecha y hora</b><span>'+date(bridge.fecha_hora)+'</span><b>Categoría</b><span>'+esc(classification.label)+'</span></div><p>Ubicación indicativa del corredor; no coordenada instrumental.</p>')
   .addTo(rainLayer);
 }
 for(const info of STATIONS){
  const w=snapshot.weather.find(x=>x.nombre===info.name);if(!w)continue;
  const valid=fresh(w.observed_utc),a=w.accumulations_mm||{},classification=valid?rainClass(a["24"]):null;
  // Igual que el resto del mapa: sólo gota de lluvia con dato reciente (≤3 h) y ≥50 mm en 24 h.
  // Sin dato reciente o bajo el umbral no se dibuja marcador (antes: círculo blanco "WL").
  if(!classification)continue;
  const icon=dropIcon(classification.n);
  const hint=classification?classification.label:valid?"Estación de consulta · lluvia inferior a 50 mm":"Dato anterior";
  L.marker(info.at,{icon,title:info.name+" · WeatherLink"})
   .bindPopup('<div class="popup-title">'+esc(info.name)+' · WeatherLink</div><div class="popup-grid"><b>Localidad</b><span>'+esc(w.ubicacion||"s/d")+'</span><b>1 h</b><span>'+ (valid?fmt(a["1"],1)+" mm":"s/d")+'</span><b>6 h</b><span>'+(valid?fmt(a["6"],1)+" mm":"s/d")+'</span><b>24 h</b><span>'+(valid?(w.accumulation_status?.["24"]==="minimo_observado"?"≥ ":"")+fmt(a["24"],1)+" mm":"s/d")+'</span><b>Observación</b><span>'+date(w.observed_utc)+'</span><b>Estado</b><span>'+esc(hint)+'</span></div><p>'+esc(info.place)+'. Referencia regional, adscripción a la cuenca Tonalá no confirmada. No modifica el semáforo del río.</p>')
   .addTo(rainLayer);
 }
 if($("showLevels")?.checked){if(!map.hasLayer(levelLayer))levelLayer.addTo(map)}else if(map.hasLayer(levelLayer))map.removeLayer(levelLayer);
 if($("showRain")?.checked){if(!map.hasLayer(rainLayer))rainLayer.addTo(map)}else if(map.hasLayer(rainLayer))map.removeLayer(rainLayer);
}
async function update(){
 const id=++run;const [data,rain,weather]=await Promise.all([get(URLS.levels),get(URLS.rain),get(URLS.weather)]);if(id!==run)return;
 const mat=data?.reports?.matutino||{},bridge=(Array.isArray(rain)?rain:[]).filter(x=>/puente tonal[aá]/i.test(x.estacion||"")).sort((a,b)=>Date.parse(b.fecha_hora||"")-Date.parse(a.fecha_hora||""))[0]||null;
 snapshot={levels:mat.stations||[],date:mat.date,current:mat.date===localDay(),bridge,weather:weather?.stations||[]};
 draw();
 // El estado global y los demás módulos permanecen independientes.
}
document.addEventListener("DOMContentLoaded",()=>{
 $("showLevels")?.addEventListener("change",draw);
 $("showRain")?.addEventListener("change",draw);
 $("refreshBtn")?.addEventListener("click",update);
 window.addEventListener("tonala-map-ready",draw);
 update();setInterval(update,15*60*1000);
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)update()});
});
})();