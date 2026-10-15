# Salvador Railway · Atlas del relieve

Visor 3D estático, elaborado el **15 de octubre de 2026** a partir del mapa aportado por Carlos y de la lámina del mismo mapa en Percy F. Martin (1911). No requiere cuentas ni claves API. Preparado para alojarse en GitHub Pages o abrirse localmente.

## Publicar en GitHub Pages

El visor es estático: no necesita compilar ni ejecutar Python en GitHub.

1. En el repositorio, abre **Settings → Pages**.
2. En **Build and deployment**, selecciona **Deploy from a branch**.
3. Elige **main** y **/(root)**; pulsa **Save**.

El archivo `.nojekyll` permite servir directamente los archivos. Las rutas son relativas y admiten la subcarpeta del repositorio. No se activa Pages automáticamente: la publicación la controla el propietario.

## Abrir localmente

Haz doble clic en **INICIAR VISOR.command**. Mantén abierta su ventana de Terminal mientras uses el visor; `Ctrl+C` detiene el servidor. Requiere Python 3 y un navegador con WebGL. El servidor escucha solamente en `127.0.0.1`, sin acceso desde otros equipos. También puedes ejecutar desde esta carpeta:

```sh
python3 scripts/servir_visor.py
```

No abras `index.html` directamente con `file://`: el navegador bloquea las lecturas de datos del modelo. La carpeta completa es el entregable; el HTML necesita sus datos y bibliotecas locales.

## Funciones

- Rotación, inclinación hasta 80°, zoom, navegación táctil y con teclado; vista 2D/3D, restablecer, órbita y pantalla completa.
- Terreno real, tintas de elevación y sombreado precalculado; factor vertical regulable entre 1× y 3×. Los colores no describen vegetación ni ocupación del suelo.
- Tres itinerarios aproximados: Acajutla–San Salvador, Sitio del Niño–Santa Ana y Ateos–La Ceiba.
- Inventario de 18 estaciones leído de los símbolos de la lámina; fichas con fuente y precisión. Las posiciones de edificios históricos no están verificadas.
- 27 ciudades documentadas hacia 1911 y 2 puertos (incluidas las 14 cabeceras), además de 12 referencias naturales y 19 poblaciones modernas opcionales. La capa de agua incluye 981 elementos OSM en el recorte; no son 981 ríos distintos.
- Ríos, lagunas y lagos con geometrías OSM; curvas cada 100 m y curvas maestras cada 500 m, derivadas del DEM.
- Perfil de suelo de cada itinerario, con ubicación del punto sobre el mapa; recorrido de cámara, pausa y reanudación.
- Medición horizontal geodésica entre dos puntos; consulta de coordenadas y suelo bajo el cursor.
- Exportación GeoJSON del itinerario aproximado y captura PNG con fuentes y factor vertical.
- Mapa histórico de mayor resolución, ampliable hasta 300%; se conserva también la imagen adjunta original.
- Capas de satélite Esri y calles OSM, sujetas a conexión y disponibilidad de sus servicios. El núcleo de relieve, agua, rutas y etiquetas está guardado localmente.

## Fuentes y transformación

| Componente | Fuente | Periodo y precisión | Transformación |
|---|---|---|---|
| Mapa histórico | Percy F. Martin, *Salvador of the Twentieth Century*, Londres, Edward Arnold, 1911; lámina frente a p. 198 | Documento de 1911; sin georreferenciación comprobada | Lectura de conectividad y estaciones; original conservado completo |
| Cronología | Martin, cap. XV, pp. 197–198 | Fechas según este autor; requieren cotejo si se utilizan en una investigación histórica independiente | Fichas resumidas; no resuelve discrepancias con otras cronologías |
| Relieve | Mapzen Terrain Tiles en AWS; SRTM/USGS y fuentes del mosaico | Datos modernos, principalmente SRTM circa 2000; consulta 15/10/2026 | Terrarium: `R*256 + G + B/256 - 32768` metros; coordenadas Web Mercator de tesela |
| Modelo visible | Teselas DEM z6–z12, 238 archivos | z12: unos 37 m/píxel en el corredor; fuera del corredor z10: unos 148 m/píxel | Tintas hipsométricas y sombreado; mar a 0 m; exageración inicial 1,5× |
| Perfil y consultas | DEM z12 | Rejilla 1664×1152; muestreo cada dos píxeles, unos 74 m | Redondeo a metros; interpolación bilineal; altura independiente de exageración |
| Curvas | DEM z12 | Rejilla reducida cada cuatro píxeles, unos 148 m | Marching squares cada 100 m; unión de segmentos y simplificación de vértices |
| Vías y agua | © OpenStreetMap contributors, ODbL; Overpass | Snapshot con `timestamp_osm_base` en cada respuesta | GeoJSON; unión de anillos de relaciones para lagos; las trazas modernas se muestran separadas |
| Itinerarios de 1911 | Conectividad de Martin + corredores de OSM | **Todo el trazado histórico es aproximado**, incluso donde sigue OSM | Caminos sobre el grafo, unión de extremos a menos de 180 m e interpolación de huecos; ramal La Ceiba interpretativo |
| Estaciones | Símbolos y nombres de la lámina | Anclajes aproximados de localidades/corredores; no ubicaciones certificadas de edificios | Inventario conservado en `data/estaciones.json`; identificación manual |
| Los Lagartos | Lista pluviométrica de 1959, repositorio CEPAL, estación T11 | 13°45′ N, 89°34′ O; referencia de área, **no identifica la estación ferroviaria** | Anclaje aproximado, declarado como tal en ficha |
| Volcanes | Smithsonian GVP y MARN/SNET | Coordenadas y cotas de catálogo; consulta 15/10/2026 | Fichas con enlace individual; separación entre cota publicada y altura del suelo en el punto |

**Límites materiales:** el DEM no conserva el paisaje de 1911. SRTM se levantó alrededor del año 2000; el mosaico puede mezclar fuentes. No debe afirmarse que reproduce por completo el estado posterior a 2005. Las imágenes modernas pueden tener otra fecha. Izalco y San Salvador cambiaron después del mapa. No se reconstruyen edificios, vegetación histórica, cortes, terraplenes, puentes ni profundidad de cuerpos de agua. El perfil es del suelo moderno bajo la polilínea, no la rasante del ferrocarril. No calcular pendientes operativas ferroviarias con este perfil.

La resolución de visualización y el espaciado de muestras no equivalen a exactitud topográfica. La documentación Mapzen describe SRTM de 30 m con calidad nominal de 90 m y remuestreos. La geometría que finalmente renderiza MapLibre puede ser más generalizada que las teselas de entrada.

**Cobertura:** todo El Salvador dispone de contexto de terreno z10. El corredor occidental y central tiene z12, aproximadamente entre 90,02° O–88,98° O y 13,43° N–14,15° N, extendido a límites de teselas. Las ciudades documentadas de 1911 cubren el país. Las poblaciones modernas, el agua y las vías se concentran en el recorte del corredor. No se afirma que sea un inventario nacional exhaustivo. La lámina original conserva íntegros los topónimos menores que aún no tienen ubicación comprobada. Santa Tecla aparece como población, no se prolonga hasta ella el ramal de La Ceiba.

## Referencias directas

1. [Martin, texto y mapa, Project Gutenberg](https://www.gutenberg.org/files/45102/45102-h/45102-h.htm#Page_197). Archivo histórico local: `evidencia/martin-1911.html`.
2. [Mapa histórico, lámina de mayor resolución](https://www.gutenberg.org/files/45102/45102-h/images/illus-249_full.jpg).
3. [Terrain Tiles, registro AWS](https://registry.opendata.aws/terrain-tiles/).
4. [Mapzen: fuentes y resolución](https://github.com/tilezen/joerd/blob/master/docs/data-sources.md) y [atribución](https://github.com/tilezen/joerd/blob/master/docs/attribution.md). Copias locales en `evidencia/`.
5. [MARN, Geología de El Salvador](https://www.snet.gob.sv/ver/geologia/geologia+de+el+salvador/) y [mapa del complejo volcánico occidental](https://www.snet.gob.sv/Geologia/Vulcanologia/amenazas/MAPAVSA.pdf). Consultados en web; la descarga directa de estas páginas fue rechazada con HTTP 403 y no se conserva copia local.
6. [GVP Santa Ana](https://volcano.si.edu/volcano.cfm?vn=343020), [Izalco](https://volcano.si.edu/volcano.cfm?vn=343030), [San Salvador](https://volcano.si.edu/volcano.cfm?vn=343050), [Coatepeque](https://volcano.si.edu/volcano.cfm?vn=343041). Cotas publicadas: 2.381, 1.950 y 1.893 m para los tres volcanes, respectivamente. MARN publica 1.965 m para Izalco: se conserva la diferencia, no se promedian los valores.
7. [CEPAL, lista de estaciones pluviométricas de 1959](https://repositorio.cepal.org/server/api/core/bitstreams/ae208fbf-b567-465b-8c46-8799d98d6156/content).
8. [OpenStreetMap, licencia y atribución](https://www.openstreetmap.org/copyright). Consultas Overpass originales en `evidencia/osm-*.json`.
9. [MapLibre GL JS, relieve 3D](https://maplibre.org/maplibre-gl-js/docs/examples/3d-terrain/). Se incluye la versión 5.6.2 y su licencia BSD-3-Clause. Glifos Noto Sans del repositorio demotiles (SIL OFL).
10. [Esri World Imagery](https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer), con su atribución; no se descarga el mosaico satelital.

## Archivos y reproducción

- `index.html`, `style.css`, `app.js`: interfaz y comportamiento.
- `data/dem/`: teselas originales; `data/terreno/`: derivado con mar a 0 m; `data/tintas/`: colores hipsométricos; `data/sombreado/`: colores con sombreado precalculado.
- `data/hidrografia-visual.geojson`: derivado para dibujo, simplificado con tolerancia aproximada de 13 m. El GeoJSON original se conserva.
- `data/elevaciones.i16` y `data/relieve.json`: alturas y metadatos de la rejilla. Metros, `int16` little endian, filas norte–sur.
- `data/*.geojson`: rutas, vías OSM, hidrografía y curvas; coordenadas longitud/latitud WGS84, elevaciones en metros.
- `data/estaciones.json`, `data/lugares.json`: inventarios, precisión y fuentes.
- `assets/`: lámina de Martin, adjunto del usuario e icono.
- `evidencia/`: respuestas originales, registro de descargas, documentación y comprobación visual/funcional.
- `scripts/`: preparación y servidor. Los scripts de terreno requieren NumPy y Pillow; el servidor solo necesita la biblioteca estándar de Python. Las consultas originales OSM se conservan; no deben regenerarse sin revisar si han cambiado.

No se modificaron documentos académicos existentes. El proyecto se publica en un repositorio independiente, sin incluir otros documentos del espacio académico.

## Ajuste de rendimiento

Una sola fuente DEM activa; sombreado precalculado en teselas en lugar de una segunda fuente de elevación y un cálculo de sombras en cada cuadro. Dibujo limitado por defecto a 1 píxel por píxel CSS incluso en pantallas Retina; regulable entre 0,75× y 1,5× en Capas. Se desactiva antialiasing multisample y la conservación permanente del buffer de dibujo. Las curvas y las vías OSM se leen solo al solicitarlas. La hidrografía visual se reduce de 2,4 MB a unos 840 KB, conservando el archivo completo. Las lecturas bajo el cursor se limitan a 10 por segundo. Estas medidas reducen carga; la velocidad final depende de WebGL y de la GPU del navegador.

## Corrección de navegación y fronteras (15/10/2026)

Se corrigió un fallo que interrumpía los gestos: el callback de `dragstart`, `zoomstart`, `rotatestart` y `pitchstart` invocaba `map.stop()`. En MapLibre 5.6.2, esta llamada también detiene los handlers de entrada (`handlers.stop(false)`), por lo que se cancelaba el mismo gesto que acababa de empezar. Ahora solo se detienen el recorrido programado y la órbita; se deja continuar la entrada del usuario. El fallo afectaba a la interacción incluso cuando la GPU era capaz de dibujar con fluidez.

Se añadió un contorno terrestre nacional visible por defecto y una capa visible por defecto de los 14 departamentos. Fuente departamental: geoBoundaries gbOpen / Open Street Map, año representado **2021**, compilación de diciembre de 2023, descarga el 15/10/2026; licencia **CC BY-SA 2.0**. El ADM0 descargado de geoBoundaries incluye un tramo marino y se conserva únicamente como evidencia; el contorno visible usa Natural Earth Admin 0 Countries 1:10m, dominio público, descargado el 15/10/2026, con costa y fronteras terrestres generalizadas. Los departamentos sí usan ADM1 geoBoundaries 2021. Estas capas son de referencia moderna y no reconstruyen límites de 1911.

- `data/frontera-nacional.geojson`: geometría terrestre de El Salvador, seleccionada de Natural Earth; fuente y hash en `evidencia/natural-earth-metadata.json`.
- `data/departamentos.geojson`: 14 polígonos con colores suaves opcionales, cargados en la vista inicial.
- `evidencia/fronteras-ADM0-metadata.json` y `evidencia/fronteras-ADM1-metadata.json`: fuente, año, compilación, licencia y URL de descarga.
- [Fuente ADM0](https://www.geoboundaries.org/api/current/gbOpen/SLV/ADM0/) y [fuente ADM1](https://www.geoboundaries.org/api/current/gbOpen/SLV/ADM1/).

La distinción de fechas se mantiene: conectividad ferroviaria interpretada desde Martin (1911), geometrías de corredores OSM modernas, relieve principalmente SRTM circa 2000 y límites de referencia 2021. La consulta del 15/10/2026 no implica que todos los datos describan el territorio de 2026.

Los rótulos distinguen la estación (`Est. Santa Ana`), el volcán (`Volcán de Santa Ana`) y el departamento (`Dpto. Santa Ana`). Se omite la etiqueta de localidad cuando coincide con el nombre de una estación; el inventario completo de localidades se conserva. No se adaptó visualmente el terreno a la lámina antigua, conforme a la aclaración del usuario.


### Ciudades de la época (actualización 15/10/2026)

- `data/ciudades-1911.json`: 27 ciudades documentadas por Martin (1911), incluidas las 14 cabeceras de la p. 247; se añaden los puertos de Acajutla y La Libertad (29 puntos en total). Selección administrativa y documental, no ranking de población.
- Cada registro conserva página, enlace al libro, departamento, nombre empleado, papel de cabecera y GeoNames ID. Páginas regionales: 248, 276, 278, 282, 287, 290, 294, 297, 300, 306, 310, 311, 313; San Vicente se documenta en la tabla de la p. 247.
- Nueva San Salvador traduce `New San Salvador` de la tabla; el propio libro también usa Santa Tecla. Opico, Gotera y Santa Rosa conservan las formas documentadas, con la equivalencia moderna explicada en sus fichas. Se normaliza la errata Ahauchapán según la p. 247.
- Georreferencia moderna de localidad: GeoNames, https://download.geonames.org/export/dump/SV.zip, CC BY 4.0; consulta 15/10/2026; copia fuente `evidencia/geonames-SV.zip`. Los homónimos se resolvieron con identificadores y departamento. No se usan población ni elevación de GeoNames. Los puntos no reconstruyen las áreas urbanizadas de 1911.
- Regeneración: `python3 scripts/preparar_ciudades_1911.py`. Se añade filtro «Ciudades 1911» y capa independiente, activada inicialmente. Las poblaciones modernas permanecen disponibles en «Actuales» y su capa inicia apagada. Las estaciones conservan sus puntos y fichas; cuando coinciden los nombres, se omite el rótulo de estación mientras está activa la ciudad para evitar duplicación visual.
- `data/etiquetas-departamentos.geojson` contiene un punto por departamento, calculado como centroide del polígono principal. Evita que el nombre se repita al recortar polígonos en teselas. Se regenera con `scripts/preparar_fronteras.py`.


## Licencias de terceros

Los datos y bibliotecas conservan sus licencias propias. La publicación del código no modifica estas condiciones.

- MapLibre GL JS: BSD-3-Clause (`vendor/LICENSE-maplibre.txt`).
- Glifos Noto Sans: SIL Open Font License (`vendor/LICENSE-Noto-Sans.txt`).
- OpenStreetMap: ODbL, atribución a sus colaboradores; respuestas fuente en `evidencia/`.
- Departamentos geoBoundaries/OSM: CC BY-SA 2.0 según metadatos incluidos.
- Natural Earth: dominio público; contorno terrestre generalizado 1:10m.
- GeoNames: CC BY 4.0; georreferencia moderna de las ciudades documentadas.
- Terrain Tiles: atribuciones por fuente en `evidencia/terrain-attribution.md` y documentación enlazada.
- Martin (1911): edición digital de Project Gutenberg, con su aviso de procedencia conservado.
- Esri World Imagery: servicio externo con sus propias condiciones; no se redistribuyen sus teselas.
