import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Employees from './pages/Employees';
import Sales from './pages/Sales';
import Commissions from './pages/Commissions';
import CreditNotes from './pages/CreditNotes';
import Chat from './pages/Chat';
import Leads from './pages/Leads';
import LeadStatusSettings from './pages/LeadStatusSettings';
import Verkaufschancen from './pages/Verkaufschancen';
import Postfach from './pages/Postfach';
import Provisionsregeln from './pages/Provisionsregeln';
import PVP from './pages/PVP';
import Unternehmenssuche from './pages/Unternehmenssuche';
import Bestandskunden from './pages/Bestandskunden';
import Kalender from './pages/Kalender';
import IonOSMail from './pages/IonOSMail';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Customers": Customers,
    "Employees": Employees,
    "Sales": Sales,
    "Commissions": Commissions,
    "CreditNotes": CreditNotes,
    "Chat": Chat,
    "Leads": Leads,
    "LeadStatusSettings": LeadStatusSettings,
    "Verkaufschancen": Verkaufschancen,
    "Postfach": Postfach,
    "Provisionsregeln": Provisionsregeln,
    "PVP": PVP,
    "Unternehmenssuche": Unternehmenssuche,
    "Bestandskunden": Bestandskunden,
    "Kalender": Kalender,
    "IonOSMail": IonOSMail,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};