# Roadmap: Suite de Edición Documental Premium (Niveles 1, 2 y 3)
**SIGPDA-EMS · Arquitectura de Ingeniería de Software Educativo**  
*Fecha de Registro: Noviembre 2026*  
*Estado:*  
- **Nivel 1:** En Implementación Activa (Modal Express SSoT).  
- **Nivel 2:** Diseñado y Preservado para Fase Futura (Editor WYSIWYG TipTap).  
- **Nivel 3:** Diseñado y Preservado para Fase Futura (Motor Canvas Paginado Word-Like).

---

## 1. Visión y Justificación del Negocio
En el flujo operativo docente de Media Superior (MCCEMS), frecuentemente ocurren ajustes de último minuto antes de la entrega o supervisión:
- Un grupo adicional o corregido (ej. `"3°B"` en vez de `"3°A, 3°B"`).
- Ajustes en el nombre del docente, director o supervisor para firmas institucionales.
- Corrección de CCT, turno o ciclo escolar.
- Ajuste menor de redacción en el Propósito Formativo o en el Reto del PAEC exigido por supervisión de zona.

Tradicionalmente, el docente tenía que regenerar la planeación o editar el archivo Word fuera de la plataforma, perdiendo sincronización con el PDF oficial y con la base de datos de SIGPDA.

**Propuesta de Valor Premium:**
Permitir la modificación directa de los documentos en la plataforma antes de la descarga, manteniendo la sincronía perfecta entre:
1. Base de datos PostgreSQL (`content_json`).
2. Exportador PDF oficial en servidor (Typst / PDFKit).
3. Exportador Word oficial (`.docx`).
4. Visor en pantalla e impresión Carta.

---

## 2. Nivel 1 — Edición Rápida In-Situ / Modal Express SSoT (Fase Actual)

### 2.1 Principio Técnico
No se manipulan binarios post-compilación. Se modifica el modelo de datos estructurado (`content_json`) en la base de datos a través de un endpoint protegido. La siguiente descarga de PDF o Word compila en tiempo real sobre los datos corregidos.

### 2.2 Alcance Funcional
- **Campos Editables en Sección I (Datos Administrativos):**
  - Grupos (ej. corregir grupos asignados).
  - Nombre del Docente.
  - Nombre del Plantel / Escuela.
  - CCT (Clave de Centro de Trabajo).
  - Zona Escolar.
  - Municipio.
  - Turno (Matutino / Vespertino / Mixto).
  - Ciclo Escolar.
  - Carga Horaria (Horas Totales).
  - Nombre del Director(a) para firmas.
  - Nombre del Supervisor(a) para firmas.
- **Campos Editables en Sección II (Intención Curricular):**
  - Propósito Formativo.
  - Vinculación Comunitaria (PAEC).
- **Control de Acceso (Subscription Gate):**
  - Exclusivo para cuentas de Administrador (`isAdmin: true`, correo maestro) y Docentes con Suscripción Premium Activa (`hasActiveSubscription: true`).
  - Para docentes en plan gratuito, el botón muestra el distintivo dorado 👑 y abre el modal de suscripción.

---

## 3. Nivel 2 — Editor Visual WYSIWYG Interactivo (Fase Futura Preservada)

### 3.1 Principio Técnico
Integrar un editor enriquecido en una pestaña dedicada dentro del detalle de la planeación, permitiendo editar no solo los metadatos sino el cuerpo completo de las actividades, momentos didácticos (Apertura, Desarrollo, Cierre), instrumentos de evaluación y recursos.

### 3.2 Componente Base
Evolución del componente existente `src/components/planeacion/PlanningEditor.tsx` basado en `@tiptap/react` y `@tiptap/starter-kit`:
- Extensiones semánticas personalizadas: `BloqueApertura`, `BloqueDesarrollo`, `BloqueCierre`, `BloqueRubrica`.
- Serializador bidireccional: `contentToHTML` y `htmlToContent` con validación Zod.
- Guardado asíncrono con `auto-save` (debounce de 2.5s) y botón manual de confirmación.

### 3.3 Hito de Activación
- Cuando los docentes requieran personalizar las descripciones pedagógicas de las sesiones individuales antes de generar la Suite de 24 planes de clase.

---

## 4. Nivel 3 — Motor de Hojas Paginadas Canvas Estilo Word (Fase Futura Preservada)

### 4.1 Principio Técnico
Experiencia ofimática de grado profesional en el navegador: renderizado en HTML5 Canvas con simulación física de hojas tamaño Carta (215.9 mm × 279.4 mm) o A4, con saltos de página reales en vivo, márgenes institucionales, reglas, encabezados y pies de página.

### 4.2 Repositorios y Tecnologías de Referencia
1. **[canvas-editor](https://github.com/Hu-Mandrill/canvas-editor)**:
   - Editor de documentos paginados escrito en TypeScript sobre Canvas.
   - Manejo nativo de paginación en vivo, tablas con redimensionamiento de columnas, encabezados fijos por página, numeración de hojas y exportación directa a DOCX/PDF.
2. **[docx-preview / docxjs](https://github.com/VolodymyrBaydalka/docxjs)**:
   - Renderizador rápido de documentos Word en el DOM cliente.
3. **[pdf-lib](https://github.com/Hopding/pdf-lib)**:
   - Modificación y sellado de campos y metadatos sobre plantillas PDF fijas.
4. **[OnlyOffice Document Server Community Edition](https://github.com/ONLYOFFICE/DocumentServer)**:
   - Solución corporativa en contenedor Docker para co-edición completa DOCX/XLSX en tiempo real.

### 4.3 Hito de Activación
- Implementación reservada para la fase de licenciamiento institucional para planteles y zonas escolares completas.

---

## 5. Matriz Comparativa

| Dimensión | Nivel 1 (Express SSoT) | Nivel 2 (WYSIWYG TipTap) | Nivel 3 (Canvas Paginado Word) |
| :--- | :--- | :--- | :--- |
| **Tiempo de Desarrollo** | 1 - 2 días | 4 - 6 días | 2 - 3 semanas |
| **Riesgo de Regresión** | Nulo (SSoT garantizada) | Bajo (controlado por Zod) | Medio (complejidad de renderizado) |
| **Fidelidad al Formato SEP** | 100% exacta (motores PDF/Typst) | Alta | Idéntica a Microsoft Word |
| **Consumo de Recursos** | Mínimo (JSON ligero) | Medio (DOM TipTap) | Alto (Canvas en memoria) |
| **Target de Usuario** | Premium Docente Individual / Admin | Premium Avanzado | Institucional / Dirección de Plantel |

