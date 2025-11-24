import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Users, LogOut, Target } from 'lucide-react';

export default function Layout() {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    if (!user) return null;

    const NavItem = ({ to, icon: Icon, children }) => {
        const isActive = location.pathname === to;
        return (
            <Link
                to={to}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200
          ${isActive
                        ? 'bg-primary-50 text-primary-700 font-medium'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
            >
                <Icon className="w-5 h-5" />
                {children}
            </Link>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-slate-200 fixed h-full hidden md:flex flex-col">
                <div className="p-6 border-b border-slate-100">
                    <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <Target className="w-6 h-6 text-primary-600" />
                        GoalTracker
                    </h1>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    <NavItem to="/" icon={LayoutDashboard}>Dashboard</NavItem>
                    {user.role === 'ADMIN' && (
                        <NavItem to="/admin" icon={Users}>Administração</NavItem>
                    )}
                </nav>

                <div className="p-4 border-t border-slate-100">
                    <div className="flex items-center gap-3 mb-4 px-2">
                        <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{user.name}</p>
                            <p className="text-xs text-slate-500 truncate">{user.role}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        Sair
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 md:ml-64 p-8">
                <Outlet />
            </main>
        </div>
    );
}
