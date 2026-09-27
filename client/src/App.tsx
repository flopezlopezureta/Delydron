import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { NavBar } from './components/layout/NavBar';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { MissionsPage } from './pages/MissionsPage';
import { MissionPlannerPage } from './pages/MissionPlannerPage';
import { BasesPage } from './pages/BasesPage';
import { NoFlyZonesPage } from './pages/NoFlyZonesPage';
import { DeliveriesPage } from './pages/DeliveriesPage';
import { ConfigPage } from './pages/ConfigPage';
import { UsersPage } from './pages/UsersPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { MissionCertificatePage } from './pages/MissionCertificatePage';
import { TrackingPage } from './pages/TrackingPage';
import { DeliveryPointPage } from './pages/DeliveryPointPage';

function AppShell() {
  return (
    <div className="flex h-full flex-col">
      <NavBar />
      <div className="flex-1 overflow-hidden bg-slate-50">
        <Outlet />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          {/* Public — no account needed, shared straight with a client. */}
          <Route path="/t/:token" element={<TrackingPage />} />
          {/* PEC — punto de entrega cliente, one link per destination. */}
          <Route path="/pec/:token" element={<DeliveryPointPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="missions" element={<MissionsPage />} />
            <Route path="missions/new" element={<MissionPlannerPage />} />
            <Route path="bases" element={<BasesPage />} />
            <Route path="no-fly-zones" element={<NoFlyZonesPage />} />
            <Route path="deliveries" element={<DeliveriesPage />} />
            <Route path="config" element={<ConfigPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="audit" element={<AuditLogPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="missions/:id/certificate" element={<MissionCertificatePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
