import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Employees from './pages/Employees';
import Sales from './pages/Sales';
import Commissions from './pages/Commissions';
import CreditNotes from './pages/CreditNotes';
import Chat from './pages/Chat';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Customers": Customers,
    "Employees": Employees,
    "Sales": Sales,
    "Commissions": Commissions,
    "CreditNotes": CreditNotes,
    "Chat": Chat,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};