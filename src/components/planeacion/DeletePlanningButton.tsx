'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';

interface DeletePlanningButtonProps {
  id: string;
  locale: string;
  redirectAfterDelete?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

export default function DeletePlanningButton({
  id,
  locale,
  redirectAfterDelete = false,
  className = '',
  size = 'md',
}: DeletePlanningButtonProps) {
  const router = useRouter();
  const { update } = useSession();
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function executeDelete() {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/plannings/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        try {
          await update();
        } catch (updateErr) {
          console.warn('No se pudo refrescar la sesión tras eliminar la planeación:', updateErr);
        }
        toast.success('Planeación eliminada correctamente');
        if (redirectAfterDelete) {
          router.push(`/${locale}/dashboard`);
          router.refresh();
        } else {
          window.location.reload();
        }
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Error al eliminar la planeación');
        setIsDeleting(false);
        setConfirming(false);
      }
    } catch {
      toast.error('Ocurrió un error al intentar eliminar la planeación.');
      setIsDeleting(false);
      setConfirming(false);
    }
  }

  const btnClass = size === 'sm' ? 'btn btn-danger btn-sm' : 'btn btn-danger';

  if (confirming) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '8px',
          padding: '4px 8px',
        }}
      >
        <span style={{ fontSize: '12px', color: '#fca5a5', fontWeight: 600 }}>¿Eliminar planeación?</span>
        <button
          type="button"
          onClick={executeDelete}
          disabled={isDeleting}
          style={{
            padding: '3px 8px',
            fontSize: '11px',
            background: '#dc2626',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: isDeleting ? 'not-allowed' : 'pointer',
            fontWeight: 700,
          }}
        >
          {isDeleting ? 'Eliminando…' : 'Sí, borrar'}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={isDeleting}
          style={{
            padding: '3px 6px',
            fontSize: '11px',
            background: 'transparent',
            color: '#cbd5e1',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      disabled={isDeleting}
      className={`${btnClass} ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        cursor: 'pointer',
        backgroundColor: '#dc3545',
        color: '#ffffff',
        border: 'none',
        borderRadius: '6px',
        fontWeight: 600,
        padding: '7px 12px',
        fontSize: '13px',
        opacity: isDeleting ? 0.7 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      <span>🗑️</span> {isDeleting ? 'Eliminando...' : 'Eliminar'}
    </button>
  );
}
