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
import LeadsPage from "./sales/LeadsPage";
import LeadDetailPage from "./sales/LeadDetailPage";
import StaffTasksPage from "./sales/StaffTasksPage";
import MyQrPage from "./staff-attendance/MyQrPage";
import DevicesPage from "./staff-attendance/DevicesPage";
import MenuPage from "./menu/MenuPage";
import PhotosPage from "./photos/PhotosPage";
import NetworkAnalyticsPage from "./analytics/NetworkAnalyticsPage";
import StaffAttendanceDashboardPage from "./staff-attendance/StaffAttendanceDashboardPage";
import ParentProtectedRoute from "./parent/ParentProtectedRoute";
import ParentLayout from "./parent/ParentLayout";
import ParentHomePage from "./parent/ParentHomePage";
import ParentBillingPage from "./parent/ParentBillingPage";
import ParentAttendancePage from "./parent/ParentAttendancePage";
import ParentPhotosPage from "./parent/ParentPhotosPage";
import ParentProfilePage from "./parent/ParentProfilePage";
import KioskLayout from "./kiosk/KioskLayout";
import KioskPage from "./kiosk/KioskPage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

export default function App() {
  return (
    <ConfigProvider locale={ruRU} theme={{ token: { colorPrimary: "#2563eb" } }}>
      <AntdApp>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />

                {/* Родительский кабинет — вне BranchProvider: у родителя нет
                    ролей в филиале, он скоупится на свою семью через JWT. */}
                <Route path="/parent" element={<ParentProtectedRoute />}>
                  <Route element={<ParentLayout />}>
                    <Route index element={<ParentHomePage />} />
                    <Route path="billing" element={<ParentBillingPage />} />
                    <Route path="attendance" element={<ParentAttendancePage />} />
                    <Route path="photos" element={<ParentPhotosPage />} />
                    <Route path="profile" element={<ParentProfilePage />} />
                  </Route>
                </Route>

                {/* Киоск — вне ProtectedRoute/BranchProvider: устройство не человек,
                    у него своя сессия (KioskAuthProvider), а не JWT-логин. */}
                <Route path="/kiosk" element={<KioskLayout />}>
                  <Route index element={<KioskPage />} />
                </Route>

                <Route element={<ProtectedRoute />}>
                  <Route path="/setup-2fa" element={<TwoFactorSetupPage />} />
                  <Route
                    element={
                      <BranchProvider>
                        <AppLayout />
                      </BranchProvider>
                    }
                  >
                    <Route path="/" element={<HomePage />} />
                    <Route path="/network-analytics" element={<NetworkAnalyticsPage />} />
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
                    <Route path="/leads" element={<LeadsPage />} />
                    <Route path="/leads/:leadId" element={<LeadDetailPage />} />
                    <Route path="/tasks" element={<StaffTasksPage />} />
                    <Route path="/my-qr" element={<MyQrPage />} />
                    <Route path="/devices" element={<DevicesPage />} />
                    <Route path="/staff-attendance" element={<StaffAttendanceDashboardPage />} />
                    <Route path="/menu" element={<MenuPage />} />
                    <Route path="/photos" element={<PhotosPage />} />
                  </Route>
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </QueryClientProvider>
      </AntdApp>
    </ConfigProvider>
  );
}
