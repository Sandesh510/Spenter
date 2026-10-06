import { Icon } from './Icon';

export type Tab = 'home' | 'log' | 'ask' | 'trends' | 'settings';

/** Bottom nav from the mockups: Home · Log · Ask (raised centre) · Trends · Settings. */
export function BottomNav({ active, onGo }: { active: Tab; onGo: (t: Tab) => void }) {
  const slot = (tab: Exclude<Tab, 'ask'>, icon: string, label: string) => (
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
      <button className="nav__slot nav__slot--centre" onClick={() => onGo('ask')} aria-label="Should I buy this?">
        <span className="nav__fab">
          <Icon name="help-circle" size={25} />
        </span>
        <span className="label" style={{ fontSize: 10 }}>Ask</span>
      </button>
      {slot('trends', 'bar-chart-3', 'Trends')}
      {slot('settings', 'settings', 'Settings')}
    </nav>
  );
}
