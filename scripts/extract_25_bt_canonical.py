import fitz
import re
import os
import json

BASE_PDF_DIR = r'c:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio Tecnologicos\Carreras_Tecnicas'
OUTPUT_JSON = r'c:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\SIGPDA_EMS\scripts\data\bt_canonical_25.json'

PDF_CATALOG = [
    {"id": "admin_rrhh", "name": "Administración de Recursos Humanos", "file": "kxj10vEiX8-ADMINISTRACION_DE_RECURSOS_HUMANOS.pdf"},
    {"id": "admin_emprend", "name": "Administración Emprendimientos", "file": "wRWXf97tJK-ADMINISTRACION_EMPRENDIMIENTOS1.pdf"},
    {"id": "agroindustrias", "name": "Agroindustrias", "file": "MoJhirfOov-AGROINDUSTRIAS1.pdf"},
    {"id": "agropecuario", "name": "Agropecuario", "file": "S1lS7SXACa-AGROPECUARIO.pdf"},
    {"id": "biotecnologia", "name": "Biotecnología", "file": "N1vprB317D-BIOTECNOLOGIA 25.pdf"},
    {"id": "ciberseguridad", "name": "Ciberseguridad", "file": "lJmOA2k5Pp-Ciberseguridad_presencial.pdf"},
    {"id": "contabilidad", "name": "Contabilidad", "file": "BaicwgARuD-CONTABILIDAD1.pdf"},
    {"id": "diseno_grafico", "name": "Diseño Gráfico Digital", "file": "Ty9Yi5FMH1-DISEÑO_GRAFIC_ DIGITAL.pdf"},
    {"id": "electronica", "name": "Electrónica", "file": "Nku1TCJEni-ELECTRONICA.pdf"},
    {"id": "fuentes_alternas", "name": "Fuentes Alternas de Energía", "file": "cj3S1XjVhH-FUENTES_ALTERNAS_DE_ENERGIA1.pdf"},
    {"id": "instrumentacion", "name": "Instrumentación Industrial", "file": "r0VheQmaQQ-Instrumentación industrial 26.pdf"},
    {"id": "inteligencia_art", "name": "Inteligencia Artificial", "file": "UlWagZywil-INTELIGENCIA_ARTIFICIAL1.pdf"},
    {"id": "logistica", "name": "Logística", "file": "hsmlSzEiqc-LOGISTICA.pdf"},
    {"id": "mantenimiento_ind", "name": "Mantenimiento Industrial", "file": "dNVsD9nRpj-MANTENIMIENTO_INDUSTRIAL1.pdf"},
    {"id": "mecanica_naval", "name": "Mecánica Naval", "file": "AFC96xRiSd-MECANICA_NAVAL1.pdf"},
    {"id": "mecatronica", "name": "Mecatrónica", "file": "MrtE54UFON-MECATRONICA.pdf"},
    {"id": "ofimatica", "name": "Ofimática", "file": "uY1dEeOTNC-OFIMATICA 25.pdf"},
    {"id": "alimentos_bebidas", "name": "Preparación de Alimentos y Bebidas", "file": "peuZVvfxTL-PREPARACION_DE_ALIMENTOS_Y_BEBIDAS.pdf"},
    {"id": "programacion", "name": "Programación", "file": "vBrm4pCEKV-PROGRAMACION.pdf"},
    {"id": "recreaciones_acuat", "name": "Recreaciones y Servicios Acuáticos", "file": "q0Rjp0PTAh-RECREACIONES_SERVICIOS_ACUATICOS.pdf"},
    {"id": "recursos_hidricos", "name": "Recursos Hídricos", "file": "zXnAkQJnFT-RECURSOS_HIDRICOS 25.pdf"},
    {"id": "refrigeracion", "name": "Refrigeración y Aire Acondicionado", "file": "2hiQqTowjp-REFRIGERACION y aire acondicionado 23.pdf"},
    {"id": "salud_integral", "name": "Salud Integral y Estilos de Vida", "file": "VASuod1aGy-SALUD INTEGRAL Y ESTILOS DE VIDA SALUDABLES.pdf"},
    {"id": "hospedaje", "name": "Servicios de Hospedaje", "file": "g7RFZAPe8j-SERVICIOS_DE_HOSPEDAJE1.pdf"},
    {"id": "soporte_ti", "name": "Soporte y Gestión de TI", "file": "lDS0Kk57jR-SOPORTE_Y_GESTION_DE_TECNOLOGIAS_INFORMATICAS.pdf"}
]

ROMAN_TO_SEMESTER = {
    "I": 2,
    "II": 3,
    "III": 4,
    "IV": 5,
    "V": 6
}

MODULE_STANDARD_HOURS = {
    "I": 272,
    "II": 272,
    "III": 272,
    "IV": 192,
    "V": 192
}

def clean_text(text):
    if not text:
        return ""
    # Remove hyphenation at line breaks (e.g. es- tado -> estado, servi- cios -> servicios)
    text = re.sub(r'(\b\w+)-\s+(\w+\b)', r'\1\2', text)
    # Normalize whitespace
    return " ".join(text.split()).strip()

def extract_career_data(career_info):
    pdf_path = os.path.join(BASE_PDF_DIR, career_info["file"])
    doc = fitz.open(pdf_path)
    
    career_result = {
        "id": career_info["id"],
        "name": career_info["name"],
        "file": career_info["file"],
        "total_pages": len(doc),
        "modules": []
    }
    
    # 1. First pass: Find where the appendix begins
    appendix_page = len(doc)
    for p_no in range(40, len(doc)):
        txt = doc[p_no].get_text("text").lower()
        if "lineamientos metodológicos para la elaboración de estrategias" in txt:
            appendix_page = p_no
            break
            
    # 2. Extract Module outcomes (RESULTADO DE APRENDIZAJE)
    module_outcomes = {}
    for p_no in range(min(appendix_page + 5, len(doc))):
        p_text = doc[p_no].get_text("text")
        if "RESULTADO DE APRENDIZAJE" in p_text.upper():
            mod_m = re.search(r'M[OÓ]DULO\s+([IVX]+)', p_text, re.IGNORECASE)
            if not mod_m and p_no > 0:
                mod_m = re.search(r'M[OÓ]DULO\s+([IVX]+)', doc[p_no - 1].get_text("text"), re.IGNORECASE)
            if mod_m:
                mod_roman = mod_m.group(1).upper()
                # Extract the bullet points or paragraph following RESULTADO DE APRENDIZAJE
                lines = p_text.split('\n')
                outcome_lines = []
                capturing = False
                for line in lines:
                    l_clean = clean_text(line)
                    if "RESULTADO DE APRENDIZAJE" in l_clean.upper():
                        capturing = True
                        continue
                    if capturing:
                        if "PROCESO PARA LA FORMACIÓN" in l_clean.upper() or "SUBMÓDULO" in l_clean.upper():
                            break
                        if l_clean:
                            outcome_lines.append(l_clean)
                if outcome_lines and mod_roman not in module_outcomes:
                    module_outcomes[mod_roman] = " ".join(outcome_lines)
                    
    # 3. Extract Submodules & Hours from Module Information Pages (before appendix)
    module_submodules_meta = {
        "I": [], "II": [], "III": [], "IV": [], "V": []
    }
    module_titles = {}
    
    for p_no in range(min(appendix_page, len(doc))):
        page = doc[p_no]
        text = page.get_text("text")
        
        # Check if this page defines submodules
        if "//" in text and ("SUBMÓDULO" in text.upper() or "SUBMODULO" in text.upper()):
            mod_m = re.search(r'M[OÓ]DULO\s+([IVX]+)', text, re.IGNORECASE)
            if mod_m:
                mod_roman = mod_m.group(1).upper()
                if mod_roman in module_submodules_meta and not module_submodules_meta[mod_roman]:
                    # Find module title
                    # Look for lines in uppercase with 272 horas or 192 horas
                    blocks = page.get_text("blocks")
                    for b in blocks:
                        b_txt = clean_text(b[4])
                        if ("272" in b_txt or "192" in b_txt) and "MÓDULO" in b_txt.upper():
                            # Usually title is above horas
                            lines = [clean_text(l) for l in b[4].split('\n') if clean_text(l)]
                            for l in lines:
                                if l.isupper() and len(l) > 10 and not any(k in l for k in ["SCIAN", "SINCO", "HORAS", "MÓDULO", "ACUERDO"]):
                                    module_titles[mod_roman] = l
                                    break
                                    
                    # Extract submodules from blocks
                    # Check each block for // SUBMÓDULO (\d+)
                    for b_idx, b in enumerate(blocks):
                        b_txt = clean_text(b[4])
                        sub_m = re.search(r'//\s*SUBM[OÓ]DULO\s*(\d+)\s*[:\-\.]*\s*(.*?)(?=\s*(?:Horas\s*\d+|\d+\s*horas|$))', b_txt, re.IGNORECASE)
                        if sub_m:
                            s_num = int(sub_m.group(1))
                            s_name = clean_text(sub_m.group(2))
                            s_hrs = None
                            
                            # If s_name is empty or too short, look at next block
                            if (not s_name or len(s_name) < 4) and b_idx + 1 < len(blocks):
                                next_txt = clean_text(blocks[b_idx + 1][4])
                                hrs_next = re.search(r'(?:Horas\s*(\d+)|\b(\d+)\s*horas)', next_txt, re.IGNORECASE)
                                if hrs_next:
                                    s_hrs = int(hrs_next.group(1) or hrs_next.group(2))
                                s_name = re.sub(r'(?:Horas\s*\d+|\b\d+\s*horas)', '', next_txt).strip()
                            else:
                                hrs_m = re.search(r'(?:Horas\s*(\d+)|\b(\d+)\s*horas)', b_txt, re.IGNORECASE)
                                if hrs_m:
                                    s_hrs = int(hrs_m.group(1) or hrs_m.group(2))
                                elif b_idx + 1 < len(blocks):
                                    next_b_txt = clean_text(blocks[b_idx + 1][4])
                                    hrs_next = re.search(r'(?:Horas\s*(\d+)|\b(\d+)\s*horas)', next_b_txt, re.IGNORECASE)
                                    if hrs_next:
                                        s_hrs = int(hrs_next.group(1) or hrs_next.group(2))
                            
                            # Check if already added
                            if not any(s["num"] == s_num for s in module_submodules_meta[mod_roman]):
                                module_submodules_meta[mod_roman].append({
                                    "num": s_num,
                                    "name": s_name,
                                    "hours": s_hrs
                                })
                                
                    # If regex within blocks missed some because hours were on a separate block, parse text directly
                    if len(module_submodules_meta[mod_roman]) == 0:
                        matches = re.findall(r'//\s*SUBM[OÓ]DULO\s*(\d+)\s*[:\-\.]*\s*(.*?)\s*(?:Horas\s*(\d+)|(\d+)\s*horas)', text, re.IGNORECASE | re.DOTALL)
                        for m in matches:
                            s_num = int(m[0])
                            s_name = clean_text(m[1])
                            hrs_val = int(m[2]) if m[2] else int(m[3])
                            if not any(s["num"] == s_num for s in module_submodules_meta[mod_roman]):
                                module_submodules_meta[mod_roman].append({
                                    "num": s_num,
                                    "name": s_name,
                                    "hours": hrs_val
                                })

    # Official typo fix: 126 -> 128 in Agroindustrias Mod V
    if career_info["id"] == "agroindustrias":
        for s in module_submodules_meta.get("V", []):
            if s["hours"] == 126:
                s["hours"] = 128

    # Official fix: Logística Mod I: Sub 1 is 160h, Sub 2 is 112h (160 + 112 = 272h)
    if career_info["id"] == "logistica":
        for s in module_submodules_meta.get("I", []):
            if s["num"] == 1:
                s["hours"] = 160
            elif s["num"] == 2:
                s["hours"] = 112

    # Calculate missing hours if any (e.g. Logística Sub 1 or Agropecuario Mod II)
    for mod_roman, sub_list in module_submodules_meta.items():
        std_tot = MODULE_STANDARD_HOURS[mod_roman]
        missing = [s for s in sub_list if s["hours"] is None or s["hours"] == 0]
        known = sum(s["hours"] for s in sub_list if s["hours"])
        if len(missing) == 1 and known < std_tot:
            missing[0]["hours"] = std_tot - known
        elif known != std_tot and len(sub_list) > 0 and known > 0:
            # Adjust rounding or small 2-hour layout drift
            diff = std_tot - known
            if abs(diff) <= 4:
                sub_list[-1]["hours"] += diff


    # 4. Extract Actividades Clave & Saberes from Table (PROCESO PARA LA FORMACIÓN EN COMPETENCIAS)
    table_data = {
        "I": {}, "II": {}, "III": {}, "IV": {}, "V": {}
    }
    
    current_table_mod = None
    current_table_sub = None
    
    for p_no in range(min(appendix_page, len(doc))):
        page = doc[p_no]
        text = page.get_text("text")
        
        if "proceso para la formación" in text.lower() or "proceso de formación" in text.lower():
            mod_m = re.search(r'M[OÓ]DULO\s+([IVX]+)', text, re.IGNORECASE)
            if mod_m:
                new_m = mod_m.group(1).upper()
                if new_m in table_data:
                    if new_m != current_table_mod:
                        current_table_mod = new_m
                        current_table_sub = None
                        
            if not current_table_mod:
                continue
                
            is_first_page_of_module = "RESULTADO DE APRENDIZAJE" in text.upper()
            y_min_content = 320 if is_first_page_of_module else 290
            
            blocks = page.get_text("blocks")
            for b in blocks:
                x0, y0, x1, y1, btext = b[0], b[1], b[2], b[3], b[4].strip()
                if y0 < y_min_content or y0 > 550 or not btext:
                    continue
                clean = clean_text(btext)
                
                # Check for Submódulo switch: e.g. S1, S2, S3
                sm_match = re.match(r'^S(\d+)(?:\s+(.*))?', clean)
                if (x0 < 75 or x0 < 60) and sm_match:
                    current_table_sub = int(sm_match.group(1))
                    if current_table_sub not in table_data[current_table_mod]:
                        table_data[current_table_mod][current_table_sub] = []
                    # If there is trailing activity text after S1
                    remainder = clean_text(sm_match.group(2))
                    if remainder and len(remainder) > 8:
                        if not any(a["actividad"] == remainder for a in table_data[current_table_mod][current_table_sub]):
                            table_data[current_table_mod][current_table_sub].append({
                                "actividad": remainder,
                                "saberes": []
                            })
                    continue
                    
                if current_table_sub is not None:
                    if current_table_sub not in table_data[current_table_mod]:
                        table_data[current_table_mod][current_table_sub] = []
                        
                    sub_activities = table_data[current_table_mod][current_table_sub]
                    
                    w = x1 - x0
                    # Column 2: Actividad Clave (x0 < 140 and w <= 95)
                    if x0 < 140 and w <= 95 and len(clean) > 5:
                        # Skip pure numbers or isolated noise
                        if not re.match(r'^\d+$', clean) and not clean.startswith('S'):
                            if not any(a["actividad"] == clean for a in sub_activities):
                                sub_activities.append({
                                    "actividad": clean,
                                    "saberes": []
                                })
                                
                    # Column 3: Desarrollo de la Competencia / Saberes (w > 95 or x0 >= 135, x0 < 355, x1 <= 365)
                    elif (w > 95 or x0 >= 135) and x0 < 355 and x1 <= 365 and len(clean) > 12:
                        if not sub_activities:
                            sub_activities.append({
                                "actividad": "Actividad formativa de competencia laboral",
                                "saberes": []
                            })
                        last_act = sub_activities[-1]
                        if clean not in last_act["saberes"]:
                            last_act["saberes"].append(clean)
                            
    # 5. Assemble structured modules
    for mod_roman in ["I", "II", "III", "IV", "V"]:
        sem = ROMAN_TO_SEMESTER[mod_roman]
        std_tot_hrs = MODULE_STANDARD_HOURS[mod_roman]
        outcome = module_outcomes.get(mod_roman, "")
        title = module_titles.get(mod_roman, f"Módulo {mod_roman}")
        
        raw_submods = module_submodules_meta.get(mod_roman, [])
        table_submods = table_data.get(mod_roman, {})
        
        compiled_submods = []
        for s_meta in raw_submods:
            s_num = s_meta["num"]
            s_name = s_meta["name"]
            s_hrs = s_meta["hours"] or (std_tot_hrs // len(raw_submods))
            
            # Activities from table
            s_table_acts = table_submods.get(s_num, [])
            
            # Convert activities to standard structure
            act_list = []
            for a_idx, a_data in enumerate(s_table_acts):
                act_list.append({
                    "order": a_idx + 1,
                    "name": a_data["actividad"],
                    "hours": round(s_hrs / max(1, len(s_table_acts))),
                    "saberes": a_data["saberes"]
                })
                
            # If no activities were extracted from table, add a fallback based on the submodule name
            if not act_list:
                act_list.append({
                    "order": 1,
                    "name": s_name,
                    "hours": s_hrs,
                    "saberes": []
                })
                
            compiled_submods.append({
                "submodulo_num": s_num,
                "nombre": s_name,
                "uac_name": f"Submódulo {s_num}: {s_name}",
                "horas_totales": s_hrs,
                "horas_semanales": round(s_hrs / 16),
                "actividades": act_list
            })
            
        career_result["modules"].append({
            "modulo_romano": mod_roman,
            "modulo_nombre": title,
            "semestre": sem,
            "horas_totales": std_tot_hrs,
            "horas_semanales": 17 if sem <= 4 else 12,
            "resultado_aprendizaje": outcome,
            "submodulos": compiled_submods
        })
        
    return career_result

def main():
    print(f"Starting extraction for {len(PDF_CATALOG)} Bachillerato Tecnológico careers...")
    all_extracted = []
    
    total_submodules = 0
    total_activities = 0
    total_saberes = 0
    
    for i, c_info in enumerate(PDF_CATALOG):
        print(f"\n[{i+1}/{len(PDF_CATALOG)}] Extracting: {c_info['name']}...")
        c_data = extract_career_data(c_info)
        all_extracted.append(c_data)
        
        sub_cnt = sum(len(m["submodulos"]) for m in c_data["modules"])
        act_cnt = sum(sum(len(s["actividades"]) for s in m["submodulos"]) for m in c_data["modules"])
        sab_cnt = sum(sum(sum(len(a["saberes"]) for a in s["actividades"]) for s in m["submodulos"]) for m in c_data["modules"])
        
        total_submodules += sub_cnt
        total_activities += act_cnt
        total_saberes += sab_cnt
        
        print(f"   -> Modules: {len(c_data['modules'])} | Submodules: {sub_cnt} | Actividades Clave: {act_cnt} | Saberes: {sab_cnt}")
        
    os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(all_extracted, f, ensure_ascii=False, indent=2)
        
    print(f"\nExtraction complete! Saved to {OUTPUT_JSON}")
    print(f"Total Careers: {len(all_extracted)}")
    print(f"Total Submodules: {total_submodules}")
    print(f"Total Actividades Clave: {total_activities}")
    print(f"Total Saberes Procedimentales: {total_saberes}")

if __name__ == "__main__":
    main()
