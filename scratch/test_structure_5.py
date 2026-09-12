import fitz, re, os

folder = r'c:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio Tecnologicos\Carreras_Tecnicas'

test_files = [
    'kxj10vEiX8-ADMINISTRACION_DE_RECURSOS_HUMANOS.pdf',
    'MoJhirfOov-AGROINDUSTRIAS1.pdf',
    'Nku1TCJEni-ELECTRONICA.pdf',
    'hsmlSzEiqc-LOGISTICA.pdf',
    'MrtE54UFON-MECATRONICA.pdf'
]

for tf in test_files:
    path = os.path.join(folder, tf)
    doc = fitz.open(path)
    print(f'=== Testing {tf} ({len(doc)} pages) ===')
    info_gen_pages = []
    proceso_pages = []
    for i, page in enumerate(doc):
        t = page.get_text('text')
        if 'información general' in t.lower() or 'informacion general' in t.lower():
            if '// submódulo' in t.lower() or '// submodulo' in t.lower() or 'submódulo 1' in t.lower():
                info_gen_pages.append(i+1)
        if 'proceso para la formación' in t.lower() or 'proceso para la formacion' in t.lower():
            proceso_pages.append(i+1)
    print(f'  Info General pages: {info_gen_pages}')
    print(f'  Proceso table pages: {len(proceso_pages)} pages: {proceso_pages[:4]}...')
