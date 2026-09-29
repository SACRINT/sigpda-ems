import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  parseConcentrado911Layout,
  calcularIndicadores911,
} from '../lib/concentrado-911-calculator';

describe('concentrado-911-calculator (H-220)', () => {
  const dir = path.resolve(
    '..',
    'documentos_referencia',
    '[05] Proyectos_PAEC_y_PMC',
    '911 y F11',
    'Heroes'
  );

  it('calcula ET y abandono con linea base oficial (inicio = 192, fin = 179/10)', () => {
    const calc = calcularIndicadores911({
      existenciaFin: 179,
      bajas: 10,
      matriculaInicio: 192,
      matriculaInicioFinDoc: 185,
    });

    expect(calc.eficienciaTerminal).toBe(93.2); // 179/192 * 100 = 93.229 -> 93.2%
    expect(calc.abandono).toBe(5.2);           // 10/192 * 100 = 5.208 -> 5.2%
    expect(calc.fuenteBaseline).toBe('911_inicio');
    expect(calc.warning).toBeUndefined();
  });

  it('usa fallback al inicio del periodo del concentrado de fin (185) con warning explicito', () => {
    const calc = calcularIndicadores911({
      existenciaFin: 179,
      bajas: 10,
      matriculaInicio: null, // Falta concentrado de inicio
      matriculaInicioFinDoc: 185,
    });

    expect(calc.eficienciaTerminal).toBe(96.8); // 179/185 * 100 = 96.756 -> 96.8%
    expect(calc.abandono).toBe(5.4);           // 10/185 * 100 = 5.405 -> 5.4%
    expect(calc.fuenteBaseline).toBe('911_fin_fallback');
    expect(calc.warning).toContain('calculado con la línea base del propio concentrado de fin');
  });

  it('retorna nulls y advertencia si falta concentrado de fin', () => {
    const calc = calcularIndicadores911({
      existenciaFin: null,
      bajas: null,
      matriculaInicio: 192,
    });

    expect(calc.eficienciaTerminal).toBeNull();
    expect(calc.abandono).toBeNull();
    expect(calc.warning).toContain('Falta concentrado de fin');
  });

  it('parsea correctamente el concentrado final real de 2025-2026', async () => {
    const p = path.join(dir, 'CONCENTRADO ESTADISTICO FINAL 2025-2026.pdf');
    if (!fs.existsSync(p)) return;

    const buf = fs.readFileSync(p);
    const parsed = await parseConcentrado911Layout(buf);

    expect(parsed.schoolCct).toBe('21EBH0200X');
    expect(parsed.schoolName).toContain('HEROES DE LA PATRIA');
    expect(parsed.tipoReporte).toBe('fin');
    expect(parsed.matriculaInicioFinDoc).toBe(185);
    expect(parsed.altas).toBe(4);
    expect(parsed.bajas).toBe(10);
    expect(parsed.existencia).toBe(179);
  });

  it('parsea correctamente el concentrado inicio real de 2026-2027', async () => {
    const p = path.join(dir, 'CONCENTRADO ESTADISTICO INICIO 2026-2027.pdf');
    if (!fs.existsSync(p)) return;

    const buf = fs.readFileSync(p);
    const parsed = await parseConcentrado911Layout(buf, { filename: 'CONCENTRADO ESTADISTICO INICIO 2026-2027.pdf' });

    expect(parsed.tipoReporte).toBe('inicio');
    expect(parsed.matriculaInicio).toBe(170);
  });

  it('detecta correctamente que el concentrado inicio 2025-2026 es escaneado (0 caracteres)', async () => {
    const p = path.join(dir, 'CONCENTRADO ESTADISTICO INICIO 2025-2026.pdf');
    if (!fs.existsSync(p)) return;

    const buf = fs.readFileSync(p);
    const parsed = await parseConcentrado911Layout(buf);

    expect(parsed.isScanned).toBe(true);
    expect(parsed.warnings[0]).toContain('escaneado');
  });

  it('extrae matricula de inicio de un plantel sintetico con matricula 105 sin numeros magicos', async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    doc.text('SECRETARÍA DE EDUCACIÓN DEL ESTADO DE PUEBLA', 20, 20);
    doc.text('NOMBRE OFICIAL DE LA ESCUELA SEGUN CATALOGO DE CENTROS DE TRABAJO', 20, 30);
    doc.text('BACHILLERATO GENERAL MOISES SAENZ', 20, 35);
    doc.text('21EBH9999Z', 100, 30);
    doc.text('2026-2027', 150, 30);
    doc.text('AL INICIO DEL PERIODO ESCOLAR', 50, 60);
    doc.text('GENERAL', 180, 50);
    doc.text('TOTAL', 50, 80);
    // Fila total: Hombres 45, Mujeres 60, Total 105
    doc.text('45', 160, 80);
    doc.text('60', 170, 80);
    doc.text('105', 180, 80);

    const buf = Buffer.from(doc.output('arraybuffer'));
    const parsed = await parseConcentrado911Layout(buf, { momento: 'inicio' });

    expect(parsed.schoolName).toContain('MOISES SAENZ');
    expect(parsed.schoolCct).toBe('21EBH9999Z');
    expect(parsed.matriculaInicio).toBe(105);
  });
});

