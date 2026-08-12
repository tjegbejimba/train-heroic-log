import { Dumbbell, CalendarDays, BarChart2, BookOpen, Settings, TrendingUp } from 'lucide-react';
import {
  TAB_TRAINING,
  TAB_HISTORY,
  TAB_LIBRARY,
  TAB_SETTINGS,
  ROUTE_PLANNER,
  ROUTE_STATS,
} from '../constants';

export default function NavBar({ currentTab, onTabChange, syncStatus }) {
  const tabs = [
    { id: TAB_TRAINING, label: 'Training', Icon: Dumbbell },
    { id: ROUTE_PLANNER, label: 'Planner', Icon: CalendarDays },
    { id: TAB_HISTORY, label: 'History', Icon: BarChart2 },
    { id: ROUTE_STATS, label: 'Stats', Icon: TrendingUp },
    { id: TAB_LIBRARY, label: 'Library', Icon: BookOpen },
    { id: TAB_SETTINGS, label: 'Settings', Icon: Settings },
  ];

  return (
    <nav className="navbar">
      <div className="navbar__tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`navbar__tab ${
              currentTab === tab.id ? 'navbar__tab--active' : ''
            }`}
            onClick={() => onTabChange(tab.id)}
          >
            <div className="navbar__icon" style={{ position: 'relative' }}>
              <tab.Icon size={22} />
              {tab.id === TAB_SETTINGS && syncStatus === 'offline' && (
                <span
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: -2,
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: 'var(--color-accent-yellow)',
                    border: '1.5px solid var(--color-bg)',
                  }}
                />
              )}
            </div>
            <div className="navbar__label">{tab.label}</div>
          </button>
        ))}
      </div>
    </nav>
  );
}
