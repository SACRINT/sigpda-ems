'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

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
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm('¿Estás seguro de que deseas eliminar esta planeación? Esta acción no se puede deshacer.')) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/plannings/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        if (redirectAfterDelete) {
          router.push(`/${locale}/dashboard`);
          router.refresh();
        } else {
          window.location.reload();
        }
      } else {
        const data = await res.json();
        alert(data.error || 'Error al eliminar la planeación');
        setIsDeleting(false);
      }
    } catch {
      alert('Ocurrió un error al intentar eliminar la planeación.');
      setIsDeleting(false);
    }
  }

  const btnClass = size === 'sm' ? 'btn btn-danger btn-sm' : 'btn btn-danger';

  return (
    <button
      onClick={handleDelete}
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
        borderRadius: '4px',
        fontWeight: 600,
        opacity: isDeleting ? 0.7 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      <span>🗑️</span> {isDeleting ? 'Eliminando...' : 'Eliminar'}
    </button>
  );
}
