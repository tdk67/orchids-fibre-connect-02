import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, ExternalLink, RefreshCw } from 'lucide-react';

export default function Outlook() {
  const [user, setUser] = useState(null);
  const [iframeKey, setIframeKey] = useState(0);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  const currentEmployee = employees.find(e => e.email === user?.email);
  const roundcubeUrl = currentEmployee?.email_adresse 
    ? `https://webmail.career-agents.de/?_user=${encodeURIComponent(currentEmployee.email_adresse)}`
    : 'https://webmail.career-agents.de/';

  const handleRefresh = () => {
    setIframeKey(prev => prev + 1);
  };

  const handleOpenExternal = () => {
    window.open(roundcubeUrl, '_blank');
  };

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col space-y-4">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">E-Mail</h1>
          <p className="text-slate-500 mt-1">Roundcube Webmail (Career Agents)</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Neu laden
          </Button>
          <Button onClick={handleOpenExternal} className="bg-blue-900 hover:bg-blue-800">
            <ExternalLink className="h-4 w-4 mr-2" />
            In neuem Tab öffnen
          </Button>
        </div>
      </div>

      {!currentEmployee?.email_adresse && (
        <Card className="border-0 shadow-md bg-amber-50 border-amber-200 flex-shrink-0">
          <CardContent className="p-4">
            <p className="text-amber-900 font-semibold">
              ⚠️ E-Mail-Adresse fehlt! Bitte konfigurieren Sie Ihre E-Mail-Adresse in der Mitarbeiterverwaltung.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-md flex-1 min-h-0">
        <CardContent className="p-0 h-full">
          <iframe
            key={iframeKey}
            src={roundcubeUrl}
            className="w-full h-full border-0 rounded-lg"
            title="Roundcube Webmail"
            allow="clipboard-read; clipboard-write"
          />
        </CardContent>
      </Card>
    </div>
  );
}