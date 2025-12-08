import React from 'react';

export default function Outlook() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Outlook</h1>
        <p className="text-slate-500 mt-1">E-Mail Verwaltung</p>
      </div>

      <iframe 
        src="https://outlook.office.com" 
        width="100%" 
        height="600px" 
        frameBorder="0"
        title="Outlook"
      />
    </div>
  );
}