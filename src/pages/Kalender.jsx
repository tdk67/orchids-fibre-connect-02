import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, AlertCircle, Plus, ExternalLink } from 'lucide-react';

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Mein Kalender</h1>
          <p className="text-slate-500 mt-1">Verwalten Sie Ihre Termine</p>
        </div>
        <Button 
          onClick={() => window.open('https://calendar.google.com/calendar/u/0/r', '_blank')}
          className="bg-blue-900 hover:bg-blue-800"
        >
          <Plus className="h-4 w-4 mr-2" />
          Termin hinzufügen
        </Button>
      </div>

      {/* Calendar Content */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-0">
          <div className="w-full" style={{ height: 'calc(100vh - 200px)' }}>
            <iframe
              src="https://calendar.google.com/calendar/embed?height=600&wkst=1&ctz=Europe%2FBerlin&showPrint=0&src=a2FmZmkxOTg4QGdtYWlsLmNvbQ&src=NWE3MDUwZWFjZjE3NzFhODMwNzA5MWJlNmNlZGVlY2Y0NWU2YjNhOWU4ODZiMjI4YmNjOWU1MzAxZjE0YzY2OEBncm91cC5jYWxlbmRhci5nb29nbGUuY29t&src=NDM0YzE1NjE0NTU4ZWE2ZWIwOWExMzNkYzcyMDdlMTJmYzExNTQ0YzQ2ZDhlZTU2YzU3YmFkZDg0MzQ2ODBjYkBncm91cC5jYWxlbmRhci5nb29nbGUuY29t&src=OTg5NTU2MjhjYjg1N2FhOTM2OGIwNWRlY2M4MmEwMGNmN2VhOGU2M2Y4NTI4NjE2Nzc5MTQ5Y2Q2OWUzNmQwZUBncm91cC5jYWxlbmRhci5nb29nbGUuY29t&src=ZDc1Y2ZmZWRjMGE4NzhmN2VhMzY1ODI3MDc0Mjc1YTY0ZWI1NjUzMjNiODAzNjgwYmQyM2IwZDhjYWQ1YTJmY0Bncm91cC5jYWxlbmRhci5nb29nbGUuY29t&src=NGE5ZWZlN2NmNTI2NjZkYjU2NDYyYmQzOGI1OGZiNDY1ZTFhMmRlNjEzMDYwNTYzYjIwNzY1MDcwMWFjNzc2YkBncm91cC5jYWxlbmRhci5nb29nbGUuY29t&src=ZGUuZ2VybWFuI2hvbGlkYXlAZ3JvdXAudi5jYWxlbmRhci5nb29nbGUuY29t&src=ZGFuY2FrbGVvbmFyZG9AZ21haWwuY29t&color=%23039be5&color=%23a79b8e&color=%23d81b60&color=%23795548&color=%23b39ddb&color=%23f09300&color=%230b8043&color=%239e69af"
              className="w-full h-full rounded-lg border border-slate-200"
              style={{ border: 'solid 1px #777' }}
              frameBorder="0"
              scrolling="no"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}