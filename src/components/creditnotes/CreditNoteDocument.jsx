import React from 'react';

export default function CreditNoteDocument({ creditNote, employee, sales }) {
  // Provision ist Brutto - berechne Netto und MwSt
  const brutto = creditNote.total_commission || 0;
  const mwstRate = 0.19;
  const netto = brutto / (1 + mwstRate);
  const mwst = brutto - netto;

  return (
    <div id="credit-note-document" className="bg-white p-8 w-full h-full min-h-[297mm]" style={{ fontFamily: 'Arial, sans-serif', width: '210mm', height: '297mm' }}>
      {/* Header with Logo */}
      <div className="text-center mb-6">
        <img 
          src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691d914be3952e3190d4dbb7/fd4ebd25d_EE-logo-1-1e3f66-1024x576.png"
          alt="Career Agents"
          className="h-24 w-auto mx-auto object-contain"
        />
      </div>

      {/* Company Address */}
      <div className="text-xs text-slate-600 mb-4">
        CAREER AGENTS | Seelbacher Weg 4, 35764 Sinn, Germany
      </div>

      {/* Employee Address */}
      <div className="mb-6">
        <p className="font-semibold text-sm">{employee?.full_name || creditNote.employee_name}</p>
        {employee?.address && <p className="text-sm">{employee.address}</p>}
        {(employee?.postal_code || employee?.city) && (
          <p className="text-sm">{employee?.postal_code} {employee?.city}</p>
        )}
      </div>

      {/* Title and Details */}
      <div className="mb-4">
        <h2 className="text-2xl font-bold mb-3">Gutschrift</h2>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="font-semibold">Datum:</span>
          </div>
          <div>
            {new Date(creditNote.issued_date).toLocaleDateString('de-DE')}
          </div>
          <div>
            <span className="font-semibold">Partner:</span>
          </div>
          <div>
            {creditNote.employee_name}
          </div>
          <div>
            <span className="font-semibold">Abrechnungsnummer:</span>
          </div>
          <div>
            {creditNote.credit_note_number}
          </div>
          <div>
            <span className="font-semibold">Steuernummer:</span>
          </div>
          <div>
            {employee?.tax_id || '021/809/37508'}
          </div>
        </div>
      </div>

      <p className="text-xs mb-4">
        Ihre Provisionsabrechnung/Gutschrift zum Stichtag {new Date(creditNote.issued_date).toLocaleDateString('de-DE')}
      </p>

      {/* Sales Table */}
      <div className="mb-4">
        <table className="w-full border-t-2 border-b-2 border-slate-800">
          <thead>
            <tr className="text-xs">
              <th className="text-left py-2 font-semibold">Kunde und Tarif</th>
              <th className="text-right py-2 font-semibold">Anzahl</th>
              <th className="text-right py-2 font-semibold">Netto</th>
              <th className="text-right py-2 font-semibold">MwSt</th>
              <th className="text-right py-2 font-semibold">Ust</th>
              <th className="text-right py-2 font-semibold">Brutto</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale, index) => {
              const saleBrutto = sale.commission_amount || 0;
              const saleNetto = saleBrutto / (1 + mwstRate);
              const saleMwst = saleBrutto - saleNetto;
              
              return (
                <tr key={index} className="text-xs border-b border-slate-200">
                  <td className="py-2">
                    <div className="font-semibold">{sale.customer_name}</div>
                    <div className="text-xs text-slate-600">
                      {sale.product || 'Tarif'}
                      {sale.bandwidth && ` - ${sale.bandwidth}`}
                      {sale.contract_duration_months && ` - ${sale.contract_duration_months} Monate`}
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(sale.sale_date).toLocaleDateString('de-DE')}
                    </div>
                  </td>
                  <td className="text-right">1</td>
                  <td className="text-right">{saleNetto.toFixed(2)}</td>
                  <td className="text-right">19%</td>
                  <td className="text-right">{saleMwst.toFixed(2)}</td>
                  <td className="text-right">{saleBrutto.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs mb-4">
        Die Auszahlung erfolgt auf das von Ihnen angegebene Konto.
      </p>

      <div className="border-t border-slate-300 pt-3">
        {/* Summary */}
        <div className="flex justify-end">
          <div className="w-80">
            <div className="flex justify-between py-1 text-sm">
              <span>Zwischensumme</span>
              <span className="font-semibold">{netto.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between py-1 text-sm">
              <span>Steuerbetrag</span>
              <span className="font-semibold">{mwst.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between py-1 border-t-2 border-slate-800 mt-1 pt-1 text-sm">
              <span className="font-bold">Gesamtbetrag</span>
              <span className="font-bold">{brutto.toFixed(2)} €</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-slate-300 text-center text-xs text-slate-600">
        <p>CAREER AGENTS | Seelbacher Weg 4, 35764 Sinn, Germany</p>
        <p>Postbank BIC: PBNKDEFF IBAN: DE33 1001 0010 0073 5071 40</p>
        <p>Steuernummer: 009 853 31159</p>
        <p>Steuer ID: DE361433334</p>
      </div>
    </div>
  );
}