import fitz
import re
import os
import json

base_dir = r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio BG\Programas de Estudio para la Generación 2025 - 2028\Currículum Fundamental"

files = [f for f in os.listdir(base_dir) if f.startswith("2025_") and f.endswith(".pdf")]
files.sort()

def clean_text(t):
    if not t:
        return ""
    t = t.replace("\xa0", " ").replace("\r\n", " ").replace("\n", " ")
    t = re.sub(r"\s+", " ", t).strip()
    return t

all_uacs = []

SEMESTER_MAP = {
    "primer": 1, "primero": 1, "1er": 1, "1°": 1, "1º": 1,
    "segundo": 2, "2do": 2, "2°": 2, "2º": 2,
    "tercer": 3, "tercero": 3, "3er": 3, "3°": 3, "3º": 3,
    "cuarto": 4, "4to": 4, "4°": 4, "4º": 4,
    "quinto": 5, "5to": 5, "5°": 5, "5º": 5,
    "sexto": 6, "6to": 6, "6°": 6, "6º": 6
}

for filename in files:
    filepath = os.path.join(base_dir, filename)
    doc = fitz.open(filepath)
    print(f"\nProcesando {filename} ({len(doc)} págs)...")

    # Escanear páginas en busca de tablas de asignaturas
    for p_idx in range(len(doc)):
        page = doc[p_idx]
        text = page.get_text()
        
        # Detectar inicio de tabla
        if re.search(r'Tabla\s*\d+\.\s*Propósitos\s+y\s+contenidos', text, re.I) or \
           (re.search(r'Nombre de la asignatura', text, re.I) and re.search(r'Propósitos formativos', text, re.I)):
            
            blocks = page.get_text("blocks")
            # Página siguiente también puede ser parte de la tabla
            next_page = doc[p_idx + 1] if p_idx + 1 < len(doc) else None
            next_blocks = next_page.get_text("blocks") if next_page else []

            # Extraer Metadatos
            combined_text = text + ("\n" + next_page.get_text() if next_page else "")
            
            # Nombre asignatura
            name_m = re.search(r'Nombre de la asignatura\s*([^\n\r]+?)(?:Meta educativa|Primer|Segundo|Tercer|Cuarto|Quinto|Sexto|\d+\s*horas)', combined_text, re.I)
            uac_name = clean_text(name_m.group(1)) if name_m else ""
            
            # Meta educativa
            meta_m = re.search(r'Meta educativa\s*([\s\S]+?)(?:Primer|Segundo|Tercer|Cuarto|Quinto|Sexto|Horas/semana|Propósitos formativos)', combined_text, re.I)
            meta_educativa = clean_text(meta_m.group(1)) if meta_m else ""
            
            # Semestre
            sem = None
            sem_m = re.search(r'(Primer|Segundo|Tercer|Cuarto|Quinto|Sexto)\s+semestre', combined_text, re.I)
            if sem_m:
                sem = SEMESTER_MAP.get(sem_m.group(1).lower())
            
            # Horas semanales
            hours_w = 4
            hw_m = re.search(r'Horas/semana:\s*(\d+)', combined_text, re.I)
            if hw_m:
                hours_w = int(hw_m.group(1))
            total_hours = hours_w * 16 # aproximado oficial (48, 64 o 72)
            if hours_w == 3: total_hours = 48
            elif hours_w == 4: total_hours = 64
            elif hours_w == 5: total_hours = 80
            elif hours_w == 2: total_hours = 32

            # Extraer propósitos y contenidos usando coordenadas
            # En estas tablas oficiales:
            # Columna izquierda (x0 entre 100 y 310) = Propósitos formativos
            # Columna derecha (x0 >= 315) = Contenidos formativos
            
            items_left = []
            items_right = []
            
            for b in blocks:
                if b[1] < 450 and "Tabla" in b[4] and p_idx == 0: continue # saltar encabezado
                bx0, by0, bx1, by1, btext = b[0], b[1], b[2], b[3], b[4].strip()
                if "Propósitos formativos" in btext and "Contenidos" in btext: continue
                if "Nombre de la asignatura" in btext or "Meta educativa" in btext: continue
                if "Fuente: Elaborado" in btext: continue
                if by0 > 740: continue # número de página
                
                if 100 <= bx0 <= 310 and len(btext) > 3:
                    items_left.append((by0, btext))
                elif bx0 >= 315 and len(btext) > 3:
                    items_right.append((by0, btext))
                    
            if next_page:
                for b in next_blocks:
                    bx0, by0, bx1, by1, btext = b[0], b[1], b[2], b[3], b[4].strip()
                    if "Propósitos formativos" in btext and "Contenidos" in btext: continue
                    if "Fuente: Elaborado" in btext: continue
                    if by0 > 740: continue
                    if 100 <= bx0 <= 310 and len(btext) > 3:
                        items_left.append((by0 + 1000, btext))
                    elif bx0 >= 315 and len(btext) > 3:
                        items_right.append((by0 + 1000, btext))

            # Organizar propósitos por número
            # Los bloques de la izquierda suelen empezar con "1 ", "2 ", "3 "
            activities = []
            contenidos_list = []
            
            # Asociar por cercanía vertical o número
            # Procesar items_left
            current_order = 0
            left_grouped = []
            for y, btext in items_left:
                m_num = re.match(r'^(\d{1,2})\s+([A-ZÁÉÍÓÚ].*)', btext, re.DOTALL)
                if m_num:
                    current_order = int(m_num.group(1))
                    left_grouped.append({'order': current_order, 'y': y, 'text': clean_text(m_num.group(2))})
                elif current_order > 0 and left_grouped:
                    left_grouped[-1]['text'] += " " + clean_text(btext)

            # Procesar items_right (contenidos formativos)
            # Emparejar con el left_grouped más cercano verticalmente
            for lg in left_grouped:
                matched_rights = []
                for ry, rtext in items_right:
                    # En la misma página o en la siguiente (dentro de un delta vertical)
                    if abs(ry - lg['y']) < 120 or (lg['y'] < 1000 and ry < 1000 and abs(ry - lg['y']) < 150) or (lg['y'] >= 1000 and ry >= 1000 and abs(ry - lg['y']) < 150):
                        lines = [clean_text(l) for l in rtext.split('\n') if len(clean_text(l)) > 2]
                        matched_rights.extend(lines)
                
                activities.append({
                    'order': lg['order'],
                    'name': lg['text'],
                    'hours': round(total_hours / max(len(left_grouped), 1))
                })
                contenidos_list.append({
                    'order': lg['order'],
                    'proposito': lg['text'],
                    'contenidos': matched_rights if matched_rights else [lg['text']]
                })

            if uac_name and sem and activities:
                all_uacs.append({
                    'uac_name': uac_name,
                    'semester': sem,
                    'component': 'fundamental',
                    'subsystem': 'bge',
                    'total_hours': total_hours,
                    'learning_outcome': meta_educativa,
                    'activities': activities,
                    'contenidos_formativos': contenidos_list,
                    'source_file': filename,
                    'page': p_idx + 1
                })
                print(f"  ✓ {uac_name} (Sem {sem}) - {len(activities)} propósitos extraídos")

print(f"\nTOTAL Asignaturas Fundamentales Extraídas: {len(all_uacs)}")
with open(r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\SIGPDA_EMS\scripts\data\extracted_fundamental_preview.json", "w", encoding="utf-8") as f:
    json.dump(all_uacs, f, ensure_ascii=False, indent=2)
