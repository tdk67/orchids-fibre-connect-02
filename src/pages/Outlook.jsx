import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail } from 'lucide-react';

export default function Outlook() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Outlook</h1>
        <p className="text-slate-500 mt-1">Zugriff auf Ihr Outlook E-Mail-Konto</p>
      </div>

      <Card className="border-0 shadow-md">
        <CardHeader className="border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Mail className="h-6 w-6 text-blue-700" />
            </div>
            <CardTitle>Outlook Webmail</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="bg-blue-50 p-4 border-b border-blue-200">
            <p className="text-sm text-blue-900">
              ℹ️ Falls die Seite nicht lädt, öffnen Sie Outlook direkt:{' '}
              <a 
                href="https://outlook.office.com/mail/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="font-semibold underline hover:text-blue-700"
              >
                outlook.office.com
              </a>
            </p>
          </div>
          <iframe
            src="https://outlook.office.com/mail/"
            className="w-full border-0"
            style={{ height: 'calc(100vh - 300px)', minHeight: '600px' }}
            title="Outlook Webmail"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
          />
        </CardContent>
      </Card>
    </div>
  );
}