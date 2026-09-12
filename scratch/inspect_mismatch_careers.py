import fitz, re, os

folder = r'c:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio Tecnologicos\Carreras_Tecnicas'

check_files = [
    ('Agroindustrias', 'MoJhirfOov-AGROINDUSTRIAS1.pdf'),
    ('Agropecuario', 'S1lS7SXACa-AGROPECUARIO.pdf'),
    ('Ciberseguridad', 'lJmOA2k5Pp-Ciberseguridad_presencial.pdf'),
    ('Contabilidad', 'BaicwgARuD-CONTABILIDAD1.pdf'),
    ('Electronica', 'Nku1TCJEni-ELECTRONICA.pdf'),
    ('Fuentes Alternas de Energia', 'cj3S1XjVhH-FUENTES_ALTERNAS_DE_ENERGIA1.pdf'),
    ('Logistica', 'hsmlSzEiqc-LOGISTICA.pdf'),
    ('Mecatronica', 'MrtE54UFON-MECATRONICA.pdf'),
    ('Refrigeracion y Aire Acondicionado', '2hiQqTowjp-REFRIGERACION y aire acondicionado 23.pdf')
]

for career_name, filename in check_files:
    path = os.path.join(folder, filename)
    doc = fitz.open(path)
    print(f"\n==========================================")
    print(f"CAREER: {career_name}")
    print(f"==========================================")
    
    # 1. Find Mapa de competencias (usually pages 6 to 16)
    for pno in range(min(20, len(doc))):
        text = doc[pno].get_text("text")
        if "mapa de competencias laborales" in text.lower() or "1.4" in text:
            print(f"--- Mapa de competencias found on page {pno+1} ---")
            for line in text.split("\n"):
                line_str = line.strip()
                if any(k in line_str.lower() for k in ["submódulo", "submodulo", "módulo", "modulo"]) and len(line_str) > 3:
                    print("  ", line_str)
                    
    # 2. Find all // SUBMÓDULO occurrences and see why UNKNOWN or L/C occurred
    print("\n--- Submódulo pages inspection ---")
    for pno in range(len(doc)):
        text = doc[pno].get_text("text")
        if "//" in text and ("SUBMÓDULO" in text.upper() or "SUBMODULO" in text.upper()):
            # find what module is mentioned or if it's in a table
            mod_matches = re.findall(r'M[OÓ]DULO\s+([IVX]+)', text, re.IGNORECASE)
            sub_matches = re.findall(r'//\s*SUBM[OÓ]DULO\s*(\d+)\s*[:\-\.]*\s*(.*?)\s+(\d+)\s*horas', text, re.IGNORECASE | re.DOTALL)
            if sub_matches:
                print(f"P{pno+1} | Mods on page: {mod_matches} | Submods found: {len(sub_matches)}")
                for sm in sub_matches:
                    print(f"     Sub {sm[0]}: {' '.join(sm[1].split())[:50]} ({sm[2]}h)")
