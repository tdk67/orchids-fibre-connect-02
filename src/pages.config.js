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
import Provisionsregeln from './pages/Provisionsregeln';
    import Unternehmenssuche from './pages/Unternehmenssuche';
    import Bestandskunden from './pages/Bestandskunden';
    import Kalender from './pages/Kalender';
    import LeadDetails from './pages/LeadDetails';
    import LeadPool from './pages/LeadPool';
    import Outlook from './pages/Outlook';
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
        "Provisionsregeln": Provisionsregeln,
        "Unternehmenssuche": Unternehmenssuche,
        "Bestandskunden": Bestandskunden,
        "Kalender": Kalender,
        "LeadDetails": LeadDetails,
        "LeadPool": LeadPool,
        "Outlook": Outlook,
    }

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};