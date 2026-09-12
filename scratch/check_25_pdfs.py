import os

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

print(f"Verificando {len(pdf_list)} PDFs en {folder}...\n")
missing = []
for name, filename in pdf_list:
    full_path = os.path.join(folder, filename)
    exists = os.path.exists(full_path)
    status = "OK" if exists else "FALTA"
    if not exists:
        missing.append((name, filename))
    print(f"[{status}] {name}: {filename}")

print(f"\nResumen: {len(pdf_list) - len(missing)}/{len(pdf_list)} encontrados.")
if missing:
    print("Faltantes:")
    for m in missing:
        print("  -", m)
