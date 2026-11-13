'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, CheckCheck, Trash2, ExternalLink, AlertTriangle, Info, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';
import styles from './NotificationBell.module.css';

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
  const lastFetchRef = useRef<number>(0);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        lastFetchRef.current = Date.now();
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (e) {
      console.warn('Error fetching notifications:', e);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastFetchRef.current < 15_000) return;
      lastFetchRef.current = now;
      void fetchNotifications();
    };

    document.addEventListener('visibilitychange', refreshIfVisible);
    window.addEventListener('focus', refreshIfVisible);

    return () => {
      document.removeEventListener('visibilitychange', refreshIfVisible);
      window.removeEventListener('focus', refreshIfVisible);
    };
  }, [fetchNotifications]);

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
        void fetchNotifications();
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
        void fetchNotifications();
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
        void fetchNotifications();
      }
    } catch (e) {
      console.error('Error deleting notification:', e);
    }
  };

  const getSeverityIcon = (sev: string) => {
    switch (sev) {
      case 'warning': return <AlertTriangle size={16} />;
      case 'error': return <XCircle size={16} />;
      case 'success': return <CheckCircle2 size={16} />;
      default: return <Info size={16} />;
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'alerts') return n.severity === 'warning' || n.severity === 'error';
    return true;
  });

  return (
    <div className={styles.root} ref={dropdownRef}>
      {/* Botón Campana */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Ver notificaciones y alertas"
        data-open={isOpen}
        className={styles.trigger}
      >
        <Bell size={20} className={unreadCount > 0 ? styles.triggerActive : undefined} />
        {unreadCount > 0 && (
          <span className={styles.badge}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className={styles.panel}>
          {/* Header del Popover */}
          <div className={styles.panelHeader}>
            <div className={styles.headerTitleWrap}>
              <span className={styles.headerTitle}>Notificaciones y Alertas</span>
              {unreadCount > 0 && (
                <span className={styles.newBadge}>
                  {unreadCount} nuevas
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                disabled={loading}
                className={styles.markAll}
              >
                <CheckCheck size={14} /> Marcar leídas
              </button>
            )}
          </div>

          {/* Filtros rápidos */}
          <div className={styles.filters}>
            <button
              onClick={() => setFilter('all')}
              className={`${styles.filter} ${filter === 'all' ? styles.filterActive : ''}`}
            >
              Todas ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`${styles.filter} ${filter === 'unread' ? styles.filterActive : ''}`}
            >
              No leídas ({unreadCount})
            </button>
            <button
              onClick={() => setFilter('alerts')}
              className={`${styles.filter} ${filter === 'alerts' ? styles.filterActive : ''}`}
            >
              Alertas ⚠️
            </button>
          </div>

          {/* Lista de Notificaciones */}
          <div className={styles.list}>
            {filteredNotifications.length === 0 ? (
              <div className={styles.empty}>
                <Bell size={32} className={styles.emptyIcon} />
                <p className={styles.emptyTitle}>No hay notificaciones</p>
                <p className={styles.emptyHint}>Estás al día con tus planeaciones y horarios</p>
              </div>
            ) : (
              filteredNotifications.map(item => (
                <div
                  key={item.id}
                  className={`${styles.item} ${!item.read ? styles.itemUnread : ''}`}
                >
                  <div className={styles.iconBox} data-severity={item.severity}>
                    {getSeverityIcon(item.severity)}
                  </div>
                  <div className={styles.body}>
                    <div className={styles.topRow}>
                      <h4 className={`${styles.title} ${!item.read ? styles.titleUnread : ''}`}>
                        {item.title}
                      </h4>
                      <span className={styles.date}>
                        {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <p className={styles.message}>
                      {item.message}
                    </p>
                    <div className={styles.actions}>
                      {item.link && (
                        <Link
                          href={item.link}
                          onClick={() => {
                            if (!item.read) handleMarkAsRead(item.id);
                            setIsOpen(false);
                          }}
                          className={styles.detailLink}
                        >
                          Ver detalle <ExternalLink size={11} />
                        </Link>
                      )}
                      {!item.read && (
                        <button
                          onClick={() => handleMarkAsRead(item.id)}
                          className={styles.markRead}
                        >
                          Marcar leída
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(item.id)}
                        className={styles.delete}
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
          <div className={styles.footer}>
            <span>
              Sistema de Alertas Inteligente · MCCEMS Puebla
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
