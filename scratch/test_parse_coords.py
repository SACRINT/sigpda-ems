import fitz
import re

doc = fitz.open(r'c:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio Tecnologicos\Carreras_Tecnicas\vBrm4pCEKV-PROGRAMACION.pdf')

current_modulo = None
current_submod = None
submod_data = {}

for page_no in range(len(doc)):
    page = doc[page_no]
    text = page.get_text("text")
    
    # Detectar nuevo Módulo
    m_mod = re.search(r'MÓDULO\s+([IVXLCDM]+)\s*[\n\r]*(.*?)(?:RESULTADO DE APRENDIZAJE|$)', text, re.IGNORECASE | re.DOTALL)
    if "proceso para la formación" in text.lower() or "proceso de formación" in text.lower():
        # Ver si hay cambio de módulo
        mod_match = re.search(r'MÓDULO\s+([IVXLCDM]+)', text, re.IGNORECASE)
        if mod_match:
            current_modulo = mod_match.group(0).upper()
            
        blocks = page.get_text("blocks")
        # Filtrar bloques de la tabla de competencias
        # Actividades Clave: x0 entre 60 y 130
        # Desarrollo de la Competencia: x0 entre 140 y 330
        # Submódulo: x0 < 60
        for b in blocks:
            x0, y0, x1, y1, btext = b[0], b[1], b[2], b[3], b[4].strip()
            # Ignorar encabezados de tabla
            if y0 < 150 and page_no != 18: # en pág 19 y0 es más bajo
                continue
            if "PROCESO" in btext or "ACTIVIDAD CLAVE" in btext or "RECURSOS" in btext or "HABILIDADES" in btext:
                continue
                
            clean_text = btext.replace('\n', ' ')
            
            # Submódulo tag (S1, S2, S3, etc.)
            if x0 < 65 and re.match(r'^S[0-9]+', clean_text):
                current_submod = clean_text[:2]
                key = f"{current_modulo} - {current_submod}"
                if key not in submod_data:
                    submod_data[key] = {"actividades_clave": [], "desarrollo": []}
            
            # Si tenemos submódulo activo
            if current_submod and f"{current_modulo} - {current_submod}" in submod_data:
                key = f"{current_modulo} - {current_submod}"
                if 65 <= x0 < 135 and len(clean_text) > 10:
                    submod_data[key]["actividades_clave"].append(clean_text)
                elif 135 <= x0 < 340 and len(clean_text) > 15:
                    submod_data[key]["desarrollo"].append(clean_text)

print(f"Total Submódulos detectados: {len(submod_data)}")
for k, v in submod_data.items():
    print(f"\n{k}:")
    print(f"  Actividades Clave ({len(v['actividades_clave'])}):")
    for a in v['actividades_clave'][:3]:
        print(f"    • {a[:80]}")
    print(f"  Desarrollo de Competencia ({len(v['desarrollo'])} saberes):")
    for d in v['desarrollo'][:3]:
        print(f"    - {d[:80]}")
