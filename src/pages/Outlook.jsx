import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Mail } from 'lucide-react';

export default function Outlook() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  const currentEmployee = employees.find(e => e.email === user?.email);
  const roundcubeUrl = currentEmployee?.email_adresse 
    ? `https://webmail.ionos.de/?_user=${encodeURIComponent(currentEmployee.email_adresse)}`
    : 'https://webmail.ionos.de/';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">E-Mail</h1>
          <p className="text-slate-500 mt-1">Roundcube Webmail (IONOS)</p>
        </div>
      </div>

      {!currentEmployee?.email_adresse && (
        <Card className="border-0 shadow-md bg-amber-50 border-amber-200">
          <CardContent className="p-4">
            <p className="text-amber-900 font-semibold">
              ⚠️ E-Mail-Adresse fehlt! Bitte konfigurieren Sie Ihre E-Mail-Adresse in der Mitarbeiterverwaltung.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-md h-[calc(100vh-200px)]">
        <CardContent className="p-0 h-full">
          <iframe
            src={roundcubeUrl}
            className="w-full h-full border-0 rounded-lg"
            title="Roundcube Webmail"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
          />
        </CardContent>
      </Card>
    </div>
  );
}