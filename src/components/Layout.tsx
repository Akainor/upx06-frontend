import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, History, Bell, ArrowRightLeft, Info, Droplets } from 'lucide-react';

export default function Layout() {
  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/historico', label: 'Histórico', icon: History },
    { path: '/alertas', label: 'Alertas', icon: Bell },
    { path: '/comparacao', label: 'Antes x Depois', icon: ArrowRightLeft },
    { path: '/sobre', label: 'Sobre o Projeto', icon: Info },
  ];

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <Droplets className="logo-icon" />
          <h1>AquaSense</h1>
        </div>
        
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => 
                  isActive ? "nav-item active" : "nav-item"
                }
              >
                <Icon className="nav-icon" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}