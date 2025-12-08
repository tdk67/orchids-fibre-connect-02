import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import {
  Users,
  UserCircle,
  ShoppingCart,
  Euro,
  TrendingUp,
  Calendar,
  ArrowRight,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [selectedBenutzertyp, setSelectedBenutzertyp] = useState(() => {
    return localStorage.getItem('selectedBenutzertyp') || 'Interner Mitarbeiter';
  });

  useEffect(() => {
    base44.auth.me().then((u) => {
      setUser(u);
      if (!localStorage.getItem('selectedBenutzertyp')) {
        setSelectedBenutzertyp(u?.benutzertyp || 'Interner Mitarbeiter');
      }
    }).catch(() => {});

    const handleBenutzertypChange = () => {
      setSelectedBenutzertyp(localStorage.getItem('selectedBenutzertyp') || 'Interner Mitarbeiter');
    };

    window.addEventListener('benutzertypChanged', handleBenutzertypChange);
    return () => window.removeEventListener('benutzertypChanged', handleBenutzertypChange);
  }, []);

  const { data: allLeads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list(),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  const { data: allSales = [] } = useQuery({
    queryKey: ['sales'],
    queryFn: () => base44.entities.Sale.list('-sale_date', 100),
  });

  const { data: allTermine = [] } = useQuery({
    queryKey: ['termine'],
    queryFn: () => base44.entities.Termin.list('startzeit'),
  });

  // Finde den aktuellen Mitarbeiter-Eintrag
  const currentEmployee = employees.find(e => e.email === user?.email);
  const isTeamleiter = currentEmployee?.rolle === 'Teamleiter';

  // Mitarbeiter die diesem Teamleiter zugeordnet sind
  const teamMembers = employees.filter(e => e.teamleiter_id === currentEmployee?.id);

  // Heutige Termine filtern
  const today = new Date().toISOString().split('T')[0];
  const todayTermine = allTermine.filter(t => {
    if (!t.startzeit) return false;
    try {
      const terminDate = new Date(t.startzeit);
      if (isNaN(terminDate.getTime())) return false;
      const terminDateStr = terminDate.toISOString().split('T')[0];
      const isToday = terminDateStr === today;
      
      // Admin sieht alle, Teamleiter sieht alle, normale Mitarbeiter nur eigene
      if (user?.role === 'admin') return isToday;
      if (isTeamleiter) return isToday;
      return isToday && t.mitarbeiter_email === user?.email;
    } catch {
      return false;
    }
  }).sort((a, b) => {
    try {
      return new Date(a.startzeit) - new Date(b.startzeit);
    } catch {
      return 0;
    }
  });

  // Filter für Mitarbeiter - nur eigene Daten + Benutzertyp
  const leads = user?.role === 'admin' 
    ? allLeads.filter(l => l.benutzertyp === selectedBenutzertyp)
    : allLeads.filter(lead => lead.assigned_to_email === user?.email && lead.benutzertyp === (user?.benutzertyp || 'Interner Mitarbeiter'));

  const sales = user?.role === 'admin' 
    ? allSales.filter(s => s.benutzertyp === selectedBenutzertyp)
    : allSales.filter(sale => sale.employee_id === user?.email && sale.benutzertyp === (user?.benutzertyp || 'Interner Mitarbeiter'));

  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentMonthSales = sales.filter(s => s.sale_date?.startsWith(currentMonth));
  const totalRevenue = currentMonthSales.reduce((sum, s) => sum + (s.contract_value || 0), 0);
  const totalCommissions = currentMonthSales.reduce((sum, s) => sum + (s.commission_amount || 0), 0);

  // Teamleiter: Eigene Provision (ohne Bonus) + Bonus von Mitarbeitern
  const teamleiterOwnCommission = currentMonthSales
    .filter(s => !s.product?.includes('Teamleiter-Bonus'))
    .reduce((sum, s) => sum + (s.commission_amount || 0), 0);
  
  const teamleiterBonusCommission = allSales.filter(s => 
    s.sale_date?.startsWith(currentMonth) && 
    s.product?.includes('Teamleiter-Bonus') &&
    s.employee_id === user?.email
  ).reduce((sum, s) => sum + (s.commission_amount || 0), 0);

  const stats = user?.role === 'admin' ? [
    {
      name: 'Leads',
      value: leads.length,
      icon: Users,
      color: 'from-blue-500 to-blue-600',
      link: 'Leads'
    },
    {
      name: 'Mitarbeiter',
      value: employees.length,
      icon: UserCircle,
      color: 'from-purple-500 to-purple-600',
      link: 'Employees'
    },
    {
      name: 'Verkäufe (Monat)',
      value: currentMonthSales.length,
      icon: ShoppingCart,
      color: 'from-green-500 to-green-600',
      link: 'Sales'
    },
    {
      name: 'Umsatz (Monat)',
      value: `${totalRevenue.toLocaleString('de-DE')} €`,
      icon: Euro,
      color: 'from-amber-500 to-amber-600',
      link: 'Sales'
    },
  ] : [
    {
      name: 'Meine Leads',
      value: leads.length,
      icon: Users,
      color: 'from-blue-500 to-blue-600',
      link: 'Leads'
    },
    {
      name: 'Meine Verkäufe (Monat)',
      value: currentMonthSales.length,
      icon: ShoppingCart,
      color: 'from-green-500 to-green-600',
      link: 'Sales'
    },
    {
      name: 'Meine Provision (Monat)',
      value: `${totalCommissions.toLocaleString('de-DE')} €`,
      icon: Euro,
      color: 'from-amber-500 to-amber-600',
      link: 'Commissions'
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          Willkommen zurück{user?.full_name ? `, ${user.full_name}` : ''}
        </h1>
        <p className="text-slate-500 mt-2">Hier ist Ihre Übersicht für heute</p>
      </div>

      {/* Heutige Termine */}
      {todayTermine.length > 0 && (
        <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardHeader className="border-b border-blue-100">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-900" />
                Meine Termine heute ({todayTermine.length})
              </CardTitle>
              <Link to={createPageUrl('Kalender')}>
                <Button variant="ghost" size="sm" className="text-blue-900 hover:text-blue-700">
                  Zum Kalender
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-blue-100">
              {todayTermine.map((termin) => {
                const startDate = new Date(termin.startzeit);
                const endDate = termin.endzeit ? new Date(termin.endzeit) : null;
                
                return (
                  <div key={termin.id} className="p-4 hover:bg-blue-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-blue-900">
                            {!isNaN(startDate.getTime()) ? startDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                          </span>
                          {endDate && !isNaN(endDate.getTime()) && (
                            <>
                              <span className="text-slate-400">-</span>
                              <span className="text-slate-600">
                                {endDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </>
                          )}
                        </div>
                        <p className="font-semibold text-slate-900">{termin.titel}</p>
                        {termin.kunde_name && (
                          <p className="text-sm text-slate-600 mt-1">{termin.kunde_name}</p>
                        )}
                        {(user?.role === 'admin' || isTeamleiter) && termin.mitarbeiter_name && (
                          <p className="text-xs text-slate-500 mt-1">Mitarbeiter: {termin.mitarbeiter_name}</p>
                        )}
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        termin.status === 'Geplant' ? 'bg-blue-100 text-blue-800' :
                        termin.status === 'Bestätigt' ? 'bg-green-100 text-green-800' :
                        termin.status === 'Abgeschlossen' ? 'bg-gray-100 text-gray-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {termin.status}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.name} to={createPageUrl(stat.link)}>
              <Card className="hover:shadow-xl transition-all duration-300 border-0 bg-white overflow-hidden group cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">{stat.name}</p>
                      <p className="text-3xl font-bold text-slate-900 mt-2">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color} group-hover:scale-110 transition-transform`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Provisionen Overview */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-900" />
              {user?.role === 'admin' ? 'Provisionen aktueller Monat' : 'Meine Provisionen aktueller Monat'}
            </CardTitle>
            <Link to={createPageUrl('Commissions')}>
              <Button variant="ghost" size="sm" className="text-blue-900 hover:text-blue-700">
                Alle anzeigen
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border border-green-100">
              <p className="text-sm font-medium text-green-700">
                {user?.role === 'admin' ? 'Gesamtprovisionen' : 'Meine Gesamtprovisionen'}
              </p>
              <p className="text-3xl font-bold text-green-900 mt-2">
                {totalCommissions.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
              </p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-6 rounded-xl border border-blue-100">
              <p className="text-sm font-medium text-blue-700">Durchschnitt pro Verkauf</p>
              <p className="text-3xl font-bold text-blue-900 mt-2">
                {currentMonthSales.length > 0
                  ? (totalCommissions / currentMonthSales.length).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
                  : '0 €'}
              </p>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-xl border border-amber-100">
              <p className="text-sm font-medium text-amber-700">Offene Auszahlungen</p>
              <p className="text-3xl font-bold text-amber-900 mt-2">
                {sales.filter(s => !s.commission_paid).length}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Sales */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b border-slate-100">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-900" />
              {user?.role === 'admin' ? 'Letzte Verkäufe' : 'Meine letzten Verkäufe'}
            </CardTitle>
            <Link to={createPageUrl('Sales')}>
              <Button variant="ghost" size="sm" className="text-blue-900 hover:text-blue-700">
                Alle anzeigen
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {sales.slice(0, 5).length > 0 ? (
            <div className="divide-y divide-slate-100">
              {sales.slice(0, 5).map((sale) => (
                <div key={sale.id} className="p-6 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          sale.sparte === 'Telekom' 
                            ? 'bg-pink-100 text-pink-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {sale.sparte}
                        </div>
                        <p className="font-semibold text-slate-900">{sale.customer_name}</p>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                        <span>{sale.employee_name}</span>
                        <span>•</span>
                        <span>{new Date(sale.sale_date).toLocaleDateString('de-DE')}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-slate-900">
                        {(sale.contract_value || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                      </p>
                      <p className="text-sm text-green-600 font-medium">
                        Provision: {(sale.commission_amount || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-slate-500">
              <ShoppingCart className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p>Noch keine Verkäufe vorhanden</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Teamleiter: Mitarbeiter Übersicht */}
      {isTeamleiter && (
        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-purple-50 to-indigo-50">
            <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <UserCircle className="h-5 w-5 text-purple-900" />
              Team-Provisionen aktueller Monat
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {/* Teamleiter eigene Provisionen */}
            <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-amber-800 mb-1">Meine Provisionen (eigene Verkäufe)</p>
                  <p className="text-2xl font-bold text-amber-900">
                    {teamleiterOwnCommission.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-purple-800 mb-1">Bonus-Provisionen (von Team)</p>
                  <p className="text-2xl font-bold text-purple-900">
                    {teamleiterBonusCommission.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-green-800 mb-1">Gesamt</p>
                  <p className="text-3xl font-bold text-green-900">
                    {(teamleiterOwnCommission + teamleiterBonusCommission).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </p>
                </div>
              </div>
            </div>

            {/* Mitarbeiter Übersicht */}
            {teamMembers.length > 0 && (
              <div>
                <h3 className="font-semibold text-slate-700 mb-3">Meine Mitarbeiter</h3>
                <div className="space-y-4">
                  {teamMembers.map(member => {
                const memberSales = allSales.filter(s => 
                  s.employee_id === member.email && 
                  s.sale_date?.startsWith(currentMonth)
                );
                const memberCommission = memberSales.reduce((sum, s) => sum + (s.commission_amount || 0), 0);
                
                return (
                  <div key={member.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                        <span className="text-white font-semibold text-sm">
                          {member.full_name?.charAt(0) || 'M'}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{member.full_name}</p>
                        <p className="text-sm text-slate-500">{memberSales.length} Verkäufe</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-green-600">
                        {memberCommission.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                      </p>
                      <p className="text-xs text-slate-500">Provision</p>
                    </div>
                  </div>
                  );
                })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link to={createPageUrl('Leads')}>
          <Card className="hover:shadow-lg transition-all cursor-pointer border-0 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-6">
              <Users className="h-8 w-8 mb-3" />
              <h3 className="font-semibold text-lg">Neuer Lead</h3>
              <p className="text-blue-100 text-sm mt-1">Lead hinzufügen</p>
            </CardContent>
          </Card>
        </Link>
        <Link to={createPageUrl('Sales')}>
          <Card className="hover:shadow-lg transition-all cursor-pointer border-0 bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardContent className="p-6">
              <ShoppingCart className="h-8 w-8 mb-3" />
              <h3 className="font-semibold text-lg">Neuer Verkauf</h3>
              <p className="text-green-100 text-sm mt-1">Verkauf erfassen</p>
            </CardContent>
          </Card>
        </Link>
        <Link to={createPageUrl('Chat')}>
          <Card className="hover:shadow-lg transition-all cursor-pointer border-0 bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardContent className="p-6">
              <Calendar className="h-8 w-8 mb-3" />
              <h3 className="font-semibold text-lg">Team Chat</h3>
              <p className="text-purple-100 text-sm mt-1">Mit Team kommunizieren</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}