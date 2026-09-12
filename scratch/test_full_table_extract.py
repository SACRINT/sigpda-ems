import fitz, re, os, json

folder = r'c:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio Tecnologicos\Carreras_Tecnicas'

HEADER_TERMS = [
    "PROCESO PARA LA FORMACI",
    "ACTIVIDAD CLAVE DE LA",
    "DESARROLLO DE LA COMPETENCIA",
    "RECURSOS SOCIOCOGNITIVOS",
    "RECURSOS SOCIO-EMOCIONALES",
    "ÁREAS DE CONOCIMIENTO",
    "AREAS DE CONOCIMIENTO",
    "HABILIDADES PARA LA VIDA",
    "CONCEPTOS CENTRALES",
    "RESULTADO DE APRENDIZAJE",
    "AL FINALIZAR EL MÓDULO",
    "AL FINALIZAR EL MODULO",
    "DIMENSIÓN",
    "DIMENSION"
]

def is_header(text):
    t = text.upper().strip()
    return any(h in t for h in HEADER_TERMS)

def test_extract_career(pdf_name):
    doc = fitz.open(os.path.join(folder, pdf_name))
    
    # Track current module and submodule
    current_module = None
    current_submod_idx = None
    
    modules_data = {
        "I": {"submodules": {1: [], 2: [], 3: []}},
        "II": {"submodules": {1: [], 2: [], 3: []}},
        "III": {"submodules": {1: [], 2: [], 3: []}},
        "IV": {"submodules": {1: [], 2: [], 3: []}},
        "V": {"submodules": {1: [], 2: [], 3: []}}
    }
    
    for page_no, page in enumerate(doc):
        text = page.get_text("text")
        
        # If we reached the appendix, stop table scanning
        if "lineamientos metodológicos para la elaboración de estrategias" in text.lower() and page_no > 50:
            break
            
        if "proceso para la formación" in text.lower() or "proceso de formación" in text.lower():
            # Determine module
            mod_m = re.search(r'M[OÓ]DULO\s+([IVX]+)', text, re.IGNORECASE)
            if mod_m:
                current_module = mod_m.group(1).upper()
                
            if not current_module or current_module not in modules_data:
                continue
                
            blocks = page.get_text("blocks")
            for b in blocks:
                x0, y0, x1, y1, btext = b[0], b[1], b[2], b[3], b[4].strip()
                if not btext or is_header(btext):
                    continue
                clean = " ".join(btext.split())
                
                # Check for submodule tag S1, S2, S3
                if x0 < 75 and re.match(r'^S(\d+)', clean):
                    sm_match = re.match(r'^S(\d+)', clean)
                    current_submod_idx = int(sm_match.group(1))
                    
                if current_submod_idx and current_submod_idx in modules_data[current_module]["submodules"]:
                    sub_dict = modules_data[current_module]["submodules"][current_submod_idx]
                    
                    # Actividad clave: 75 <= x0 < 165
                    if 75 <= x0 < 165 and len(clean) > 8:
                        # Append new activity if not already present
                        if not any(a["name"] == clean for a in sub_dict):
                            sub_dict.append({"name": clean, "saberes": []})
                            
                    # Desarrollo de la competencia (saberes): 165 <= x0 < 350
                    elif 165 <= x0 < 350 and len(clean) > 15:
                        # Add to the most recent activity or create a default one
                        if not sub_dict:
                            sub_dict.append({"name": "Actividades formativas del submódulo", "saberes": []})
                        if clean not in sub_dict[-1]["saberes"]:
                            sub_dict[-1]["saberes"].append(clean)

    return modules_data

for pdf in ['vBrm4pCEKV-PROGRAMACION.pdf', 'lJmOA2k5Pp-Ciberseguridad_presencial.pdf', 'BaicwgARuD-CONTABILIDAD1.pdf']:
    print(f"\n==================== {pdf} ====================")
    res = test_extract_career(pdf)
    for mod, mdata in res.items():
        print(f"Módulo {mod}:")
        for s_idx, acts in mdata["submodules"].items():
            if acts:
                tot_saberes = sum(len(a["saberes"]) for a in acts)
                print(f"  Submódulo {s_idx}: {len(acts)} actividades clave, {tot_saberes} saberes procedimentales")
                for a in acts[:2]:
                    print(f"    • Actividad: {a['name'][:60]}")
                    for s in a["saberes"][:2]:
                        print(f"        - Saber: {s[:70]}...")
