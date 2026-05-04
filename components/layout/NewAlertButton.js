'use client';
// ── New Article Alert Button ───────────────────────────────
// Appears only when a new article is posted in the last 5 mins.
// Ghost component: invisible when no recent alerts exist.

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase'; 
import { useUser } from '../../hooks/useUser';
import Link from 'next/link';

export default function NewAlertButton() {
  const { user } = useUser();
  const [alerts, setAlerts] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchAlerts = async () => {
      // Logic: Only get alerts created in the last 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      const { data } = await supabase
        .from('article_alerts')
        .select(`
          id, 
          article_id, 
          created_at,
          actor:profiles!actor_id(username),
          article:articles(title)
        `)
        .eq('user_id', user.id)
        .gt('created_at', fiveMinutesAgo)
        .order('created_at', { ascending: false });

      if (data) setAlerts(data);
    };

    fetchAlerts();

    // ── Realtime Listener ──
    // Listens specifically for new entries in the article_alerts table
    const channel = supabase
      .channel('new-article-alerts-realtime')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'article_alerts',
        filter: `user_id=eq.${user.id}`
      }, () => {
        fetchAlerts();
      })
      .subscribe();

    // Refresh every 30s to "expire" alerts that cross the 5-min mark
    const interval = setInterval(fetchAlerts, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [user]);

  // Hide component completely if no alerts exist in the last 5 minutes
  if (alerts.length === 0) return null;

  return (
    <div className="alert-wrapper">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="btn-new-alert"
      >
        NEW ({alerts.length})
      </button>

      {isOpen && (
        <div className="alert-dropdown">
          <div className="alert-header">LATEST UPDATES</div>
          {alerts.map(alert => (
            <Link 
              key={alert.id} 
              href={`/articles/${alert.article_id}`}
              className="alert-item"
              onClick={() => setIsOpen(false)}
            >
              <div className="alert-row">
                <span className="alert-user">@{alert.actor?.username}</span>
                <span className="alert-time-tag">NEW</span>
              </div>
              <span className="alert-title">{alert.article?.title}</span>
            </Link>
          ))}
        </div>
      )}

      <style jsx>{`
        .alert-wrapper {
          position: relative;
          display: inline-block;
        }

        .btn-new-alert {
          background: #ff4757;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 20px;
          font-weight: 800;
          font-size: 11px;
          cursor: pointer;
          letter-spacing: 0.05em;
          animation: pulse-red 2s infinite;
          transition: transform 0.2s;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .btn-new-alert:hover {
          transform: scale(1.05);
          background: #ff6b81;
        }

        .alert-dropdown {
          position: absolute;
          top: 40px;
          right: 0;
          width: 260px;
          background: #ffffff;
          border: 1px solid #e1e4e8;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          z-index: 9999;
          overflow: hidden;
        }

        .alert-header {
          padding: 10px 15px;
          font-size: 10px;
          color: #8b949e;
          background: #f6f8fa;
          font-weight: bold;
          border-bottom: 1px solid #e1e4e8;
        }

        .alert-item {
          display: flex;
          flex-direction: column;
          padding: 12px 15px;
          text-decoration: none;
          border-bottom: 1px solid #f1f1f1;
          transition: background 0.2s;
        }

        .alert-item:hover {
          background: #f0f7ff;
        }

        .alert-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2px;
        }

        .alert-user {
          font-size: 13px;
          font-weight: bold;
          color: #1f2328;
        }

        .alert-title {
          font-size: 12px;
          color: #57606a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .alert-time-tag {
          font-size: 9px;
          background: #e7f3ff;
          color: #0969da;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: bold;
        }

        @keyframes pulse-red {
          0% { box-shadow: 0 0 0 0 rgba(255, 71, 87, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(255, 71, 87, 0); }
          100% { box-shadow: 0 0 0 0 rgba(255, 71, 87, 0); }
        }
      `}</style>
    </div>
  );
}