import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { LanguageProvider, useLanguage } from "./contexts/LanguageContext";
import { AuthProvider } from "./contexts/AuthContext";
import { PublicSettingsProvider } from "./contexts/PublicSettingsContext";
import { AppLayout } from "./components/AppLayout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Register from "./pages/Register";
import Setup2FA from "./pages/Setup2FA";
import Dashboard from "./pages/Dashboard";
import Buildings from "./pages/Buildings";
import Apartments from "./pages/Apartments";
import Payments from "./pages/Payments";
import Expenses from "./pages/Expenses";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import UserManagement from "./pages/UserManagement";
import MyApartments from "./pages/MyApartments";
import ApiKeys from "./pages/ApiKeys";
import AuditLogs from "./pages/AuditLogs";
import EmailTemplates from "./pages/EmailTemplates";
import EmailLogs from "./pages/EmailLogs";
import Issues from "./pages/Issues";
import MaintenanceJobs from "./pages/MaintenanceJobs";
import Profile from "./pages/Profile";
import BulkOperations from "./pages/BulkOperations";
import Documents from "./pages/Documents";
import Portfolio from "./pages/Portfolio";
import Meetings from "./pages/Meetings";
import DebtCollection from "./pages/DebtCollection";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
};

const TitleUpdater = () => {
  const { language, t } = useLanguage();

  useEffect(() => {
    document.title = t('siteTitle');
  }, [language, t]);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <LanguageProvider>
        <ScrollToTop />
        <TitleUpdater />
        <PublicSettingsProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              {/* Unauthenticated routes — no AppLayout */}
              <Route path="/auth" element={<Auth />} />
              <Route path="/register" element={<Register />} />
              <Route path="/setup-2fa" element={<Setup2FA />} />
              {/* Authenticated routes — wrapped in AppLayout */}
              <Route path="/dashboard" element={<AppLayout><Dashboard /></AppLayout>} />
              <Route path="/buildings" element={<AppLayout><Buildings /></AppLayout>} />
              <Route path="/apartments" element={<AppLayout><Apartments /></AppLayout>} />
              <Route path="/payments" element={<AppLayout><Payments /></AppLayout>} />
              <Route path="/expenses" element={<AppLayout><Expenses /></AppLayout>} />
              <Route path="/reports" element={<AppLayout><Reports /></AppLayout>} />
              <Route path="/settings" element={<AppLayout><Settings /></AppLayout>} />
              <Route path="/users" element={<AppLayout><UserManagement /></AppLayout>} />
              <Route path="/my-apartments" element={<AppLayout><MyApartments /></AppLayout>} />
              <Route path="/api-keys" element={<AppLayout><ApiKeys /></AppLayout>} />
              <Route path="/audit-logs" element={<AppLayout><AuditLogs /></AppLayout>} />
              <Route path="/email-templates" element={<AppLayout><EmailTemplates /></AppLayout>} />
              <Route path="/email-logs" element={<AppLayout><EmailLogs /></AppLayout>} />
              <Route path="/issues" element={<AppLayout><Issues /></AppLayout>} />
              <Route path="/maintenance" element={<AppLayout><MaintenanceJobs /></AppLayout>} />
              <Route path="/profile" element={<AppLayout><Profile /></AppLayout>} />
              <Route path="/bulk-operations" element={<AppLayout><BulkOperations /></AppLayout>} />
              <Route path="/documents" element={<AppLayout><Documents /></AppLayout>} />
              <Route path="/portfolio" element={<AppLayout><Portfolio /></AppLayout>} />
              <Route path="/meetings" element={<AppLayout><Meetings /></AppLayout>} />
              <Route path="/debt-collection" element={<AppLayout><DebtCollection /></AppLayout>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </TooltipProvider>
        </AuthProvider>
        </PublicSettingsProvider>
      </LanguageProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
