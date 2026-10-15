"""Ciudades documentadas por Martin (1911), con puntos de referencia modernos.

No reconstruye manchas urbanas ni convierte población actual en población histórica.
El identificador GeoNames se fija tras revisar homónimos y departamento.
"""
from pathlib import Path
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]
BOOK = 'https://www.gutenberg.org/files/45102/45102-h/45102-h.htm'
# Nombre español usado en la fuente; departamento; página; GeoNames; cabecera.
INVENTORY = '''San Salvador|San Salvador|248|3583361|1
Tonacatepeque|San Salvador|248|3582918|0
Chalatenango|Chalatenango|276|3587091|1
Cojutepeque|Cuscatlán|278|3586977|1
Suchitoto|Cuscatlán|278|3583090|0
Sensuntepeque|Cabañas|282|3583158|1
Ilobasco|Cabañas|282|3585487|0
Nueva San Salvador (Santa Tecla)|La Libertad|247,287|3584257|1
Opico|La Libertad|287|3583531|0
Sonsonate|Sonsonate|290|3583102|1
Izalco|Sonsonate|290|3585473|0
Ahuachapán|Ahuachapán|247,294|3587426|1
Atiquizaya|Ahuachapán|294|3587317|0
Santa Ana|Santa Ana|297|3583334|1
Chalchuapa|Santa Ana|297|3587086|0
Metapán|Santa Ana|297|3584384|0
San Vicente|San Vicente|247|3583178|1
Zacatecoluca|La Paz|300|3582805|1
San Miguel|San Miguel|306|3583446|1
Chinameca|San Miguel|306|3587037|0
Gotera|Morazán|310|3583747|1
La Unión|La Unión|311|3584772|1
San Alejo|La Unión|311|3583905|0
Santa Rosa|La Unión|311|3583214|0
Usulután|Usulután|313|3582883|1
Jucuapa|Usulután|313|3585398|0
Alegría|Usulután|313|3587412|0
Acajutla|Sonsonate|290,291|3587498|0
La Libertad|La Libertad|287|3585157|0'''
rows = {r[0]: r for r in (line.split('\t') for line in
        zipfile.ZipFile(ROOT/'evidencia/geonames-SV.zip').read('SV.txt').decode().splitlines())}
result = []
for line in INVENTORY.splitlines():
    name, department, pages, gid, capital = line.split('|')
    row = rows[gid]
    port = name in ['Acajutla', 'La Libertad']
    role = ('Capital de la República' if name == 'San Salvador' else
            'Cabecera departamental' if capital == '1' else
            'Puerto documentado' if port else 'Ciudad documentada')
    text = (f'{role} de la época, documentada en Percy F. Martin (1911), '
            f"{'pp.' if ',' in pages else 'p.'} {pages.replace(',', ' y ')}. "
            f'Departamento: {department}. ')
    if name == 'Nueva San Salvador (Santa Tecla)':
        text += 'Martin emplea New San Salvador en la tabla de cabeceras y Santa Tecla en el capítulo regional. '
    if name == 'Opico':
        text += 'Corresponde a San Juan Opico en la georreferencia moderna. '
    if name == 'Gotera':
        text += 'Se conserva el nombre Gotera usado por Martin; la referencia moderna es San Francisco Gotera. '
    if name == 'Santa Rosa':
        text += 'Corresponde a Santa Rosa de Lima; se conserva la forma abreviada usada por Martin. '
    if name == 'Ahuachapán':
        text += 'Se normaliza la errata Ahauchapán de la lista de la p. 294 según la tabla de la p. 247. '
    text += 'El punto ubica la localidad; no representa su extensión urbana ni sus edificios en 1911.'
    result.append(dict(id='ciudad-1911-'+gid, name=name, type='historic-city',
        kind=role+' · 1911', capital=capital == '1', department=department,
        coordinates=[float(row[5]), float(row[4])], description=text,
        precision=f'Punto moderno de referencia GeoNames {gid} (CC BY 4.0), consulta 15/10/2026. No es una coordenada levantada en 1911.',
        source=f'P. F. Martin (1911), pp. {pages.replace(",", ", ")}',
        sourceUrl=BOOK+'#Page_'+pages.split(',')[0], sourcePages=pages,
        geoSourceUrl='https://www.geonames.org/'+gid+'/', modernName=row[1],
        period='1911', selection='Cabeceras y ciudades enumeradas por Martin; dos puertos vinculados al corredor.'))
assert len(result) == 29 and sum(p['capital'] for p in result) == 14
(ROOT/'data/ciudades-1911.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
print('27 ciudades documentadas y 2 puertos; 14 cabeceras. Sin cifras demográficas actuales.')
