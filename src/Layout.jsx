import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { base44 } from '@/api/base44Client';
import {
  LayoutDashboard,
  Users,
  UserCircle,
  ShoppingCart,
  Calculator,
  FileText,
  MessageSquare,
  Menu,
  X,
  LogOut,
  Mail,
  Settings,
  Search,
  Calendar as CalendarIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const navigation = [
    { name: 'Dashboard', path: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'user'] },
    { name: 'Kalender', path: 'Kalender', icon: CalendarIcon, roles: ['admin', 'user'] },
    { name: 'Leads', path: 'Leads', icon: Users, roles: ['admin', 'user'] },
    { name: 'Unternehmenssuche', path: 'Unternehmenssuche', icon: Search, roles: ['admin', 'user'] },
    { name: 'Verkaufschancen', path: 'Verkaufschancen', icon: ShoppingCart, roles: ['admin', 'user'] },
    { name: 'PVP Portal', path: 'PVP', icon: Settings, roles: ['admin'] },
    { name: 'Mitarbeiter', path: 'Employees', icon: UserCircle, roles: ['admin'] },
    { name: 'Verkäufe', path: 'Sales', icon: ShoppingCart, roles: ['admin', 'user'] },
    { name: 'Provisionen', path: 'Commissions', icon: Calculator, roles: ['admin'] },
    { name: 'Provisionsregeln', path: 'Provisionsregeln', icon: Settings, roles: ['admin'] },
    { name: 'Gutschriften', path: 'CreditNotes', icon: FileText, roles: ['admin', 'user'] },
    { name: 'Bestandskunden', path: 'Bestandskunden', icon: Users, roles: ['admin', 'user'] },
    { name: 'Team Chat', path: 'Chat', icon: MessageSquare, roles: ['admin'] },
  ];

  const filteredNavigation = navigation.filter(item => 
    item.roles.includes(user?.role || 'user')
  );

  const handleLogout = () => {
    base44.auth.logout();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <style>{`
        :root {
          --primary: #1e3a8a;
          --primary-dark: #1e40af;
          --accent: #f59e0b;
          --accent-dark: #d97706;
        }
      `}</style>

      {/* Sidebar Desktop */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white border-r border-slate-200 px-6 pb-4">
          <div className="flex h-40 shrink-0 items-center justify-center border-b border-slate-200 p-4">
                        <img 
                              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691d914be3952e3190d4dbb7/fd4ebd25d_EE-logo-1-1e3f66-1024x576.png"
                              alt="Career Agents"
                              className="h-32 w-full object-contain"
                            />
                      </div>
          <nav className="flex flex-1 flex-col">
            <ul className="flex flex-1 flex-col gap-y-2">
              {filteredNavigation.map((item) => {
                const Icon = item.icon;
                const isActive = currentPageName === item.path;
                return (
                  <li key={item.name}>
                    <Link
                      to={createPageUrl(item.path)}
                      className={`group flex gap-x-3 rounded-lg p-3 text-sm font-semibold leading-6 transition-all ${
                        isActive
                          ? 'bg-blue-900 text-white'
                          : 'text-slate-700 hover:text-blue-900 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-900'}`} />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          {user && (
            <div className="border-t border-slate-200 pt-4">
              <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">
                    {user.full_name?.charAt(0) || user.email?.charAt(0)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{user.full_name || user.email}</p>
                  <p className="text-xs text-slate-500 truncate">{user.role}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                onClick={handleLogout}
                className="w-full mt-2 justify-start text-slate-700 hover:text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Abmelden
              </Button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="sticky top-0 z-40 lg:hidden bg-white border-b border-slate-200">
        <div className="flex h-16 items-center gap-x-4 px-4">
          <button
            type="button"
            className="-m-2.5 p-2.5 text-slate-700 lg:hidden"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2">
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691d914be3952e3190d4dbb7/fd4ebd25d_EE-logo-1-1e3f66-1024x576.png"
              alt="Career Agents"
              className="h-8 w-auto object-contain"
            />
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-slate-900/80" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-full max-w-xs bg-white">
            <div className="flex h-16 items-center justify-between px-6 border-b border-slate-200">
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691d914be3952e3190d4dbb7/fd4ebd25d_EE-logo-1-1e3f66-1024x576.png"
                alt="Career Agents"
                className="h-8 w-auto object-contain"
              />
              <button onClick={() => setMobileMenuOpen(false)} className="text-slate-500">
                <X className="h-6 w-6" />
              </button>
            </div>
            <nav className="px-6 py-6">
              <ul className="space-y-2">
                {filteredNavigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPageName === item.path;
                  return (
                    <li key={item.name}>
                      <Link
                        to={createPageUrl(item.path)}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex gap-x-3 rounded-lg p-3 text-sm font-semibold ${
                          isActive
                            ? 'bg-blue-900 text-white'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            {user && (
              <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 p-6">
                <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50 mb-2">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                    <span className="text-white font-semibold">
                      {user.full_name?.charAt(0) || user.email?.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{user.full_name || user.email}</p>
                    <p className="text-xs text-slate-500">{user.role}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  className="w-full justify-start text-slate-700 hover:text-red-600"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Abmelden
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="lg:pl-72">
        <div className="px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}