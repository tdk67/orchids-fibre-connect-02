import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail } from 'lucide-react';

export default function IonOSMail() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">IONOS Webmail</h1>
        <p className="text-slate-500 mt-1">Direkter Zugriff auf Ihr IONOS E-Mail-Konto</p>
      </div>

      <Card className="border-0 shadow-md">
        <CardHeader className="border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Mail className="h-6 w-6 text-blue-700" />
            </div>
            <CardTitle>IONOS Webmail Login</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="bg-blue-50 p-4 border-b border-blue-200">
            <p className="text-sm text-blue-900">
              ℹ️ Falls die Seite nicht lädt, öffnen Sie IONOS Webmail direkt:{' '}
              <a 
                href="https://mail.ionos.de/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="font-semibold underline hover:text-blue-700"
              >
                mail.ionos.de
              </a>
            </p>
          </div>
          <iframe
            src="https://mail.ionos.de/"
            className="w-full border-0"
            style={{ height: 'calc(100vh - 300px)', minHeight: '600px' }}
            title="IONOS Webmail"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
          />
        </CardContent>
      </Card>
    </div>
  );
}