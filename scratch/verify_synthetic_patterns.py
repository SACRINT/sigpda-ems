# -*- coding: utf-8 -*-
import json, sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

patterns = [
    "Saberes conceptuales y procedimentales de",
    "Aplicación técnica y práctica en",
    "Analiza y fundamenta los conceptos clave",
    "El estudiantado profundiza y aplica saberes formativos avanzados",
    "Fundamentos conceptuales y marco de análisis"
]

with open("scripts/data/curriculum_canonical_203.json", "r", encoding="utf-8") as f:
    content = f.read()

print("=== VERIFICACIÓN DE PATRONES SINTÉTICOS EN curriculum_canonical_203.json ===")
all_clean = True
for p in patterns:
    count = content.count(p)
    if count > 0:
        print(f"❌ PATRÓN ENCONTRADO ({count} veces): \"{p}\"")
        all_clean = False
    else:
        print(f"✅ LIMPIO (0 coincidencias): \"{p}\"")

if all_clean:
    print("\n🎉 CONFIRMACIÓN: El archivo JSON canónico tiene CERO texto sintético de los 5 patrones.")
