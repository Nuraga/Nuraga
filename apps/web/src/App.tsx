import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider, App as AntdApp } from "antd";
import ruRU from "antd/locale/ru_RU";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import LoginPage from "./auth/LoginPage";
import TwoFactorSetupPage from "./auth/TwoFactorSetupPage";
import { BranchProvider } from "./layout/BranchContext";
import ProtectedRoute from "./layout/ProtectedRoute";
import AppLayout from "./layout/AppLayout";
import HomePage from "./pages/HomePage";
import BranchesPage from "./branches/BranchesPage";
import GroupsPage from "./groups/GroupsPage";
import StaffPage from "./staff/StaffPage";
import DictionariesPage from "./dictionaries/DictionariesPage";
import FamiliesPage from "./families/FamiliesPage";
import FamilyDetailPage from "./families/FamilyDetailPage";
import ChildrenPage from "./children/ChildrenPage";
import ChildDetailPage from "./children/ChildDetailPage";
import WaitlistPage from "./enrollment/WaitlistPage";
import AttendancePage from "./attendance/AttendancePage";
import TimesheetsPage from "./attendance/TimesheetsPage";
import ImportPage from "./import/ImportPage";
import ReportsPage from "./reports/ReportsPage";
import TariffsPage from "./billing/TariffsPage";
import ServicesPage from "./billing/ServicesPage";
import InvoicingPage from "./billing/InvoicingPage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

export default function App() {
  return (
    <ConfigProvider locale={ruRU} theme={{ token: { colorPrimary: "#2563eb" } }}>
      <AntdApp>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <BranchProvider>
              <BrowserRouter>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route element={<ProtectedRoute />}>
                    <Route path="/setup-2fa" element={<TwoFactorSetupPage />} />
                    <Route element={<AppLayout />}>
                      <Route path="/" element={<HomePage />} />
                      <Route path="/branches" element={<BranchesPage />} />
                      <Route path="/groups" element={<GroupsPage />} />
                      <Route path="/staff" element={<StaffPage />} />
                      <Route path="/dictionaries" element={<DictionariesPage />} />
                      <Route path="/families" element={<FamiliesPage />} />
                      <Route path="/families/:familyId" element={<FamilyDetailPage />} />
                      <Route path="/children" element={<ChildrenPage />} />
                      <Route path="/children/:childId" element={<ChildDetailPage />} />
                      <Route path="/waitlist" element={<WaitlistPage />} />
                      <Route path="/attendance" element={<AttendancePage />} />
                      <Route path="/timesheets" element={<TimesheetsPage />} />
                      <Route path="/import" element={<ImportPage />} />
                      <Route path="/reports" element={<ReportsPage />} />
                      <Route path="/tariffs" element={<TariffsPage />} />
                      <Route path="/services" element={<ServicesPage />} />
                      <Route path="/invoicing" element={<InvoicingPage />} />
                    </Route>
                  </Route>
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </BrowserRouter>
            </BranchProvider>
          </AuthProvider>
        </QueryClientProvider>
      </AntdApp>
    </ConfigProvider>
  );
}
