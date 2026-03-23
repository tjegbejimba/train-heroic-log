import { Dumbbell, CalendarDays, BarChart2, BookOpen, Settings } from 'lucide-react';
import {
  TAB_TRAINING,
  TAB_HISTORY,
  TAB_LIBRARY,
  TAB_SETTINGS,
  ROUTE_PLANNER,
} from '../constants';

export default function NavBar({ currentTab, onTabChange }) {
  const tabs = [
    { id: TAB_TRAINING, label: 'Training', Icon: Dumbbell },
    { id: ROUTE_PLANNER, label: 'Planner', Icon: CalendarDays },
    { id: TAB_HISTORY, label: 'History', Icon: BarChart2 },
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
            <div className="navbar__icon"><tab.Icon size={22} /></div>
            <div className="navbar__label">{tab.label}</div>
          </button>
        ))}
      </div>
    </nav>
  );
}
