import React from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export default function AngebotPDFGenerator({ lead, onClose }) {
  const getProductTemplate = (produkt) => {
    const templates = {
      'Connect Basic': {
        title: '1&1 Glasfaser Connect Basic',
        options: [
          { speed: '300/100', preis1Jahr: '89,90€', preisAb2Jahr: '119,90€', hardware: '99€' },
          { speed: '600/200', preis1Jahr: '99,90€', preisAb2Jahr: '179,90€', hardware: '99€' },
          { speed: '1000/300', preis1Jahr: '139,90€', preisAb2Jahr: '239,90€', hardware: '99€' }
        ],
        servicepaket: 'Unser Internet-Servicepaket umfasst die Internet-Flatrate sowie eine feste IPv4-Adresse. Für Neukunden wird ein Wechselbonus angeboten, der bis zu zwölf Monate eine Befreiung von der Grundgebühr ermöglicht. Im Service enthalten ist weiterhin ein Premium Einrichtungs- und Wechselservice, durch den die Umstellung erleichtert wird. Es entstehen keine zusätzlichen Baukosten oder Anschlussgebühren. Im Falle von Störungen steht ein Express-Entstörungsdienst zur Verfügung.'
      },
      'Office Fast And Secure': {
        title: '1&1 Glasfaser Office Fast&Secure',
        options: [
          { speed: '150/50', preis1Jahr: '49,99€', preisAb2Jahr: '59,99€', hardware: '149€' },
          { speed: '300/100', preis1Jahr: '59,99€', preisAb2Jahr: '79,99€', hardware: '149€' },
          { speed: '600/200', preis1Jahr: '79,99€', preisAb2Jahr: '99,99€', hardware: '149€' },
          { speed: '1000/300', preis1Jahr: '99,99€', preisAb2Jahr: '109,99€', hardware: '149€' }
        ],
        servicepaket: 'Internet-Flat, eine dynamische öffentliche IPv4 WAN-Adresse und private LAN-Adressen, Schutz vor Phishing, Malware, Ransomware, Spyware sowie DDoS-Angriffen, Inklusive IP-Telefonanlagen-Funktion, Premium Einrichtungs- und Wechselservice, 2 SIP-Sprachkanäle mit bis zu 10 Einzelrufnummern.'
      },
      'Premium': {
        title: '1&1 Glasfaser Premium',
        options: [
          { speed: '300/300', preis: '449,00€', hardware36: '1500€', hardware48: '1000€', hardware60: '0€', router: 'Lancom' },
          { speed: '600/600', preis: '619,00€', hardware36: '1500€', hardware48: '1000€', hardware60: '0€', router: 'Cisco' },
          { speed: '1000/1000', preis: '749,00€', hardware36: '1500€', hardware48: '1000€', hardware60: '0€', router: 'Cisco' }
        ],
        servicepaket: 'Unser Internet-Servicepaket beinhaltet eine Internet-Flatrate sowie private IPv4- und IPv6-Adressen. Es fallen keine Baukosten oder Gebühren für den Glasfaser-Gebäudeanschluss an. Kunden haben Zugang zu einer Business-Hotline und profitieren von einem Service-Level-Agreement (SLA) Profi, das eine Entstörzeit von 24 Stunden täglich, 365 Tage im Jahr, sicherstellt. Weitere Dienstleistungen im Paket umfassen CPE Management und symmetrische sowie garantierte Bandbreiten, um eine durchgängige Servicequalität zu gewährleisten.'
      },
      'Premium Pug 2': {
        title: '1&1 Glasfaser Premium PUG 2',
        options: [
          { speed: '300/300', preis: '449,00€', vermarktung: '275,00€', hardware36: '1500€', hardware48: '1000€', hardware60: '0€', router: 'Lancom' },
          { speed: '600/600', preis: '619,00€', vermarktung: '410,00€', hardware36: '1500€', hardware48: '1000€', hardware60: '0€', router: 'Cisco' },
          { speed: '1000/1000', preis: '749,00€', vermarktung: '475,00€', hardware36: '1500€', hardware48: '1000€', hardware60: '0€', router: 'Cisco' }
        ],
        servicepaket: 'Unser Internet-Servicepaket beinhaltet eine Internet-Flatrate sowie private IPv4- und IPv6-Adressen. Es fallen keine Baukosten oder Gebühren für den Glasfaser-Gebäudeanschluss an. Kunden haben Zugang zu einer Business-Hotline und profitieren von einem Service-Level-Agreement (SLA) Profi, das eine Entstörzeit von 24 Stunden täglich, 365 Tage im Jahr, sicherstellt. Weitere Dienstleistungen im Paket umfassen CPE Management und symmetrische sowie garantierte Bandbreiten, um eine durchgängige Servicequalität zu gewährleisten.'
      },
      'Premium Pug 3': {
        title: '1&1 Glasfaser Premium PUG 3',
        options: [
          { speed: '300/300', preis: '449,00€', vermarktung: '350,00€', hardware36: '1500€', hardware48: '1000€', hardware60: '0€', router: 'Lancom' },
          { speed: '600/600', preis: '619,00€', vermarktung: '545,00€', hardware36: '1500€', hardware48: '1000€', hardware60: '0€', router: 'Cisco' },
          { speed: '1000/1000', preis: '749,00€', vermarktung: '591,00€', hardware36: '1500€', hardware48: '1000€', hardware60: '0€', router: 'Cisco' }
        ],
        servicepaket: 'Unser Internet-Servicepaket beinhaltet eine Internet-Flatrate sowie private IPv4- und IPv6-Adressen. Es fallen keine Baukosten oder Gebühren für den Glasfaser-Gebäudeanschluss an. Kunden haben Zugang zu einer Business-Hotline und profitieren von einem Service-Level-Agreement (SLA) Profi, das eine Entstörzeit von 24 Stunden täglich, 365 Tage im Jahr, sicherstellt. Weitere Dienstleistungen im Paket umfassen CPE Management und symmetrische sowie garantierte Bandbreiten, um eine durchgängige Servicequalität zu gewährleisten.'
      }
    };
    return templates[produkt] || templates['Office Fast And Secure'];
  };

  const template = getProductTemplate(lead.produkt);
  const isPremium = lead.produkt?.toLowerCase().includes('premium');

  return (
    <div className="bg-white p-8 max-w-4xl mx-auto" id="angebot-content">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">CAREER AGENTS</h1>
          <p className="text-sm text-slate-600">EINFACH ERFOLGREICH</p>
        </div>
        <div className="text-right">
          <img 
            src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/1%261_Versatel_logo.svg/2560px-1%261_Versatel_logo.svg.png"
            alt="1&1 Versatel"
            className="h-12 mb-2"
          />
          <p className="text-xs text-slate-500">PARTNER</p>
        </div>
      </div>

      {/* Absender */}
      <p className="text-xs text-slate-500 mb-6">
        Career Agents – Bottroper Straße 8 - 70376 Stuttgart
      </p>

      {/* Empfänger */}
      <div className="mb-8">
        <p className="font-semibold">{lead.firma}</p>
        <p>{lead.strasse_hausnummer}</p>
        <p>{lead.postleitzahl} {lead.stadt}</p>
      </div>

      {/* Datum */}
      <p className="text-right text-sm mb-8">
        Stuttgart, {format(new Date(), 'dd.MM.yyyy', { locale: de })}
      </p>

      {/* Titel */}
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-2">Angebot</h2>
        <h3 className="text-lg font-semibold text-slate-700">
          Glasfaseranschluss für Ihr Unternehmen
        </h3>
      </div>

      {/* Anrede */}
      <p className="mb-4">
        Sehr geehrte Damen und Herren{lead.ansprechpartner ? `, sehr geehrter Herr/Frau ${lead.ansprechpartner}` : ''},
      </p>

      <p className="mb-6">
        anbei übersenden wir Ihnen unser Angebot für die Adresse:<br />
        <strong>{lead.strasse_hausnummer}, {lead.postleitzahl} {lead.stadt}</strong>
      </p>

      {/* Produkte */}
      <div className="mb-8 space-y-4">
        {template.options.map((option, index) => (
          <div key={index} className="border-l-4 border-blue-900 pl-4">
            <h4 className="font-bold text-slate-900 mb-2">
              {template.title} {option.speed.split('/')[0]} - Download {option.speed.split('/')[0]} MBit/s und Upload {option.speed.split('/')[1]} Mbit/s
            </h4>
            <p className="text-sm mb-1">Laufzeit: 36/48/60 Monate</p>
            {!isPremium ? (
              <>
                <p className="text-sm">
                  Preis 1. Jahr: {option.preis1Jahr} / mtl. 
                  {option.preisAb2Jahr && ` Preis ab dem 2. Jahr ${option.preisAb2Jahr} / mtl.`}
                </p>
                <p className="text-sm text-slate-600">
                  Einmalgebühr für AVM Fritz!box Hardware: {option.hardware}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm">
                  Preis: {option.preis} mtl.
                  {option.vermarktung && ` Vermarktungspreis: ${option.vermarktung} mtl.`}
                </p>
                <p className="text-sm text-slate-600">
                  Hardware Premium-Router vom Marktführer {option.router}: einmalig 36 Monate {option.hardware36}, 48 Monate {option.hardware48}, 60 Monate {option.hardware60}
                </p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Servicepaket */}
      <div className="mb-8">
        <h4 className="font-bold text-slate-900 mb-2 underline">Unser Servicepaket</h4>
        <p className="text-sm text-justify leading-relaxed">
          {template.servicepaket}
        </p>
      </div>

      {/* Weitere Angebotsbestimmungen */}
      <div className="mb-8">
        <h4 className="font-bold text-slate-900 mb-2 underline">Weitere Angebotsbestimmungen</h4>
        <p className="text-sm">
          Alle Preise sind Nettopreise und verstehen sich zzgl. der jeweils gültigen gesetzlichen Mehrwertsteuer.
        </p>
      </div>

      {/* Kontakt */}
      <div className="mb-8">
        <p className="font-semibold text-sm">Business Sales Manager</p>
        <p className="text-sm">{lead.assigned_to || 'Career Agents Team'}</p>
      </div>

      {/* Footer */}
      <div className="border-t pt-4 text-center text-xs text-slate-500">
        <p className="font-bold">CAREER AGENTS</p>
        <p>Bottroper Str. 8, 70376 Stuttgart, Germany</p>
        <p>Telefon: 0171 8197956 / E-Mail: oezdemir@career-agents.de</p>
        <p>Geschäftsführung: Emirhan Özdemir</p>
      </div>
    </div>
  );
}