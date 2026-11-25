'use client';

import type React from 'react';
import { toRealNumber } from '@/lib/numeric-guard';
import { normalizePmcCategoria } from '@/lib/constants/pmc-categorias';
import { computeRecommendedReprobacionMeta, resolveBajasPercentage } from '@/lib/qa/paec-pmc-semantic-qa';
import { reconcilePmcStaff, derivePersonalMetasFromStaff } from '@/lib/pmc/staff-reconciler';
import {
  mergePaecIntoDiagnostic,
  preservePaecOnPmcLoad,
  buildPaecDiagnosticParts,
  countPlantelFields,
  getPaecIngestionSummary,
} from '@/lib/pmc/paec-diagnostic-fusion';
import {
  mapInicioActualToIndicadores,
  mapInicioAnteriorToIndicadores,
} from '@/lib/pmc/indicadores-mapping';
import {
  deriveMetasPreviasFromElementos,
  deriveElementosFromMetasPrevias,
  calculatePmcCoverage,
  cleanPmcPlaceholders,
} from '@/lib/pmc/plan-element-normalizer';
import { synthesizeSituatedFoda } from '@/lib/pmc/pmc-foda-synthesizer';
import type { PmcAuditCalculationEntry } from '@/types/pmc';
import {
  parseSafeApiResponse,
  extractF11Warnings,
  format911FinAnteriorBanner,
  CATEGORIAS_OFICIALES,
  type PmcPreviousExtractDTO,
  type EditablePlanElement,
  type CategoriaPriorizada,
  type F11ResponseDTO,
  type Estadistica911ResponseDTO,
} from './helpers';
import type { PmcWizardState } from './usePmcWizardState';

export function usePmcFileIngest(state: PmcWizardState) {
  const {
    setError,
    schoolName,
    setSchoolName,
    schoolCct,
    setSchoolCct,
    municipality,
    setMunicipality,
    locality,
    setLocality,
    schoolZone,
    setSchoolZone,
    directorName,
    setDirectorName,
    directorSource,
    setDirectorSource,
    setDirectorMismatchWarning,
    setAlternativeDirector,
    isPlatformPmcDoc,
    setIsPlatformPmcDoc,
    supervisorName,
    setSupervisorName,
    cicloEscolar,
    setCicloEscolar,
    setSubsystem,
    totalStaff,
    setTotalStaff,
    staffData,
    setStaffData,
    diagnosticoComunidad,
    setDiagnosticoComunidad,
    indicadores,
    setIndicadores,
    setMetasConfirmadas,
    setMetasMateriasConfirmadas,
    setFoda,
    setCategoriasPriorizadas,
    setPlanAccion,
    setMetasPreviasReferencia,
    fileInputPmcRef,
    setUploadingPmc,
    parsedPmcData,
    setParsedPmcData,
    editableElementosPlan,
    setEditableElementosPlan,
    setIngestWarnings,
    setF11Warnings,
    ingestCoverage,
    setIngestCoverage,
    setShowPmcReviewModal,
    fileInputPaecRef,
    setUploadingPaec,
    fileInputF11Ref,
    fileInput911Ref,
    uploadMomentoRef,
    setActiveMomento911,
    setUploadingF11,
    setUploading911,
    setDocsStatus,
    setSuccessBanner,
  } = state;

  const triggerUpload911 = (momento: 'inicio_anterior' | 'fin_anterior' | 'inicio_actual') => {
    uploadMomentoRef.current = momento;
    setActiveMomento911(momento);
    fileInput911Ref.current?.click();
  };

  const handleUploadPreviousPmc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isPlatformDoc = file.name.startsWith('PMC_Oficial_') || file.name.includes('PMC_Oficial_');
    setIsPlatformPmcDoc(isPlatformDoc);
    setUploadingPmc(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/pmc/parse-previous', {
        method: 'POST',
        body: formData,
      });
      const json = await parseSafeApiResponse<{
        success?: boolean;
        error?: string;
        data?: PmcPreviousExtractDTO;
        warnings?: string[];
        coverage?: {
          detectados: number | null;
          extraidos: number;
          parcial: boolean;
          indeterminada?: boolean;
          ratio?: number;
          esperado?: number;
          detalles?: {
            metas: { detectados: number | null; extraidos: number; parcial: boolean; indeterminada?: boolean };
            actividades: { detectados: number | null; extraidos: number; parcial: boolean; indeterminada?: boolean };
          };
        };
      }>(
        res,
        'Error al analizar el documento anterior.'
      );
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al analizar el documento.');
      }
      const rawElementos = (json.data?.elementos_plan && json.data.elementos_plan.length > 0)
        ? json.data.elementos_plan
        : deriveElementosFromMetasPrevias(json.data?.metas_institucionales_previas || []);

      const elementsToEdit: EditablePlanElement[] = rawElementos.map(e => ({
        tipo: (e.tipo as EditablePlanElement['tipo']) || 'otro',
        texto_original: e.texto_original || '',
        texto_normalizado: e.texto_normalizado || e.texto_original || '',
        categoria: e.categoria || '',
        tema: e.tema || '',
        responsable: e.responsable || '',
        periodo: e.periodo || '',
        requiere_revision: Boolean(e.requiere_revision),
      }));

      const warningsList = Array.isArray(json.warnings) ? [...json.warnings] : [];
      if (isPlatformDoc) {
        warningsList.unshift('Documento generado por la plataforma detectado ("PMC_Oficial_"): se omiten director e indicadores para evitar sobreescritura recursiva.');
      }

      setParsedPmcData(json.data as PmcPreviousExtractDTO);
      setEditableElementosPlan(elementsToEdit);
      setIngestWarnings(warningsList);
      setIngestCoverage(json.coverage || null);
      setShowPmcReviewModal(true);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'No se pudo procesar el documento anterior.';
      setError(errMsg);
    } finally {
      setUploadingPmc(false);
      if (fileInputPmcRef.current) fileInputPmcRef.current.value = '';
    }
  };

  const handleDirectorNameChange = (val: string) => {
    setDirectorName(val);
    setDirectorSource('manual');
    setDirectorMismatchWarning(null);
    setStaffData(prev => {
      if (prev.length === 0) {
        return [{ nombre: val, cargo: 'Director(a)', meta_individual: '', metas_individuales: [] }];
      }
      const dirIdx = prev.findIndex(s => s.cargo === 'Director(a)');
      if (dirIdx >= 0) {
        const copy = [...prev];
        copy[dirIdx] = { ...copy[dirIdx], nombre: val };
        return copy;
      }
      return [{ nombre: val, cargo: 'Director(a)', meta_individual: '', metas_individuales: [] }, ...prev];
    });
  };

  const updateEditableElemento = (index: number, patch: Partial<EditablePlanElement>) => {
    setEditableElementosPlan(prev => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], ...patch };
      }
      return next;
    });
  };

  const handleApplyParsedPmc = () => {
    if (!parsedPmcData) return;
    if (parsedPmcData.schoolName) setSchoolName(parsedPmcData.schoolName);
    if (parsedPmcData.schoolCct) setSchoolCct(parsedPmcData.schoolCct);
    if (parsedPmcData.municipality) setMunicipality(parsedPmcData.municipality);
    if (parsedPmcData.locality) setLocality(parsedPmcData.locality);
    if (parsedPmcData.schoolZone) setSchoolZone(parsedPmcData.schoolZone);
    if (!isPlatformPmcDoc && parsedPmcData.directorName) {
      const docDir = parsedPmcData.directorName.trim();
      if (directorName && docDir.toLowerCase() !== directorName.trim().toLowerCase()) {
        setAlternativeDirector({ name: directorName, source: directorSource });
      }
      setDirectorName(docDir);
      setDirectorSource('pmc_anterior');
      setDirectorMismatchWarning(null);
    }
    if (parsedPmcData.supervisorName) setSupervisorName(parsedPmcData.supervisorName);
    if (parsedPmcData.cicloEscolar) setCicloEscolar(parsedPmcData.cicloEscolar);
    if (parsedPmcData.subsystem) setSubsystem(parsedPmcData.subsystem);

    // C1: Derivar metas e insumos a partir de los elementos editados por el usuario
    const finalElementsForDerivation = editableElementosPlan.map(e => ({
      tipo: e.tipo,
      texto_original: e.texto_original,
      texto_normalizado: cleanPmcPlaceholders(e.texto_normalizado),
      categoria: e.categoria || '',
      tema: e.tema || '',
      responsable: e.responsable || '',
      periodo: e.periodo || '',
      ubicacion: {},
      requiere_revision: e.requiere_revision || false,
    }));

    const effDirector = (!isPlatformPmcDoc && parsedPmcData.directorName) || directorName;
    const hasExtractedStaff = Array.isArray(parsedPmcData.staffData) && parsedPmcData.staffData.length > 0;
    const reconciled = reconcilePmcStaff({
      existingStaff: hasExtractedStaff ? [] : staffData,
      extractedStaff: parsedPmcData.staffData,
      participantes: parsedPmcData.participantes,
      directorName: effDirector,
      targetTotalStaff: parsedPmcData.totalStaff ? Number(parsedPmcData.totalStaff) : undefined,
      cicloEscolar: parsedPmcData.cicloEscolar || cicloEscolar,
      elementosPlan: finalElementsForDerivation,
    });
    setStaffData(reconciled.staff);
    setTotalStaff(reconciled.totalStaff);

    // Derivar y precargar metas individuales SMART para la plantilla consolidada
    const derivedFromExtract = derivePersonalMetasFromStaff(
      reconciled.staff,
      parsedPmcData.cicloEscolar || cicloEscolar
    );
    setPlanAccion(prev => ({
      metas_institucionales: prev?.metas_institucionales || [],
      metas_personales: derivedFromExtract,
    }));

    const derivedFromEdited = deriveMetasPreviasFromElementos(
      finalElementsForDerivation,
      parsedPmcData.metas_institucionales_previas
    );

    // Adjuntar texto_original a cada meta para trazabilidad H-052 en panel de continuidad
    const metasWithOriginal = derivedFromEdited.map(dm => {
      const matchingElem = finalElementsForDerivation.find(
        fe => fe.tipo === 'meta' && (fe.texto_normalizado === dm.meta || fe.texto_original === dm.meta)
      );
      return {
        ...dm,
        texto_original: matchingElem?.texto_original || dm.meta,
      };
    });

    if (metasWithOriginal.length > 0) {
      setMetasPreviasReferencia(metasWithOriginal);
    }

    // Auto-activar las categorías y temas priorizados a partir del PMC anterior
    const detectedCategoriesMap = new Map<string, Set<string>>();
    for (const cp of (parsedPmcData.categorias_priorizadas || [])) {
      if (cp?.categoria) {
        const catNorm = normalizePmcCategoria(cp.categoria);
        if (!detectedCategoriesMap.has(catNorm)) detectedCategoriesMap.set(catNorm, new Set());
        for (const t of (cp.temas || [])) {
          detectedCategoriesMap.get(catNorm)!.add(t);
        }
      }
    }
    for (const m of (parsedPmcData.metas_institucionales_previas || [])) {
      if (m?.categoria) {
        const catNorm = normalizePmcCategoria(m.categoria);
        if (!detectedCategoriesMap.has(catNorm)) detectedCategoriesMap.set(catNorm, new Set());
        if (m.tema) detectedCategoriesMap.get(catNorm)!.add(m.tema);
      }
    }

    if (detectedCategoriesMap.size > 0) {
      const newCategorias: CategoriaPriorizada[] = [];
      for (const catDef of CATEGORIAS_OFICIALES) {
        const catNorm = normalizePmcCategoria(catDef.nombre);
        if (detectedCategoriesMap.has(catNorm)) {
          const matchedTemas = Array.from(detectedCategoriesMap.get(catNorm)!);
          const validTemas = catDef.temas.filter((officialTema) =>
            matchedTemas.some(
              (mt) =>
                mt.toLowerCase().includes(officialTema.toLowerCase()) ||
                officialTema.toLowerCase().includes(mt.toLowerCase())
            )
          );
          newCategorias.push({
            id: catDef.id,
            nombre: catDef.nombre,
            temas: validTemas.length > 0 ? validTemas : [catDef.temas[0]],
          });
        }
      }
      if (newCategorias.length > 0) {
        setCategoriasPriorizadas(newCategorias);
      }
    }

    if (parsedPmcData.diagnosticoComunidad) {
      setDiagnosticoComunidad(prev => preservePaecOnPmcLoad(parsedPmcData.diagnosticoComunidad!, prev));
    }

    // H-218: Merge POR CAMPO de indicadores. PMC anterior solo llena campos vacíos y no pisa F11/911.
    if (!isPlatformPmcDoc && parsedPmcData.indicadores) {
      const ind = parsedPmcData.indicadores;
      setIndicadores(prev => ({
        ...prev,
        matricula: prev.matricula ?? toRealNumber(ind.matricula),
        matricula_meta: prev.matricula_meta ?? toRealNumber(ind.matricula_meta),
        aprobacion_ant: prev.aprobacion_ant ?? toRealNumber(ind.aprobacion_ant),
        aprobacion_meta: prev.aprobacion_meta ?? toRealNumber(ind.aprobacion_meta),
        reprobacion_ant: prev.reprobacion_ant ?? toRealNumber(ind.reprobacion_ant),
        reprobacion_meta: prev.reprobacion_meta ?? toRealNumber(ind.reprobacion_meta),
        abandono_ant: prev.abandono_ant ?? toRealNumber(ind.abandono_ant),
        abandono_meta: prev.abandono_meta ?? toRealNumber(ind.abandono_meta),
        et_ant: prev.et_ant ?? toRealNumber(ind.et_ant),
        et_meta: prev.et_meta ?? toRealNumber(ind.et_meta),
        promedio_f11: prev.promedio_f11 ?? toRealNumber(ind.promedio_f11),
        promedio_meta: prev.promedio_meta ?? toRealNumber(ind.promedio_meta),
      }));
    }

    if (parsedPmcData.foda) {
      const normalizeFodaField = (val: unknown): string => {
        if (!val) return '';
        if (Array.isArray(val)) {
          return val.map(item => String(item).trim()).filter(Boolean).join('\n• ');
        }
        return String(val).trim();
      };
      setFoda(prev => ({
        fortalezas: normalizeFodaField(parsedPmcData.foda?.fortalezas) || prev.fortalezas,
        oportunidades: normalizeFodaField(parsedPmcData.foda?.oportunidades) || prev.oportunidades,
        debilidades: normalizeFodaField(parsedPmcData.foda?.debilidades) || prev.debilidades,
        amenazas: normalizeFodaField(parsedPmcData.foda?.amenazas) || prev.amenazas,
      }));
    }

    // H-282: Recalcular cobertura viva desde los elementos editados en el modal
    const metasEditadasCount = editableElementosPlan.filter(e => e.tipo === 'meta').length;
    const totalElementosEditados = editableElementosPlan.length;
    const updatedCoverage = calculatePmcCoverage(
      parsedPmcData.totales_detectados,
      metasEditadasCount,
      totalElementosEditados,
      ingestCoverage?.esperado ?? parsedPmcData.expectedActivities
    );
    setIngestCoverage(updatedCoverage);

    setShowPmcReviewModal(false);
    setDocsStatus(p => ({ ...p, pmcAnt: true }));
    setSuccessBanner('✓ Datos del PMC anterior cargados y pre-llenados exitosamente en todos los pasos.');
  };

  // ── F11 Upload Handler (Fin de Ciclo Anterior) ──────────────────────────────
  const handleUploadF11 = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingF11(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/pmc/f11', { method: 'POST', body: formData });
      const json = await parseSafeApiResponse<{ success?: boolean; error?: string; data?: F11ResponseDTO }>(
        res,
        'Error al analizar el F11.'
      );
      if (!res.ok || !json.success) throw new Error(json.error || 'Error al analizar el F11.');
      // H-240 / H-255: capture F11 layout warnings (column mismatch, zip truncation) and surface to user
      const extractedWarnings = extractF11Warnings(json as { warnings?: string[] });
      setF11Warnings(extractedWarnings);
      if (json.data?.schoolName && !schoolName) setSchoolName(json.data.schoolName);
      if (json.data?.schoolCct && !schoolCct) setSchoolCct(json.data.schoolCct);

      const docDirF11 = json.data?.directorName?.trim();
      if (docDirF11) {
        if (directorSource === 'manual') {
          if (directorName && docDirF11.toLowerCase() !== directorName.trim().toLowerCase()) {
            setDirectorMismatchWarning(`Aviso: El director en F11 ("${docDirF11}") difiere del ingresado manualmente ("${directorName}"). Se mantiene la edición manual.`);
          }
        } else if (directorSource === 'bd') {
          if (directorName && docDirF11.toLowerCase() !== directorName.trim().toLowerCase()) {
            setDirectorMismatchWarning(`Aviso: El director en F11 ("${docDirF11}") difiere del registrado en BD ("${directorName}"). Se mantiene el valor de BD.`);
          }
        } else {
          setDirectorName(docDirF11);
          setDirectorSource('f11');
          setDirectorMismatchWarning(null);
        }
      }

      // H-F11-UI-001: Activar actualización de indicadores cuando cualquier dato cuantitativo del F11 esté disponible
      // (no solo porcentajes — en fallback OCR el totalAlumnos llega aunque los porcentajes sean null)
      if (json.data?.totalAlumnos != null || json.data?.aprobadosPorcentaje !== undefined || json.data?.reprobadosPorcentaje !== undefined || json.data?.promedioGeneral !== undefined) {
        setIndicadores(p => {
          const rawAp = json.data?.aprobadosPorcentaje ?? json.data?.porcentajes?.aprobados;
          const rawRep = json.data?.reprobadosPorcentaje ?? json.data?.porcentajes?.reprobados;
          const aprobAnt = toRealNumber(rawAp) ?? p.aprobacion_ant;
          const reprobAnt = toRealNumber(rawRep) ?? p.reprobacion_ant;
          const aprobMeta = p.aprobacion_meta !== undefined && p.metas_confirmadas
            ? p.aprobacion_meta
            : (aprobAnt !== undefined && !isNaN(aprobAnt)
                ? Math.min(100, Math.round((aprobAnt + 5) * 10) / 10)
                : undefined);
          const bajasPctF11 = resolveBajasPercentage({
            ...(p as unknown as Record<string, unknown>),
            porcentajes: json.data?.porcentajes ?? p.porcentajes,
            bajas: json.data?.bajas ?? p.bajas,
            totalAlumnosF11: json.data?.totalAlumnos ?? p.totalAlumnosF11 ?? p.matricula,
            aprobacion_ant: aprobAnt,
            reprobacion_ant: reprobAnt,
          });
          const reprobMeta = p.reprobacion_meta !== undefined && p.metas_confirmadas
            ? p.reprobacion_meta
            : computeRecommendedReprobacionMeta({
                aprobacionMeta: aprobMeta,
                reprobacionAnt: reprobAnt,
                bajasPct: bajasPctF11,
              });

          const nowIso = new Date().toISOString();
          const newCalc: Record<string, PmcAuditCalculationEntry> = { ...(p._calc || {}) };
          const reg = json.data?.regulares ?? p.regulares;
          const irreg = json.data?.irregulares ?? p.irregulares;
          const tot = json.data?.totalAlumnos ?? p.totalAlumnosF11 ?? p.matricula;
          const rep = json.data?.reprobados ?? p.reprobados;

          if (aprobAnt !== undefined) {
            const formulaAprob = (reg !== undefined && irreg !== undefined && tot)
              ? `(${reg} Regulares + ${irreg} Irregulares) / ${tot} = ${aprobAnt}%`
              : `Aprobación reportada en F11 = ${aprobAnt}%`;
            newCalc.aprobacion_ant = {
              valor: aprobAnt,
              formula: formulaAprob,
              fuentes: ['F11 Fin Ciclo Anterior'],
              fecha: nowIso,
            };
          }
          if (reprobAnt !== undefined) {
            const formulaReprob = (rep !== undefined && tot)
              ? `${rep} Reprobados / ${tot} = ${reprobAnt}%`
              : `Reprobación reportada en F11 = ${reprobAnt}%`;
            newCalc.reprobacion_ant = {
              valor: reprobAnt,
              formula: formulaReprob,
              fuentes: ['F11 Fin Ciclo Anterior'],
              fecha: nowIso,
            };
          }

          const baj = json.data?.bajas ?? p.bajas;
          const pctReg = json.data?.porcentajes?.regulares;
          const pctIrreg = json.data?.porcentajes?.irregulares;
          const pctBaj = json.data?.porcentajes?.bajas;

          if (reg !== undefined && tot) {
            newCalc.regulares = {
              valor: reg,
              formula: `${reg} alumnos regulares / ${tot} = ${pctReg ?? Number(((reg / tot) * 100).toFixed(1))}%`,
              fuentes: ['F11 Fin Ciclo Anterior'],
              fecha: nowIso,
            };
          }
          if (irreg !== undefined && tot) {
            newCalc.irregulares = {
              valor: irreg,
              formula: `${irreg} alumnos irregulares / ${tot} = ${pctIrreg ?? Number(((irreg / tot) * 100).toFixed(1))}%`,
              fuentes: ['F11 Fin Ciclo Anterior'],
              fecha: nowIso,
            };
          }
          if (baj !== undefined && tot) {
            newCalc.bajas = {
              valor: baj,
              formula: `${baj} bajas registradas ("B") / ${tot} = ${pctBaj ?? Number(((baj / tot) * 100).toFixed(1))}%`,
              fuentes: ['F11 Fin Ciclo Anterior'],
              fecha: nowIso,
            };
          }

          const materias = Array.isArray(json.data?.reprobacionPorMateria)
            ? json.data.reprobacionPorMateria.map(m => ({
                materia: m.materia,
                n: m.n,
                reprobados: m.reprobados,
                porcentaje: m.porcentaje,
                porcentajeAprobacion: m.porcentajeAprobacion,
                metaSugerida: m.metaSugerida,
                metaUsuario: m.metaUsuario !== undefined ? m.metaUsuario : m.metaSugerida,
                metaConfirmada: false,
                detallePorGrupo: m.detallePorGrupo as Record<string, { n: number; reprobados: number; porcentajeReprobacion: number }> | undefined,
              }))
            : p.reprobacionPorMateria;

          return {
            ...p,
            aprobacion_ant: aprobAnt,
            reprobacion_ant: reprobAnt,
            aprobacion_meta: aprobMeta,
            reprobacion_meta: reprobMeta,
            promedio_f11: toRealNumber(json.data?.promedioGeneral) ?? p.promedio_f11,
            matricula: p.matricula || (json.data?.totalAlumnos ? Number(json.data.totalAlumnos) : undefined),
            totalAlumnosF11: json.data?.totalAlumnos ?? p.totalAlumnosF11,
            aprobados: json.data?.aprobados ?? p.aprobados,
            regulares: json.data?.regulares ?? p.regulares,
            irregulares: json.data?.irregulares ?? p.irregulares,
            reprobados: json.data?.reprobados ?? p.reprobados,
            bajas: json.data?.bajas ?? p.bajas,
            porcentajes: json.data?.porcentajes ?? p.porcentajes,
            reprobacionPorMateria: materias,
            _calc: newCalc,
            metas_confirmadas: false,
          };
        });
        setMetasConfirmadas(false);
        setMetasMateriasConfirmadas(false);
      }

      // H-005: Enlazar asignaturas críticas detectadas en F11 al FODA
      if (json.data?.promediosPorAsignatura && typeof json.data.promediosPorAsignatura === 'object') {
        const entries = Object.entries(json.data.promediosPorAsignatura as Record<string, number>);
        if (entries.length > 0) {
          const critical = entries
            .filter(([, avg]) => typeof avg === 'number' && avg < 7.5)
            .map(([subj, avg]) => `${subj} (promedio ${avg})`)
            .slice(0, 4)
            .join(', ');
          if (critical) {
            setFoda(prev => ({
              ...prev,
              debilidades: prev.debilidades
                ? `${prev.debilidades}\n- Asignaturas de atención prioritaria según F11: ${critical}`
                : `Asignaturas de atención prioritaria según F11: ${critical}`,
            }));
          }
        }
      }

      // Reconciliación arquitectónica de plantilla docente desde F11
      const effDirector = json.data?.directorName || directorName;
      const targetCount = json.data?.totalDocentes ? Number(json.data.totalDocentes) : totalStaff;
      const reconciled = reconcilePmcStaff({
        existingStaff: staffData,
        f11Docentes: json.data?.docentesPorAsignatura,
        docentesList: json.data?.docentes,
        directorName: effDirector,
        targetTotalStaff: targetCount,
        cicloEscolar,
      });
      setStaffData(reconciled.staff);
      setTotalStaff(reconciled.totalStaff);

      setDocsStatus(p => ({ ...p, f11: true }));
      setSuccessBanner(`✓ F11 Fin Ciclo Anterior cargado: ${json.data?.totalAlumnos ?? 'N/D'} alumnos evaluados, promedio general ${json.data?.promedioGeneral ?? 'N/D'}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar el F11.');
    } finally {
      setUploadingF11(false);
      if (fileInputF11Ref.current) fileInputF11Ref.current.value = '';
    }
  };

  // ── Estadística 911 Upload Handler (con soporte de 3 momentos) ──────────────
  const handleUpload911 = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const momento = uploadMomentoRef.current;
    setUploading911(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('momento', momento);
      const res = await fetch('/api/pmc/estadistica-911', { method: 'POST', body: formData });
      const json = await parseSafeApiResponse<{ success?: boolean; error?: string; data?: Estadistica911ResponseDTO }>(
        res,
        'Error al analizar la Estadística 911.'
      );
      if (!res.ok || !json.success) throw new Error(json.error || 'Error al analizar la Estadística 911.');
      if (json.data?.schoolName && !schoolName) setSchoolName(json.data.schoolName);
      if (json.data?.schoolCct && !schoolCct) setSchoolCct(json.data.schoolCct);
      if (json.data?.supervisorName && !supervisorName) setSupervisorName(json.data.supervisorName);

      const docDir911 = json.data?.directorName?.trim();
      if (docDir911) {
        if (directorSource === 'manual') {
          if (directorName && docDir911.toLowerCase() !== directorName.trim().toLowerCase()) {
            setDirectorMismatchWarning(`Aviso: El director en Estadística 911 ("${docDir911}") difiere del ingresado manualmente ("${directorName}"). Se mantiene la edición manual.`);
          }
        } else if (directorSource === 'bd') {
          if (directorName && docDir911.toLowerCase() !== directorName.trim().toLowerCase()) {
            setDirectorMismatchWarning(`Aviso: El director en Estadística 911 ("${docDir911}") difiere del registrado en BD ("${directorName}"). Se mantiene el valor de BD.`);
          }
        } else {
          setDirectorName(docDir911);
          setDirectorSource('911');
          setDirectorMismatchWarning(null);
        }
      }

      const syncStaffFrom911 = (totalDocs?: number) => {
        if (!totalDocs || isNaN(Number(totalDocs))) return;
        const effDirector = json.data?.directorName || directorName;
        const reconciled = reconcilePmcStaff({
          existingStaff: staffData,
          directorName: effDirector,
          targetTotalStaff: Number(totalDocs),
          cicloEscolar,
        });
        setStaffData(reconciled.staff);
        setTotalStaff(reconciled.totalStaff);
      };

      if (momento === 'fin_anterior') {
        // H-239 / H-253: Compute ET/Ab OUTSIDE the updater using the captured `indicadores` value from the
        // handler closure. React 19 may defer updater evaluation when prior setState calls are
        // scheduled in the same event, causing calculatedEt to be undefined at banner time.
        const { banner, mapped } = format911FinAnteriorBanner(json.data, indicadores);
        setIndicadores(() => mapped);
        if (json.data?.totalDocentes) syncStaffFrom911(json.data.totalDocentes);
        setDocsStatus(p => ({ ...p, n911FinAnt: true }));
        setSuccessBanner(banner);

      } else if (momento === 'inicio_actual') {
        setIndicadores(p => mapInicioActualToIndicadores(json.data, p));
        if (json.data?.totalDocentes) syncStaffFrom911(json.data.totalDocentes);
        setDocsStatus(p => ({ ...p, n911IniAct: true }));
        const mat = json.data?.matriculaInicio ?? json.data?.matricula ?? 'N/D';
        setSuccessBanner(`✓ 911 (Inicio Ciclo Actual) cargada: Matrícula vigente de ${mat} alumnos`);
      } else {
        // inicio_anterior
        setIndicadores(p => mapInicioAnteriorToIndicadores(json.data, p));
        setDocsStatus(p => ({ ...p, n911IniAnt: true }));
        const mat = json.data?.matriculaInicio ?? json.data?.matricula ?? 'N/D';
        setSuccessBanner(`✓ 911 (Inicio Ciclo Anterior) cargada: Matrícula inicial de ${mat} alumnos`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar la Estadística 911.');
    } finally {
      setUploading911(false);
      setActiveMomento911(null);
      if (fileInput911Ref.current) fileInput911Ref.current.value = '';
    }
  };

  // Carga Inteligente de PAEC Anterior (PDF/Word) en Paso 1 (H-155)
  const handleUploadPreviousPaec = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPaec(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/paec/parse-previous', {
        method: 'POST',
        body: formData,
      });
      const json = await parseSafeApiResponse<{
        success?: boolean;
        error?: string;
        data?: {
          projectName?: string | null;
          problemStatement?: string | null;
          school?: {
            schoolName?: string | null;
            cct?: string | null;
            municipality?: string | null;
            locality?: string | null;
            schoolZone?: string | null;
            directorName?: string | null;
            supervisorName?: string | null;
          };
          community?: {
            context?: string | null;
            location?: string | null;
            problematics?: string | null;
            economicActivities?: string | null;
            culturalAspects?: string | null;
          };
        };
      }>(
        res,
        'Error al analizar el documento PAEC anterior.'
      );
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error || 'Error al procesar el archivo PAEC.');
      }

      const pData = json.data;
      const sCtx = pData.school || {};
      const cCtx = pData.community || {};

      if (typeof sCtx.schoolName === 'string' && sCtx.schoolName && !schoolName) setSchoolName(sCtx.schoolName);
      if (typeof sCtx.cct === 'string' && sCtx.cct && !schoolCct) setSchoolCct(sCtx.cct);
      if (typeof sCtx.supervisorName === 'string' && sCtx.supervisorName && !supervisorName) setSupervisorName(sCtx.supervisorName);
      if (typeof sCtx.schoolZone === 'string' && sCtx.schoolZone && !schoolZone) setSchoolZone(sCtx.schoolZone);
      if (typeof sCtx.municipality === 'string' && sCtx.municipality && !municipality) setMunicipality(sCtx.municipality);
      if (typeof sCtx.locality === 'string' && sCtx.locality && !locality) setLocality(sCtx.locality);

      const docDirPaec = typeof sCtx.directorName === 'string' ? sCtx.directorName.trim() : '';
      if (docDirPaec) {
        if (directorSource === 'manual') {
          if (directorName && docDirPaec.toLowerCase() !== directorName.trim().toLowerCase()) {
            setDirectorMismatchWarning(`Aviso: El director en PAEC ("${docDirPaec}") difiere del ingresado manualmente ("${directorName}"). Se mantiene la edición manual.`);
          }
        } else if (directorSource === 'bd') {
          if (directorName && docDirPaec.toLowerCase() !== directorName.trim().toLowerCase()) {
            setDirectorMismatchWarning(`Aviso: El director en PAEC ("${docDirPaec}") difiere del registrado en BD ("${directorName}"). Se mantiene el valor de BD.`);
          }
        } else {
          setDirectorName(docDirPaec);
          setDirectorSource('paec');
          setDirectorMismatchWarning(null);
        }
      }

      const plantelFieldsExtracted = countPlantelFields(sCtx);

      const paecDiagParts = buildPaecDiagnosticParts(
        {
          context: cCtx.context,
          location: cCtx.location,
          problematics: cCtx.problematics,
          economicActivities: cCtx.economicActivities,
        },
        {
          projectName: pData.projectName,
          problemStatement: pData.problemStatement,
        }
      );

      const summary = getPaecIngestionSummary(paecDiagParts.length, plantelFieldsExtracted);

      if (summary.isSuccess) {
        if (paecDiagParts.length > 0) {
          const combined = paecDiagParts.join('\n\n');
          setDiagnosticoComunidad(prev => mergePaecIntoDiagnostic(prev, combined));
        }
        const paecFodaData = (json.data as { foda?: { fortalezas?: string; oportunidades?: string; debilidades?: string; amenazas?: string } } | undefined)?.foda;
        if (paecFodaData) {
          setFoda(prev => {
            const res = synthesizeSituatedFoda({
              schoolName,
              schoolCct,
              municipality,
              locality,
              totalStaff,
              rawFoda: prev,
              paecFoda: {
                fortalezas: paecFodaData.fortalezas || '',
                oportunidades: paecFodaData.oportunidades || '',
                debilidades: paecFodaData.debilidades || '',
                amenazas: paecFodaData.amenazas || '',
              },
              indicadores,
              diagnosticoComunidad,
            });
            return {
              fortalezas: res.fortalezas || prev.fortalezas || '',
              oportunidades: res.oportunidades || prev.oportunidades || '',
              debilidades: res.debilidades || prev.debilidades || '',
              amenazas: res.amenazas || prev.amenazas || '',
            };
          });
        }
        setDocsStatus(prev => ({ ...prev, paecAnt: true }));
        setSuccessBanner(summary.message);
      } else {
        setDocsStatus(prev => ({ ...prev, paecAnt: false }));
        setError(summary.message);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'No se pudo procesar el PAEC anterior.';
      setError(errMsg);
    } finally {
      setUploadingPaec(false);
      if (fileInputPaecRef.current) fileInputPaecRef.current.value = '';
    }
  };

  return {
    triggerUpload911,
    handleUploadPreviousPmc,
    handleDirectorNameChange,
    updateEditableElemento,
    handleApplyParsedPmc,
    handleUploadF11,
    handleUpload911,
    handleUploadPreviousPaec,
  };
}

export type PmcFileIngestHandlers = ReturnType<typeof usePmcFileIngest>;
