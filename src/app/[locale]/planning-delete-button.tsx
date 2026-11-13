'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';

export default function PlanningDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const { update } = useSession();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!confirm('¿Seguro que deseas eliminar esta planeación? Esta acción no se puede deshacer.')) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/plannings/${id}`, { method: 'DELETE' });
      if (res.ok) {
        try {
          await update();
        } catch (updateErr) {
          console.warn('No se pudo refrescar la sesión tras eliminar la planeación:', updateErr);
        }
        router.refresh();
      } else {
        alert('Error al eliminar la planeación');
      }
    } catch {
      alert('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      className="btn btn-sm"
      style={{ backgroundColor: '#dc3545', borderColor: '#dc3545', color: '#fff', opacity: loading ? 0.6 : 1 }}
      title="Eliminar planeación"
    >
      {loading ? '...' : '🗑'}
    </button>
  );
}
