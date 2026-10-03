window.MAP_CONFIG={
  sourceBase:"/Agente-Hidrometeorologico-Cloud",
  urls:{
    levels:"/Agente-Hidrometeorologico-Cloud/data/niveles/Ultimo_Corte/ultimo_resumen.json",
    rainConagua:"/Agente-Hidrometeorologico-Cloud/data/niveles/Lluvia_CONAGUA/ultimo_corte.json",
    climaConagua:"/Agente-Hidrometeorologico-Cloud/data/niveles/Clima_CONAGUA/ultimo_corte.json",
    sihRain:"/Agente-Hidrometeorologico-Cloud/data/sih_lluvia/latest.json",
    weather:"/Agente-Hidrometeorologico-Cloud/data/weatherlink/latest.json",
    weatherExtra:"/Agente-Hidrometeorologico-Cloud/data/weatherlink/extra_latest.json",
    fuente1:"/Agente-Hidrometeorologico-Cloud/data/latest/FUENTE1.txt",
    insivumehRain:"/Agente-Hidrometeorologico-Cloud/data/fuentes_publicas/insivumeh_automaticas.json",
    insivumehLevels:"/Agente-Hidrometeorologico-Cloud/data/fuentes_publicas/insivumeh_alto_hidro.json",
    publicSources:"/Agente-Hidrometeorologico-Cloud/data/fuentes_publicas/latest.json",
    forecastMapping:"data/pronostico-smn-subcuencas.json",
    forecastGeojson:"data/subcuencas-smn.geojson"
  },
  rainThresholds:[
    {min:250,level:4,label:"Extraordinaria",color:"#6a2ca0"},
    {min:150,level:3,label:"Torrencial",color:"#d62828"},
    {min:75,level:2,label:"Intensa",color:"#f28c00"},
    {min:50,level:1,label:"Muy fuerte",color:"#f2d600"},
    {min:0,level:0,label:"Menor a muy fuerte",color:"#9aa0a6"}
  ],
  rainDisplayMinMm:50,
  conaguaSubbasinsService:"https://sigagis.conagua.gob.mx/ArcGIS/rest/services/LocREPDA/MapServer/18/query",
  forecastBasins:{
    "Peñitas":{
      center:[17.444,-93.458],
      anchors:[[17.444,-93.458],[17.330,-93.520]]
    },
    "Malpaso":{
      center:[17.184,-93.600],
      anchors:[[17.184,-93.600],[16.900,-93.700],[16.760,-93.850]]
    },
    "Chicoasén":{
      center:[16.944,-93.096],
      anchors:[[16.944,-93.096],[16.780,-93.120]]
    },
    "La Angostura":{
      center:[16.401,-92.778],
      anchors:[[16.401,-92.778],[16.240,-92.690],[15.980,-92.650]]
    },
    "Bajo Grijalva-Ríos de la Sierra":{
      center:[17.565,-92.948],
      anchors:[[17.565,-92.948],[17.600,-92.820],[17.510,-93.120],[17.380,-92.750],[17.760,-92.600]]
    },
    "Usumacinta":{
      center:[17.430,-91.490],
      anchors:[[17.430,-91.490],[17.470,-91.420],[17.800,-91.530],[16.850,-91.050]]
    },
    "Presa Juan Sabines":{
      center:[16.270,-92.690],
      anchors:[[16.270,-92.690],[16.180,-92.720]]
    }
  },
  // Ubicaciones de referencia para el piloto. Se reemplazarán por coordenadas oficiales.
  stations:{
    "Samaria":[18.05,-93.19],"González":[18.03,-92.99],"Oxolotán":[17.38,-92.75],
    "Tapijulapa":[17.46,-92.78],"Teapa":[17.55,-92.95],"Puyacatengo":[17.55,-92.93],
    "San Joaquín":[17.52,-93.12],"Pueblo Nuevo":[17.80,-92.88],"Gaviotas":[17.98,-92.92],
    "Porvenir":[17.98,-92.91],"Macuspana":[17.76,-92.60],"Salto de Agua":[17.56,-92.33],
    "San Pedro":[17.80,-91.53],"Boca del Cerro":[17.43,-91.49],
    // Puntos de localidad únicamente; NO coordenadas instrumentales de CONAGUA.
    "HUIMANGUILLO (INIFAP)":[17.8292,-93.3917],
    "EMILIANO ZAPATA (CHABLE)":[17.744,-91.765],
    "PEÑITAS":[17.45,-93.46],"PLATANAR":[17.91,-93.24],"SAMARIA":[18.05,-93.19],
    "MACUSPANA":[17.76,-92.60],"SALTO DE AGUA":[17.56,-92.33],"OXOLOTÁN":[17.38,-92.75],
    "TAPIJULAPA":[17.46,-92.78],"TEAPA":[17.55,-92.95],"PUYACATENGO":[17.55,-92.93],
    "SAN JOAQUÍN":[17.52,-93.12],"PUEBLO NUEVO":[17.80,-92.88],"BOCA DEL CERRO":[17.43,-91.49],
    "JUÁREZ PCIVILCHIAPAS":[17.604444,-93.195833], // Referencia: cabecera Juárez; NO coordenada instrumental WeatherLink.
    "AMATÁN PCIVILCHIAPAS":[17.35,-92.82],"PICHUCALCO PCIVILCHIAPAS":[17.51,-93.12],
    "CHAPULTENANGO PCIVILCHIAPAS":[17.33,-93.13],
    "MAYA BERRIOZABAL PCIVILCHIAPAS":[16.800278,-93.272778], // INEGI: cabecera de Berriozábal, sólo referencia de localidad; NO coordenada instrumental WeatherLink."SALTO DE AGUA PCIVILCHIAPAS":[17.56,-92.33],
    "PALENQUE PCIVILCHIAPAS":[17.51,-91.98],"NAISA 1":[16.52,-90.19],
    "LAS CRUCES 2 (PETEN)":[16.65,-90.18],"SAN FRANCISCO":[16.80,-89.94],
    "El Tigre":[16.611410,-90.655150],"El Porvenir":[16.519581,-90.483911],
    "Machaquilá":[16.393860,-89.444400],"San Pedro Mactún":[16.9729,-89.9147],
    "San Agustín Chixoy":[16.069835,-90.425616],"Playa Grande":[15.968061,-90.746611],
    "Playa Grande Met (Ixcan)":[15.968061,-90.746611],"Santa María Cahabón":[15.6056,-89.8125],
    "Panzos PHC Altaverapaz":[15.3974,-89.64397]
  }
};