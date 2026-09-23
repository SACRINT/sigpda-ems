'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck, Trash2, ExternalLink, AlertTriangle, Info, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  read: boolean;
  created_at: string;
}

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [filter, setFilter] = useState<'all' | 'unread' | 'alerts'>('all');
  const [loading, setLoading] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // Polling cada 60s
    return () => clearInterval(interval);
  }, []);

  // Cerrar dropdown al hacer clic afuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (e) {
      console.warn('Error fetching notifications:', e);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (e) {
      console.error('Error marking notification as read:', e);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch (e) {
      console.error('Error marking all as read:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications?id=${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }
    } catch (e) {
      console.error('Error deleting notification:', e);
    }
  };

  const getSeverityIcon = (sev: string) => {
    switch (sev) {
      case 'warning': return <AlertTriangle size={16} className="text-amber-400" />;
      case 'error': return <XCircle size={16} className="text-red-400" />;
      case 'success': return <CheckCircle2 size={16} className="text-emerald-400" />;
      default: return <Info size={16} className="text-indigo-400" />;
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'alerts') return n.severity === 'warning' || n.severity === 'error';
    return true;
  });

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Botón Campana */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Ver notificaciones y alertas"
        className="relative p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 transition-all border border-transparent hover:border-slate-700/60 focus:outline-none"
        style={{
          background: isOpen ? 'rgba(30, 41, 59, 0.8)' : 'transparent',
        }}
      >
        <Bell size={20} className={unreadCount > 0 ? 'text-indigo-400' : ''} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-r from-red-500 to-rose-600 text-[11px] font-bold text-white shadow-lg shadow-rose-500/30 animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 shadow-2xl shadow-black/80 z-50 overflow-hidden text-slate-200"
          style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
        >
          {/* Header del Popover */}
          <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-slate-100">Notificaciones y Alertas</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {unreadCount} nuevas
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                disabled={loading}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 hover:underline disabled:opacity-50"
              >
                <CheckCheck size={14} /> Marcar leídas
              </button>
            )}
          </div>

          {/* Filtros rápidos */}
          <div className="flex px-3 pt-2 pb-1 gap-1 border-b border-slate-800/80 bg-slate-900/50 text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-lg transition-all ${
                filter === 'all'
                  ? 'bg-indigo-600 text-white font-medium shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Todas ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-3 py-1 rounded-lg transition-all ${
                filter === 'unread'
                  ? 'bg-indigo-600 text-white font-medium shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              No leídas ({unreadCount})
            </button>
            <button
              onClick={() => setFilter('alerts')}
              className={`px-3 py-1 rounded-lg transition-all ${
                filter === 'alerts'
                  ? 'bg-indigo-600 text-white font-medium shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Alertas ⚠️
            </button>
          </div>

          {/* Lista de Notificaciones */}
          <div className="overflow-y-auto divide-y divide-slate-800/60" style={{ maxHeight: '360px' }}>
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Bell size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">No hay notificaciones</p>
                <p className="text-xs text-slate-600 mt-1">Estás al día con tus planeaciones y horarios</p>
              </div>
            ) : (
              filteredNotifications.map(item => (
                <div
                  key={item.id}
                  className={`p-3.5 transition-colors flex items-start gap-3 hover:bg-slate-800/60 ${
                    !item.read ? 'bg-indigo-950/20' : ''
                  }`}
                >
                  <div className="mt-0.5 p-1.5 rounded-lg bg-slate-800 border border-slate-700/50 shrink-0">
                    {getSeverityIcon(item.severity)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <h4 className={`text-xs font-semibold truncate ${!item.read ? 'text-slate-100' : 'text-slate-300'}`}>
                        {item.title}
                      </h4>
                      <span className="text-[10px] text-slate-500 whitespace-nowrap">
                        {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-1.5">
                      {item.message}
                    </p>
                    <div className="flex items-center gap-3">
                      {item.link && (
                        <Link
                          href={item.link}
                          onClick={() => {
                            if (!item.read) handleMarkAsRead(item.id);
                            setIsOpen(false);
                          }}
                          className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 hover:underline"
                        >
                          Ver detalle <ExternalLink size={11} />
                        </Link>
                      )}
                      {!item.read && (
                        <button
                          onClick={() => handleMarkAsRead(item.id)}
                          className="text-[11px] text-slate-500 hover:text-slate-300 hover:underline ml-auto"
                        >
                          Marcar leída
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-[11px] text-slate-500 hover:text-red-400 transition-colors p-0.5 rounded ml-auto"
                        title="Eliminar"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer del Popover */}
          <div className="p-2.5 bg-slate-950/60 border-t border-slate-800 text-center">
            <span className="text-[11px] text-slate-500">
              Sistema de Alertas Inteligente · MCCEMS Puebla
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
