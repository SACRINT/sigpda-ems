# RUNBOOK DE ACTIVACIÓN EN PRODUCCIÓN: GOBERNANZA G3
## Despliegue Controlado del Orquestador Central de Planeaciones (Nivel 1)
### Bandera: `PLANEACION_ORCHESTRATOR_V2` (Piloto Controlado)

> **Documento Oficial de Operaciones y Rollout — Gobernanza G3**  
> **Sistema**: SIGPDA-EMS DBEPA Puebla (Ciclo Escolar 2026–2027)  
> **Módulo**: Orquestador N1 de Planeaciones Didácticas  
> **Estado de la Bandera**: `false` (Default Seguro / Producción Legacy Activa)  
> **Aprobación de Despliegue**: PENDIENTE DE REVISIÓN Y FIRMA DEL USUARIO  

---

## 1. Visión y Política de Seguridad

Conforme a la política de gobernanza estricta establecida en `AGENTS.md` y `docs/architecture/ORQUESTADORES_N1_GOBERNANZA_DISENO.md`, **este runbook NO activa de forma anticipada la bandera `PLANEACION_ORCHESTRATOR_V2`**.

El sistema en producción permanece operando al 100% bajo el circuito legacy probado. La activación controlada se ejecutará exclusivamente tras la revisión de este protocolo, la designación de los docentes participantes y la firma formal de autorización por parte de la Dirección / Usuario del sistema.

---

## 2. Criterios de Selección del Plantel Piloto

Para aislar el impacto y asegurar retroalimentación técnica representativa sin afectar la operación regular del ciclo escolar, se define la siguiente muestra:

1. **Un solo Plantel Oficial**:
   - Plantel designado: **Bachillerato General Estatal "Cadete Vicente Suárez"** (Zona Escolar 004, Región Tepeaca / Puebla) o plantel equivalente con catálogo completo de UACs en la base de datos.
   - Infraestructura requerida: Docentes con credenciales activas en SIGPDA-EMS, navegador moderno (Chromium/Firefox) y conexión a internet estable.

2. **Grupo de 2 a 3 Docentes Voluntarios**:
   - **Docente A (Componente Fundamental 1°–4° Semestre)**: Asignatura de tronco común con progresión curricular estándar (e.g., *Lengua y Comunicación I* o *Pensamiento Matemático I*, 4 horas semanales).
   - **Docente B (Ciencias Naturales / Experimentales STEM)**: Asignatura con componentes prácticos y laboratoriales (e.g., *La Materia y sus Interacciones* o *Conservación de la Energía y sus Interacciones con la Materia*).
   - **Docente C (Componente Laboral o Fundamental 5°–6° Semestre)**: Asignatura con alta carga horaria curricular (e.g., *Módulo Profesional / Sistemas Embebidos e IoT*, 12–18 horas semanales).

3. **Criterio de Exclusión**:
   - Docentes que estén en periodo de entrega formal definitiva ante supervisión escolar para evitar disrupciones administrativas.

---

## 3. Checklist Exhaustivo de Smoke Tests (Pre-Activación y Verificación)

Antes de abrir el acceso a los docentes voluntarios, el ingeniero de operaciones debe ejecutar y documentar la siguiente batería de pruebas manuales y automatizadas sobre el entorno de staging/producción con la bandera temporalmente habilitada para la sesión de prueba:

### 3.1 Pruebas de Happy Path (Códigos HTTP 200)

#### Test S-01: Exportación Editorial a PDF Oficial en Servidor
- **Método y Ruta**: `GET /api/planeaciones/{id}/pdf`
- **Comportamiento Esperado**: HTTP 200, encabezado `Content-Type: application/pdf`, binario que inicia con `%PDF` y tamaño mayor a 3,000 bytes con fuentes Lato/Montserrat.
- **Comando `curl`**:
  ```bash
  curl -X GET "https://sigpda.midominio.edu.mx/api/planeaciones/8f1c3d2e-4b5a-6c7d-8e9f-0a1b2c3d4e5f/pdf" \
    -H "Cookie: next-auth.session-token=MI_TOKEN_DE_SESION_DOCENTE" \
    --output planeacion_smoke_test.pdf \
    -w "HTTP_STATUS: %{http_code}\nCONTENT_TYPE: %{content_type}\n"
  ```
- **Criterio de Aceptación**: `HTTP_STATUS: 200`, `CONTENT_TYPE: application/pdf`, archivo legible por Adobe Reader o visor de navegador.

#### Test S-02: Generación Determinista de Secuencia Didáctica Tripartita
- **Método y Ruta**: `POST /api/planeaciones/{id}/secuencia`
- **Payload**:
  ```json
  {
    "blockIndex": 0,
    "totalHours": 12
  }
  ```
- **Comando `curl`**:
  ```bash
  curl -X POST "https://sigpda.midominio.edu.mx/api/planeaciones/8f1c3d2e-4b5a-6c7d-8e9f-0a1b2c3d4e5f/secuencia" \
    -H "Content-Type: application/json" \
    -H "Cookie: next-auth.session-token=MI_TOKEN_DE_SESION_DOCENTE" \
    -d '{"blockIndex": 0, "totalHours": 12}'
  ```
- **Criterio de Aceptación**: `status: 200`, JSON con `success: true`, `sequence.sessions.length == 12`, distribución Apertura (2), Desarrollo (8), Cierre (2) y `warnings: []`.

#### Test S-03: Generación Estructural de Planeación Integral (Tres Saberes)
- **Método y Ruta**: `POST /api/planeaciones/generate`
- **Payload**:
  ```json
  {
    "asignatura": "Pensamiento Matemático I",
    "semestre": 1,
    "docenteNombre": "Prof. Juan Carlos Pérez",
    "contextoComunitario": "Comunidad rural de Tepeaca con enfoque en ahorro de agua",
    "horasSemanales": 4
  }
  ```
- **Comando `curl`**:
  ```bash
  curl -X POST "https://sigpda.midominio.edu.mx/api/planeaciones/generate" \
    -H "Content-Type: application/json" \
    -H "Cookie: next-auth.session-token=MI_TOKEN_DE_SESION_DOCENTE" \
    -d '{
      "asignatura": "Pensamiento Matemático I",
      "semestre": 1,
      "docenteNombre": "Prof. Juan Carlos Pérez",
      "contextoComunitario": "Comunidad rural de Tepeaca con enfoque en ahorro de agua",
      "horasSemanales": 4
    }'
  ```
- **Criterio de Aceptación**: `status: 200`, JSON con `success: true`, `status: "DRAFT_ESTRUCTURADO"`, y objeto `tresSaberes` con `conceptual`, `procedimental` y `actitudinal` completos.

---

### 3.2 Pruebas de Robustez y Casos Negativos

#### Test S-04: Autenticación Faltante (HTTP 401)
- **Verificación**: Petición sin cookie de sesión `next-auth.session-token`.
- **Comando `curl`**:
  ```bash
  curl -i -X GET "https://sigpda.midominio.edu.mx/api/planeaciones/8f1c3d2e-4b5a-6c7d-8e9f-0a1b2c3d4e5f/pdf"
  ```
- **Criterio de Aceptación**: HTTP `401 Unauthorized` con `{ "error": "No autorizado" }`.

#### Test S-05: Control de Ownership F-49 (HTTP 403)
- **Verificación**: Docente B intenta descargar la planeación del Docente A sin ser administrador.
- **Comando `curl`**:
  ```bash
  curl -i -X GET "https://sigpda.midominio.edu.mx/api/planeaciones/8f1c3d2e-4b5a-6c7d-8e9f-0a1b2c3d4e5f/pdf" \
    -H "Cookie: next-auth.session-token=TOKEN_DOCENTE_AJENO"
  ```
- **Criterio de Aceptación**: HTTP `403 Forbidden` con `{ "error": "Acceso denegado: no tienes permisos sobre esta planeación" }`.

#### Test S-06: Identificador Inexistente (HTTP 404)
- **Verificación**: Consulta de un UUID que no existe en la tabla `plannings`.
- **Comando `curl`**:
  ```bash
  curl -i -X GET "https://sigpda.midominio.edu.mx/api/planeaciones/00000000-0000-0000-0000-000000000000/pdf" \
    -H "Cookie: next-auth.session-token=TOKEN_DOCENTE_VALIDO"
  ```
- **Criterio de Aceptación**: HTTP `404 Not Found` con mensaje descriptivo de planeación no encontrada.

#### Test S-07: Cota Curricular Máxima F-47 (HTTP 400)
- **Verificación**: Envío de `totalHours > 200` para prevenir saturación de memoria.
- **Comando `curl`**:
  ```bash
  curl -i -X POST "https://sigpda.midominio.edu.mx/api/planeaciones/8f1c3d2e-4b5a-6c7d-8e9f-0a1b2c3d4e5f/secuencia" \
    -H "Content-Type: application/json" \
    -H "Cookie: next-auth.session-token=TOKEN_DOCENTE_VALIDO" \
    -d '{"blockIndex": 0, "totalHours": 999999}'
  ```
- **Criterio de Aceptación**: HTTP `400 Bad Request` con `{ "error": "totalHours excede la cota curricular permitida (máximo 200 horas)" }`.

#### Test S-08: Validación de Entradas en Generación (HTTP 400)
- **Verificación**: Envío de asignatura vacía o semestre fuera del rango 1..6.
- **Comando `curl`**:
  ```bash
  curl -i -X POST "https://sigpda.midominio.edu.mx/api/planeaciones/generate" \
    -H "Content-Type: application/json" \
    -H "Cookie: next-auth.session-token=TOKEN_DOCENTE_VALIDO" \
    -d '{"asignatura": "", "semestre": 7}'
  ```
- **Criterio de Aceptación**: HTTP `400 Bad Request` rechazado por el esquema Zod / validación defensiva del orquestador.

---

## 4. Métricas de Observabilidad y Telemetría

Durante el periodo de pilotaje se capturarán las siguientes métricas en cada ciclo de ejecución:

| Métrica | Umbral Objetivo Orquestador N1 | Comparativo Histórico Legacy | Herramienta de Medición |
| :--- | :--- | :--- | :--- |
| **Latencia p50 (PDF)** | `< 800 ms` | `3,200 ms` (cliente jsPDF) | Logs de Vercel / APM Server |
| **Latencia p95 (PDF)** | `< 2,500 ms` | `8,500 ms` (cliente jsPDF) | Logs de Vercel / APM Server |
| **Latencia p95 (Secuencia)** | `< 1,200 ms` | `18,000 ms` (Gemini streaming) | Logs API / Telemetría |
| **Tasa de Error 5xx** | `0.00%` (Tolerancia máx: `< 0.2%`) | `~2.4%` (timeouts de IA upstream) | Logs de Producción |
| **Consumo de Memoria** | Determinista (`< 120 MB` en heap) | Variable por streaming de tokens | Node.js Runtime metrics |
| **Persistencia en Neon DB** | Invariante: `warnings: []` en 100% de casos normales | No aplicaba orquestación atómica | Query a tabla `plannings` |

### 4.1 Encuesta Cualitativa Docente (Al finalizar Semana 1 y 2)
1. **Fidelidad Curricular**: ¿La secuencia didáctica desglosó correctamente las actividades de apertura, desarrollo y cierre acorde al MCCEMS? (Escala 1 al 5).
2. **Claridad del PDF**: ¿El documento descargado cuenta con membrete nítido, fuentes oficiales legibles y sin traslapes en tablas? (Sí / No / Comentarios).
3. **Velocidad Percibida**: ¿Cómo califica la agilidad del sistema al descargar el documento y guardar las sesiones de clase? (Rápido / Normal / Lento).

---

## 5. Duración y Criterios Formales de Éxito / Fallo

- **Duración del Piloto**: **2 semanas calendario** (10 días hábiles de ciclo escolar lectivo).

### Criterios de Éxito (Transición a Despliegue General)
1. **Estabilidad Técnica**: Cero errores críticos `500` no controlados atribuibles al orquestador.
2. **Latencia**: Latencia p95 inferior a 2.5s en PDF e inferior a 1.2s en generación de secuencias.
3. **Satisfacción**: Calificación promedio docente $\ge 4.5/5$ en pertinencia pedagógica.
4. **Integridad de Datos**: Cero casos de secuencias corruptas o huérfanas en Neon DB.

### Criterios de Fallo (Disparadores Inmediatos de Rollback)
1. Tasa de error HTTP `5xx` superior al 1.0% en peticiones del plantel piloto.
2. Reporte de timeout de servidor (`504 Gateway Timeout`) en cualquier intento de exportación PDF.
3. Inconsistencia o pérdida de datos en el campo `sequence_json` de planeaciones preexistentes.
4. Bloqueo de la interfaz de usuario para el docente voluntario.

---

## 6. Procedimiento de Rollback Inmediato (< 3 Minutos)

En caso de activarse cualquiera de los criterios de fallo, se ejecutará el siguiente procedimiento sin requerir ventana de mantenimiento:

### Paso 1: Conmutación Inmediata de la Bandera (Tiempo: 30 segundos)
Si la bandera está vinculada a variables de entorno de plataforma:
```bash
# Cambiar en panel de control Vercel / Producción:
FEATURE_FLAG_PLANEACION_ORCHESTRATOR_V2=false
```
O directamente en el código fuente de verdad única ([`src/lib/platform/feature-flags.ts`](file:///c:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/SIGPDA_EMS/src/lib/platform/feature-flags.ts)):
```typescript
PLANEACION_ORCHESTRATOR_V2: false,
```

### Paso 2: Despliegue de Emergencia / Git Revert (Tiempo: 2 minutos)
```bash
git checkout main
git revert <HASH_DEL_COMMIT_DE_ACTIVACION> --no-edit
git push origin main
```

### Paso 3: Verificación de Aislamiento y Fallback Automático (Tiempo: 30 segundos)
Ejecutar verificación de que las rutas retornan el código legacy esperado:
```bash
curl -i -X GET "https://sigpda.midominio.edu.mx/api/planeaciones/{id}/pdf" \
  -H "Cookie: next-auth.session-token=TOKEN_DOCENTE"
```
- **Resultado Esperado Post-Rollback**: HTTP `501 Not Implemented`.  
- **Efecto en la UI**: La interfaz docente detecta automáticamente el código 501 y conmuta silenciosamente al motor legacy de cliente (jsPDF / Gemini frontend) sin degradar la experiencia ni arrojar errores al usuario.

---

## 7. Tabla de Firmas y Autorización Formal de Despliegue

| Rol / Responsabilidad | Nombre y Cargo | Estado de Aprobación | Fecha |
| :--- | :--- | :--- | :--- |
| **Ingeniería de Software / Arquitectura** | Antigravity AI Agent (SACRINT) | **Propuesto y Verificado** (Commit listo) | 2026-10-10 |
| **Auditoría de Seguridad y Estabilidad** | OpenCode QA / Adversarial Reviewer | **Apto con Veredicto Favorable** | — |
| **Dirección de Tecnología / Usuario Administrador** | *Usuario / Administrador SIGPDA-EMS* | **PENDIENTE DE FIRMA** | — |

> **Nota Final**: Ningún cambio a `PLANEACION_ORCHESTRATOR_V2=true` será introducido en el repositorio hasta que la fila del Administrador cuente con visto bueno explícito.
