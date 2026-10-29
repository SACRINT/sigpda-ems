# MEMORIA DE CONVERSACIONES Y REGISTRO HISTÓRICO DE CAMBIOS — SIGPDA-EMS

> **Documento de Persistencia y Memoria del Proyecto**  
> *Fecha de Registro*: 29 de Octubre de 2026  
> *Repositorio*: `https://github.com/SACRINT/sigpda-ems.git`  
> *Rama*: `main`  
> *Identificadores de Sesión Antigravity*:
> - Sesión Anterior: `3b6bcbc2-c18f-4126-9729-fb2c14c14561` (*Auditoría De Cierre De Fase*)
> - Sesión Actual: `4bfa73c1-0cd8-441c-a2b9-641cd4195e0e` (*Currículum Ampliado, Desinfección de Nomenclatura, Carga Horaria y Auditoría Integral de Plataforma*)

---

## 📌 1. SESIÓN ANTERIOR (`3b6bcbc2-c18f-4126-9729-fb2c14c14561`)

### Objetivo General
Auditoría técnica de cierre de fase, optimización del motor de materiales didácticos, diapositivas y renderizado editorial para imprenta.

### Logros y Cambios Clave Realizados
1. **Motor Visual SACRINT (`src/lib/visual-engine/sacrint/`)**:
   - Creación del rasterizador de alta fidelidad para infografías y diapositivas de aula sin desbordes de texto.
   - Paquetes visuales y cromáticos adaptados por disciplina (Ciencias Naturales, Humanidades, Matemáticas, Comunicación, Ciencias Sociales, Socioemocional y Formación Laboral).
   - Renderizador SVG y tipografías incrustadas (`Inter`, `Space Grotesk`) para máxima nitidez en proyección.
   - Generador PPTX para descarga directa de presentaciones editables (`sacrint-pptx-generator.ts`).
2. **Descargas Combinadas y Visor de Diapositivas**:
   - `SacrintSlidesViewerModal.tsx`: Visor interactivo en pantalla completa con vista previa interactiva de diapositivas por corte y bloque de contenidos.
   - Endpoint `/api/planeaciones/[id]/presentacion/sacrint`: API de generación instantánea de diapositivas alineadas a la planeación.
   - Endpoint `/api/planeaciones/[id]/infografia/sacrint`: Generación de infografías didácticas para docentes y estudiantes.
3. **Optimización de Compilación Editorial con Typst**:
   - Estabilización del compilador Typst en `src/lib/editorial/typst-compiler.ts`.
   - Pruebas automatizadas de renderizado de libros de texto con maquetación comercial tipo imprenta (Santillana/Pearson).
4. **Análisis de Banderas Nivel 1 (Fase D-02)**:
   - Registro de gobernanza de feature flags (`PMC_ORCHESTRATOR_V2`, `PLANEACION_ORCHESTRATOR_V2`, `PAEC_ORCHESTRATOR_V2`, `CARTOGRAFIA_ORCHESTRATOR_V2`, `HORARIOS_ORCHESTRATOR_V2`) mantenidas en `false` por defecto para preservar la estabilidad de las rutas en producción.

---

## 📌 2. SESIÓN ACTUAL (`4bfa73c1-0cd8-441c-a2b9-641cd4195e0e`)

### 1. Requerimiento: Integración Oficial del Currículum Ampliado (Formación Socioemocional)
- **Documento fuente analizado**: `{2025_ MCC_FORMACIONSOCIOEMOCIONAL_BN.pdf}` ubicado en `documentos_referencia/[01]Planeaciones-Secuencias-Plan_de_Clase/[02] Programas_de_Estudio BG/Programas de Estudio para la Generación 2025 - 2028/Curriculum Ampliado`.
- **Estructura oficial extraída (40 páginas)**:
  - 5 asignaturas oficiales:
    1. `Actividades Físicas y Deportivas`
    2. `Actividades Artísticas y Culturales`
    3. `Educación para la Salud`
    4. `Educación Integral en Sexualidad y Género`
    5. `Práctica y Colaboración Ciudadana`
  - 5 tablas completas con: Metas de Aprendizaje, 23 Propósitos Formativos, 91 Contenidos Formativos, Aprendizajes de Trayectoria y Orientaciones Pedagógicas.

### 2. Malla Curricular Oficial y Distribución por Semestre (SEP / MCCEMS)
A solicitud expresa del usuario basada en el mapa curricular actualizado:
- **1.ᵉʳ Semestre**: Exclusivamente `Actividades Físicas y Deportivas` (sin número romano). Carga: **36 horas (2 h/semana)**.
- **2.° Semestre**: Exclusivamente `Actividades Artísticas y Culturales` (sin número romano). Carga: **36 horas (2 h/semana)**.
- **3.ᵉʳ Semestre**: 3 asignaturas rotativas a elegir libremente por el plantel (`Educación para la Salud`, `Educación Integral en Sexualidad y Género`, `Práctica y Colaboración Ciudadana`). Carga: **36 horas (2 h/semana)**.
- **4.° Semestre**: Las mismas 3 asignaturas rotativas disponibles. Carga condicional SEP: **18 horas (1 h/semana)**.
- **5.° Semestre**: Las mismas 3 asignaturas rotativas disponibles. Carga: **36 horas (2 h/semana)**.
- **6.° Semestre**: Las mismas 3 asignaturas rotativas disponibles. Carga condicional SEP: **18 horas (1 h/semana)**.

### 3. Desinfección Estricta de Números Romanos
- Se detectó que el catálogo y las interfaces estaban generando sufijos romanos erróneos (`I`, `II`, `III`, `IV`, `V`, `VI`) en las asignaturas socioemocionales.
- **Solución implementada**:
  - En `src/lib/utils.ts`: Se robusteció la función `cleanSocioemotionalName` con la expresión regular:
    ```typescript
    name.replace(/\s+(?:I{1,3}|IV|VI?)$/i, '').trim();
    ```
  - En `src/lib/catalog-cache.ts`: Se integró la desinfección obligatoria en la entrega de la API para que ningún registro entregue números romanos.
  - En `src/components/planeacion/StepUAC_BGE.tsx` y `StepUAC_BT.tsx`: Desinfección tanto en la renderización de las opciones del select como en el momento de guardar la UAC seleccionada.
  - En `scripts/seed-curriculum-ampliado.ts`: Resiembra limpia de 14 registros exactos en Neon DB (`programs_catalog`).
  - En `src/lib/escuela-grupos.ts`: Asignación exacta de 1h para semestres 4 y 6, y 2h para semestres 1, 2, 3 y 5.
  - En `scripts/data/curriculum_canonical_203.json`: Sincronización canónica de los 14 registros.

### 4. Corrección de Carga Horaria Condicional SEP (18h vs 36h)
- Se corrigió la discrepancia donde 4.° y 6.° semestre mostraban 36 horas.
- La siembra en base de datos y la malla en código quedaron sincronizadas:
  - Semestre 4: `total_hours: 18`, `hours_per_week: 1`
  - Semestre 6: `total_hours: 18`, `hours_per_week: 1`
  - Semestres 1, 2, 3 y 5: `total_hours: 36`, `hours_per_week: 2`

### 5. Commits y Despliegues a Producción
- `53a8b4e`: *fix(curriculum): remover números romanos de asignaturas de curriculum ampliado y sincronizar catalogo*
- `c63c72c`: *fix(curriculum): ajustar carga horaria de curriculum ampliado a 18h (1 h/semana) en 4° y 6° semestre*
- `origin/main` sincronizado con GitHub y compilación exitosa en Vercel (126/126 páginas).

### 6. Parche de Seguridad en Proxy (`src/proxy.ts`)
- Se incluyeron en `protectedPaths`:
  - `/horarios`
  - `/mi-escuela`
  - `/mi-zona`
  - `/mi-progreso`
  Garantizando que ningún usuario no autenticado o sin suscripción activa acceda indebidamente a las herramientas de dirección o supervisión.

---

## 📌 3. INVENTARIO DEL CATÁLOGO CURRICULAR EN NEON POSTGRESQL

- Total de registros oficiales en `programs_catalog`: **449 UACs**.
- Registros de Currículum Ampliado (14 exactos):
  1. Semestre 1: `Actividades Físicas y Deportivas` (36h / 2h sem)
  2. Semestre 2: `Actividades Artísticas y Culturales` (36h / 2h sem)
  3. Semestre 3: `Educación para la Salud` (36h / 2h sem)
  4. Semestre 3: `Educación Integral en Sexualidad y Género` (36h / 2h sem)
  5. Semestre 3: `Práctica y Colaboración Ciudadana` (36h / 2h sem)
  6. Semestre 4: `Educación para la Salud` (18h / 1h sem)
  7. Semestre 4: `Educación Integral en Sexualidad y Género` (18h / 1h sem)
  8. Semestre 4: `Práctica y Colaboración Ciudadana` (18h / 1h sem)
  9. Semestre 5: `Educación para la Salud` (36h / 2h sem)
  10. Semestre 5: `Educación Integral en Sexualidad y Género` (36h / 2h sem)
  11. Semestre 5: `Práctica y Colaboración Ciudadana` (36h / 2h sem)
  12. Semestre 6: `Educación para la Salud` (18h / 1h sem)
  13. Semestre 6: `Educación Integral en Sexualidad y Género` (18h / 1h sem)
  14. Semestre 6: `Práctica y Colaboración Ciudadana` (18h / 1h sem)

---

## 📌 4. INSTRUCCIONES DE RECUPERACIÓN POST-ACTUALIZACIÓN
En caso de reinicio de la máquina, corte de energía o actualización del IDE:
1. Toda la memoria técnica y arquitectónica está preservada en este documento (`docs/MEMORIA_CONVERSACIONES_Y_HISTORIAL_CAMBIOS.md`) y en el reporte maestro (`docs/AUDITORIA_INTEGRAL_Y_HOJA_DE_RUTA_2026.md`).
2. El repositorio en GitHub (`origin/main`) contiene todos los commits probados y en verde.
3. Para retomar cualquier desarrollo, consultar la sección correspondiente en la Hoja de Ruta.
