/**
 * Type augmentations for jsPDF and jspdf-autotable
 * SIGPDA-EMS · SEMS Puebla MCCEMS
 */
import 'jspdf';

declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable?: {
      finalY: number;
    };
  }
}
