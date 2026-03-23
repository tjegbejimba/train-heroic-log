import {
  TAB_TRAINING,
  TAB_HISTORY,
  TAB_LIBRARY,
  TAB_SETTINGS,
  ROUTE_PLANNER,
} from '../constants';

export default function NavBar({ currentTab, onTabChange }) {
  const tabs = [
    { id: TAB_TRAINING, label: 'Training', icon: '🏋️' },
    { id: ROUTE_PLANNER, label: 'Planner', icon: '📋' },
    { id: TAB_HISTORY, label: 'History', icon: '📊' },
    { id: TAB_LIBRARY, label: 'Library', icon: '📚' },
    { id: TAB_SETTINGS, label: 'Settings', icon: '⚙️' },
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
            <div className="navbar__icon">{tab.icon}</div>
            <div className="navbar__label">{tab.label}</div>
          </button>
        ))}
      </div>
    </nav>
  );
}
