import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar as CalendarIcon, AlertCircle } from 'lucide-react';

export default function Kalender() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  // Finde aktuellen Mitarbeiter
  const currentEmployee = employees.find(e => e.email === user?.email);
  const calendarLink = currentEmployee?.google_calendar_link;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Mein Kalender</h1>
        <p className="text-slate-500 mt-1">Verwalten Sie Ihre Termine</p>
      </div>

      {/* Calendar Content */}
      {calendarLink ? (
        <Card className="border-0 shadow-md">
          <CardContent className="p-0">
            <div className="w-full" style={{ height: 'calc(100vh - 200px)' }}>
              <iframe
                src={calendarLink}
                className="w-full h-full rounded-lg"
                frameBorder="0"
                scrolling="no"
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-md">
          <CardContent className="p-12">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Kein Google Kalender-Link hinterlegt. Bitte kontaktieren Sie Ihren Administrator, 
                um einen Kalender-Link in Ihren Mitarbeiter-Einstellungen zu hinterlegen.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
    </div>
  );
}