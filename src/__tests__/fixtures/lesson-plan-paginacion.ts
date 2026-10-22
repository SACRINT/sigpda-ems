/**
 * Fixture: plan de clase REAL de peor caso (30 líneas no vacías / ~4 900 caracteres),
 * tomado de la BD (`planning_extras`, sesión 1 de Pensamiento Matemático III) y
 * ANONIMIZADO (nombres de localidad → "la comunidad local") para los tests de
 * paginación de PDF de extras.
 *
 * Con el motor anterior (page-break en `y > pageHeight - 16` sin densificación) este
 * documento terminaba en una hoja 2 casi vacía; hoy debe caber en UNA sola página.
 */

const RAW = `# PLAN DE CLASE OFICIAL MCCEMS · SESIÓN 1
**UAC:** Pensamiento Matemático III. Pensamientos algebraico e introducción a geometría plana | **Semestre:** 3° | **Sesión:** 1 de 24 (50 min)
**Título de la Sesión:** Sesión 1: Exploración Diagnóstica y Problematización Situada · Ecuaciones lineales y situaciones de interés
**Propósito / Meta de Aprendizaje:** Consolidar: Cuestionario diagnóstico y mapa conceptual inicial (Apertura)
**Transversalidad Comunitaria (PAEC):** Vinculación PAEC: La vulnerabilidad de los jóvenes ante conductas de riesgo, derivada de la falta de espacios recreativos, hábitos de vida poco saludables y un entorno con factores de estrés socioeconómico, así como la normalización del consumo temprano de alcohol en eventos sociales y festividades tradicionales.. Impacto escolar y comunitario.

---

## SECUENCIA DIDÁCTICA DE LA SESIÓN (50 MINUTOS)

### 1. Fase de Apertura (15 min) — Activación y Recuperación
- **Rol del Docente:** Presentación del detonador situado y dinamización de saberes previos con preguntas generadoras.
- **Rol del Estudiante:** Análisis de la problemática comunitaria, lluvia de ideas y planteamiento de hipótesis iniciales.
- **Saberes Previos y Conexión Intuitiva:** Analogía cotidiana: Piensa en una balanza algebraica digital de precisión, un dispositivo moderno donde colocas pesos en ambos lados de una pantalla digital para mantener un equilibrio perfecto. Si en el platillo izquierdo tienes una cantidad desconocida de kilogramos de frijol representada por una letra 'x' junto con dos pesas sueltas de 5 kilogramos cada una, y en el platillo derecho tienes exactamente 18 kilogramos, el sistema digital te muestra gráficamente si hay balanza o desequilibrio. Para descubrir cuánto pesa la incógnita 'x', debes realizar operaciones idénticas en ambos lados de la balanza: retirar la misma cantidad de peso o ajustar simétricamente el valor digital. Si quitas 5 kilogramos de la izquierda, obligatoriamente debes quitar 5 kilogramos de la derecha para que la pantalla siga marcando 'EQUILIBRIO'. Este principio intuitivo de compensación y simetría es exactamente el alma de cualquier ecuación lineal en matemáticas.

### 2. Fase de Desarrollo (25 min) — Aprendizaje Pertinente y Modelado
- **Rol del Docente (Modelado y Acompañamiento):** Modelado introductorio: Voy a guiarte paso a paso en el proceso completo de modelación, resolución y representación gráfica de una situación problemática real vinculada con la economía de la comunidad local.
- **Rol del Estudiante (Práctica y Reto Autónomo):** Exploración inicial grupal: Es momento de trabajar colaborativamente aplicando los roles cooperativos que has aprendido: Modelador, Graficador, Verificador y Relator. R... Libro del estudiante: estudia "Vas a explorar tus saberes previos sobre la igualdad matemática y a problematizar situaciones reales de costos agrícolas en la comunidad local mediante preguntas socráticas." — lee la teoría y el ejemplo resuelto, resuelve 2 ejercicio(s) de práctica con pistas y registra tu evidencia.
Ejercicios de la sesión (mismos enunciados que el libro y el solucionario docente):
1. En la cooperativa agrícola, el costo de un rollo de malla para cercar hortalizas más 250 pesos de flete suma 1250 pesos. Plantea y resuelve la ecuación. Pista: Representa el costo de la malla con 'x' y suma el flete igualándolo al total.
2. Un agricultor compra herramientas cuyo costo total se modela como x - 180 = 820. Encuentra el valor de 'x'. Pista: Aplica la propiedad de la suma para eliminar el término negativo.
- **Metodología Activa Aplicada:** Aprendizaje Basado en Retos y Modelado Cognitivo (I Do - We Do - You Do)
- **Recursos e Insumos Didácticos:** Cuaderno de Trabajo Activo del estudiante, bitácora de taller/laboratorio, instrumental didáctico.

### 3. Fase de Cierre (10 min) — Consolidación y Metacognición
- **Rol del Docente:** Semáforo de autoevaluación: ¿De qué manera el uso correcto de las propiedades de la igualdad en una ecuación lineal te otorga seguridad y transparencia al resolver problemas financieros o comunitarios?.
- **Rol del Estudiante:** Responder la verificación inicial y reflexionar: ¿Identifiqué con claridad la diferencia entre un término independiente y un coeficiente al resolver la ecuación?.
- **Evaluación Formativa:** Lista de cotejo diagnóstica
- **Pregunta Metacognitiva:** ¿Identifiqué con claridad la diferencia entre un término independiente y un coeficiente al resolver la ecuación? ¿Pude relacionar el concepto de balanza algebraica con el proceso de despejar una incógnita sin alterar el equilibrio?

---

## EVALUACIÓN Y PRODUCTO ESPERADO
- **Evidencia Tangible de la Sesión:** Cuestionario diagnóstico y mapa conceptual inicial
- **Instrumento de Evaluación Oficial:** Lista de cotejo diagnóstica · Sesión 1

---
*SIGPDA-EMS · Documento derivado en cascada del Cuaderno de Trabajo Activo (Bloque 1)*`;

export const LESSON_PLAN_FIXTURE_MD = RAW;
export const LESSON_PLAN_FIXTURE_LINES = RAW.split('\n').filter(
  (line) => line.trim() && line.trim() !== '---'
);
