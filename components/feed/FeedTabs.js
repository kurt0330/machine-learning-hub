'use client';
// ── Feed Tabs ──────────────────────────────────────────────
// Tab bar for All / New / Top 5 switching.

export const TABS = [
  { id: 'all',   label: 'All Articles' },
  { id: 'new',   label: 'New'          },
  { id: 'top5',  label: 'Top 5'        },
];

export default function FeedTabs({ activeTab, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          className={`tab ${activeTab === tab.id ? 'tab--active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {tab.id === 'top5' && (
            <span
              style={{
                marginLeft:   'var(--space-2)',
                fontSize:     'var(--text-xs)',
                color:        activeTab === 'top5'
                  ? 'var(--color-accent-amber)'
                  : 'var(--color-text-muted)',
              }}
            >
              🏆
            </span>
          )}
        </button>
      ))}
    </div>
  );
}