import re
import os

content = open('src/lib/bt-carreras-catalog.ts', encoding='utf-8').read()
nuevos = len(re.findall(r'"tipoPrograma":\s*"nuevo"', content))
anteriores = len(re.findall(r'"tipoPrograma":\s*"anterior"', content))
print(f"Total Nuevos: {nuevos}")
print(f"Total Anteriores: {anteriores}")

# List all career names with 'nuevo'
carreras = re.findall(r'"id":\s*"([^"]+)",\s*"nombre":\s*"([^"]+)",\s*"tipoPrograma":\s*"nuevo"', content)
print(f"\nLista de Carreras Nuevas ({len(carreras)}):")
for cid, cname in carreras:
    print(f"  - {cname} (id: {cid})")
