import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/pair', label: 'Pair Device', icon: '🔗' },
  { to: '/', label: 'Dashboard', icon: '📊', end: true },
  { to: '/notifications', label: 'Notifications', icon: '🔔' },
  { to: '/messages', label: 'Messages', icon: '💬' },
  { to: '/photos', label: 'Photos', icon: '🖼️' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export function Sidebar() {
  return (
    <aside className="flex w-56 flex-col bg-desklink-sidebar text-gray-200">
      <div className="border-b border-white/10 px-5 py-5">
        <h1 className="text-lg font-semibold text-white">DeskLink</h1>
        <p className="text-xs text-gray-400">Phone companion</p>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'bg-desklink-accent text-white'
                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <span aria-hidden>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 p-4 text-xs text-gray-500">
        DeskLink v0.1.0
      </div>
    </aside>
  );
}
