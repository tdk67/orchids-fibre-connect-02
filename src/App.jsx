import './App.css'
import { useEffect } from 'react'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import VisualEditAgent from '@/lib/VisualEditAgent'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext.jsx';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { Button } from "@/components/ui/button";
import { createPageUrl } from './utils';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isLoadingAuth && authError?.type === 'auth_required' && location.pathname !== '/login') {
      navigate('/login', { replace: true });
    }
  }, [isLoadingAuth, authError, location.pathname, navigate]);

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
          <div className="w-full max-w-md bg-white border border-slate-200 shadow-sm rounded-xl p-6 space-y-4 text-center">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-slate-900">Anmeldung erforderlich</h1>
              <p className="text-slate-600">Bitte melden Sie sich an, um fortzufahren.</p>
            </div>
            <Button className="w-full" onClick={() => navigateToLogin()}>
              Zum Login
            </Button>
          </div>
        </div>
      );
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={createPageUrl(path)}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {

  return (
    <Router>
      <NavigationTracker />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<AuthenticatedApp />} />
      </Routes>
      <Toaster />
      <VisualEditAgent />
    </Router>
  )
}

export default App