export type Tab = 'today' | 'week' | 'shop' | 'pantry' | 'more';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'Today', icon: '☀︎' },
  { id: 'week', label: 'Week', icon: '▦' },
  { id: 'shop', label: 'Shop', icon: '🛒' },
  { id: 'pantry', label: 'Pantry', icon: '🥫' },
  { id: 'more', label: 'More', icon: '⋯' },
];

export function Nav({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <nav className="nav" aria-label="Main">
      <div className="nav-inner">
        {TABS.map(t => (
          <button key={t.id} type="button" aria-current={tab === t.id ? 'page' : undefined} onClick={() => onTab(t.id)}>
            <span className="ico" aria-hidden="true">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
