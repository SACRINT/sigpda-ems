import fitz, re, os

folder = r'c:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio Tecnologicos\Carreras_Tecnicas'

pdf_list = [
    ("Administración de Recursos Humanos", "kxj10vEiX8-ADMINISTRACION_DE_RECURSOS_HUMANOS.pdf"),
    ("Administración Emprendimientos", "wRWXf97tJK-ADMINISTRACION_EMPRENDIMIENTOS1.pdf"),
    ("Agroindustrias", "MoJhirfOov-AGROINDUSTRIAS1.pdf"),
    ("Agropecuario", "S1lS7SXACa-AGROPECUARIO.pdf"),
    ("Biotecnología", "N1vprB317D-BIOTECNOLOGIA 25.pdf"),
    ("Ciberseguridad", "lJmOA2k5Pp-Ciberseguridad_presencial.pdf"),
    ("Contabilidad", "BaicwgARuD-CONTABILIDAD1.pdf"),
    ("Diseño Gráfico Digital", "Ty9Yi5FMH1-DISEÑO_GRAFIC_ DIGITAL.pdf"),
    ("Electrónica", "Nku1TCJEni-ELECTRONICA.pdf"),
    ("Fuentes Alternas de Energía", "cj3S1XjVhH-FUENTES_ALTERNAS_DE_ENERGIA1.pdf"),
    ("Instrumentación Industrial", "r0VheQmaQQ-Instrumentación industrial 26.pdf"),
    ("Inteligencia Artificial", "UlWagZywil-INTELIGENCIA_ARTIFICIAL1.pdf"),
    ("Logística", "hsmlSzEiqc-LOGISTICA.pdf"),
    ("Mantenimiento Industrial", "dNVsD9nRpj-MANTENIMIENTO_INDUSTRIAL1.pdf"),
    ("Mecánica Naval", "AFC96xRiSd-MECANICA_NAVAL1.pdf"),
    ("Mecatrónica", "MrtE54UFON-MECATRONICA.pdf"),
    ("Ofimática", "uY1dEeOTNC-OFIMATICA 25.pdf"),
    ("Preparación de Alimentos y Bebidas", "peuZVvfxTL-PREPARACION_DE_ALIMENTOS_Y_BEBIDAS.pdf"),
    ("Programación", "vBrm4pCEKV-PROGRAMACION.pdf"),
    ("Recreaciones y Servicios Acuáticos", "q0Rjp0PTAh-RECREACIONES_SERVICIOS_ACUATICOS.pdf"),
    ("Recursos Hídricos", "zXnAkQJnFT-RECURSOS_HIDRICOS 25.pdf"),
    ("Refrigeración y Aire Acondicionado", "2hiQqTowjp-REFRIGERACION y aire acondicionado 23.pdf"),
    ("Salud Integral y Estilos de Vida", "VASuod1aGy-SALUD INTEGRAL Y ESTILOS DE VIDA SALUDABLES.pdf"),
    ("Servicios de Hospedaje", "WPwr6pIo9e-Servicios_de_Hospedaje.pdf"),
    ("Soporte y Gestión de TI", "lDS0Kk57jR-SOPORTE_Y_GESTION_DE_TECNOLOGIAS_INFORMATICAS.pdf")
]

all_results = {}

for career_name, filename in pdf_list:
    path = os.path.join(folder, filename)
    doc = fitz.open(path)
    
    submods_found = []
    
    for page_no, page in enumerate(doc):
        text = page.get_text("text")
        
        # Look for submodule declarations in info general pages
        # Patterns like: // SUBMÓDULO 1 <name> <hours> horas
        matches = re.findall(r'//\s*SUBM[OÓ]DULO\s*(\d+)\s*[:\-\.]*\s*(.*?)\s+(\d+)\s*horas', text, re.IGNORECASE | re.DOTALL)
        if matches and ("MÓDULO" in text.upper() or "MODULO" in text.upper()):
            # Find module number on this page
            mod_m = re.search(r'M[OÓ]DULO\s+([IVXLCDM]+)', text, re.IGNORECASE)
            mod_num = mod_m.group(1).upper() if mod_m else "UNKNOWN"
            for m in matches:
                s_num = int(m[0])
                s_name = " ".join(m[1].split())
                s_hrs = int(m[2])
                submods_found.append({
                    "modulo": mod_num,
                    "submodulo_num": s_num,
                    "nombre": s_name,
                    "horas": s_hrs,
                    "page": page_no + 1
                })
                
    total_hours = sum(s["horas"] for s in submods_found)
    all_results[career_name] = {
        "submods": submods_found,
        "total_hours": total_hours,
        "count": len(submods_found)
    }
    print(f"[{career_name}] -> {len(submods_found)} submodules, {total_hours}h total")

print("\n--- Summary ---")
for name, data in all_results.items():
    if data["total_hours"] != 1200 or data["count"] < 10:
        print(f"⚠️ {name}: {data['count']} submods, {data['total_hours']}h (expected 1200h)")
    else:
        print(f"✅ {name}: {data['count']} submods, {data['total_hours']}h")
