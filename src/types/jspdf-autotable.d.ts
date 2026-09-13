/**
 * Type augmentations for jsPDF and jspdf-autotable
 * SIGPDA-EMS · DBEPA Puebla MCCEMS
 */
import 'jspdf';

declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable?: {
      finalY: number;
    };
  }
}
