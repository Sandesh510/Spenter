import { Icon } from './Icon';

export type Tab = 'home' | 'log' | 'trends' | 'settings';

/** Bottom nav per the README: Home · Log · Add (raised centre, opens Quick Add) · Trends · Settings. */
export function BottomNav({ active, onGo, onAdd }: { active: Tab; onGo: (t: Tab) => void; onAdd: () => void }) {
  const slot = (tab: Tab, icon: string, label: string) => (
    <button
      className={`nav__slot ${active === tab ? 'nav__slot--on' : ''}`}
      onClick={() => onGo(tab)}
      aria-current={active === tab ? 'page' : undefined}
    >
      <Icon name={icon} size={21} />
      <span className="label">{label}</span>
    </button>
  );

  return (
    <nav className="nav" aria-label="Main">
      {slot('home', 'home', 'Home')}
      {slot('log', 'receipt-text', 'Log')}
      <button className="nav__slot nav__slot--centre" onClick={onAdd} aria-label="Add transaction">
        <span className="nav__fab">
          <Icon name="plus" size={26} />
        </span>
        <span className="label" style={{ fontSize: 10 }}>Add</span>
      </button>
      {slot('trends', 'bar-chart-3', 'Trends')}
      {slot('settings', 'settings', 'Settings')}
    </nav>
  );
}
