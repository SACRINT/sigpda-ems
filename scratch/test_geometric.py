import fitz, re, os

folder = r'c:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio Tecnologicos\Carreras_Tecnicas'

def test_geometric_extraction(pdf_name):
    doc = fitz.open(os.path.join(folder, pdf_name))
    current_module = None
    current_submod = None
    
    extracted = {}
    
    for page_no, page in enumerate(doc):
        text = page.get_text("text")
        
        # Stop at appendix
        if "lineamientos metodológicos" in text.lower() and page_no > 50:
            break
            
        if "proceso para la formación" in text.lower() or "proceso de formación" in text.lower():
            # Check module Roman Numeral
            mod_m = re.search(r'M[OÓ]DULO\s+([IVX]+)', text, re.IGNORECASE)
            if mod_m:
                new_mod = mod_m.group(1).upper()
                if new_mod != current_module:
                    current_module = new_mod
                    current_submod = None
            
            if not current_module:
                continue
                
            if current_module not in extracted:
                extracted[current_module] = {}
                
            is_first_page_of_module = "RESULTADO DE APRENDIZAJE" in text.upper()
            y_min_content = 330 if is_first_page_of_module else 290
            
            blocks = page.get_text("blocks")
            for b in blocks:
                x0, y0, x1, y1, btext = b[0], b[1], b[2], b[3], b[4].strip()
                # Skip page numbers and headers
                if y0 < y_min_content or y0 > 550 or not btext:
                    continue
                clean = " ".join(btext.split())
                
                # Check for submodule tag S1, S2, S3
                if x0 < 75 and re.match(r'^S\d+', clean):
                    sm_match = re.match(r'^S(\d+)', clean)
                    current_submod = int(sm_match.group(1))
                    if current_submod not in extracted[current_module]:
                        extracted[current_module][current_submod] = []
                        
                if current_submod is not None:
                    if current_submod not in extracted[current_module]:
                        extracted[current_module][current_submod] = []
                        
                    # Actividad Clave: 65 <= x0 < 145
                    if 65 <= x0 < 145 and len(clean) > 5:
                        if not any(a["actividad"] == clean for a in extracted[current_module][current_submod]):
                            extracted[current_module][current_submod].append({
                                "actividad": clean,
                                "saberes": []
                            })
                    # Desarrollo de la Competencia: 145 <= x0 < 350
                    elif 145 <= x0 < 350 and len(clean) > 10:
                        if not extracted[current_module][current_submod]:
                            extracted[current_module][current_submod].append({
                                "actividad": "Actividad formativa principal",
                                "saberes": []
                            })
                        last_act = extracted[current_module][current_submod][-1]
                        if clean not in last_act["saberes"]:
                            last_act["saberes"].append(clean)
                            
    return extracted

for pdf in ['BaicwgARuD-CONTABILIDAD1.pdf', 'lJmOA2k5Pp-Ciberseguridad_presencial.pdf', 'vBrm4pCEKV-PROGRAMACION.pdf']:
    print(f"\n====================== {pdf} ======================")
    data = test_geometric_extraction(pdf)
    for mod, submods in data.items():
        print(f"Módulo {mod}:")
        for snum, acts in submods.items():
            tot_saberes = sum(len(a["saberes"]) for a in acts)
            print(f"  Submódulo {snum}: {len(acts)} actividades clave, {tot_saberes} saberes")
            for a in acts:
                print(f"    • {a['actividad'][:60]} ({len(a['saberes'])} saberes)")
