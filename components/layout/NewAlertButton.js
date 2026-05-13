'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase'; 
import { useUser } from '../../hooks/useUser';
import Link from 'next/link';

export default function NewAlertButton() {
  const { user, loading } = useUser();
  const [alerts, setAlerts] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (loading || !user) return;

    const fetchAlerts = async () => {
      try {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        
        // Fixed Join Syntax to avoid 400 error
        const { data, error } = await supabase
          .from('article_alerts')
          .select(`
            id, 
            article_id, 
            created_at,
            actor_id,
            profiles:actor_id ( username ),
            articles:article_id ( title )
          `)
          .eq('user_id', user.id)
          .gt('created_at', fiveMinutesAgo)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('[Alerts] fetch error:', error.message);
          return;
        }

        if (data) setAlerts(data);
      } catch (err) {
        console.error('[Alerts] unexpected error:', err);
      }
    };

    fetchAlerts();

    // Realtime Listener
    const channel = supabase
      .channel(`alerts-${user.id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'article_alerts',
        filter: `user_id=eq.${user.id}`
      }, () => {
        fetchAlerts();
      })
      .subscribe();

    const interval = setInterval(fetchAlerts, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [user, loading]);

  if (alerts.length === 0) return null;

  return (
    <div className="alert-wrapper">
      <button onClick={() => setIsOpen(!isOpen)} className="btn-new-alert">
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
                <span className="alert-user">@{alert.profiles?.username || 'User'}</span>
                <span className="alert-time-tag">NEW</span>
              </div>
              <span className="alert-title">{alert.articles?.title || 'New Article'}</span>
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
          animation: pulse-red 2s infinite;
          transition: transform 0.2s;
        }

        .btn-new-alert:hover {
          transform: scale(1.05);
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

        .alert-item:last-child {
          border-bottom: none;
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