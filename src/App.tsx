import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { MainLayout } from '@/components/layout/MainLayout'
import LoginPage from '@/app/login/page'
import DashboardPage from '@/app/page'
import TechnicianPage from '@/app/technician/page'
import TechnicianChecklistPage from '@/app/technician/checklist/[id]/page'
import ScanPage from '@/app/scan/page'
import ApprovalsPage from '@/app/approvals/page'
import ManagerPage from '@/app/manager/page'
import InventoryPage from '@/app/inventory/page'
import ClientsPage from '@/app/clients/page'
import OrdersPage from '@/app/orders/page'
import ProfilePage from '@/app/profile/page'
import UsersManagementPage from '@/app/admin/users/page'
import AdminSettingsPage from '@/app/admin/settings/page'
import AdminChecklistPage from '@/app/admin/checklist/page'
import { useAuth } from '@/components/providers/AuthProvider'
import { ReloadPrompt } from '@/components/ReloadPrompt'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <MainLayout>{null}</MainLayout>; // Show loading state

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <Router>
      <ReloadPrompt />
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Rotas protegidas */}
        <Route path="/" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
        <Route path="/scan" element={<PrivateRoute><ScanPage /></PrivateRoute>} />
        <Route path="/technician" element={<PrivateRoute><TechnicianPage /></PrivateRoute>} />
        <Route path="/technician/checklist/:id" element={<PrivateRoute><TechnicianChecklistPage /></PrivateRoute>} />
        <Route path="/approvals" element={<PrivateRoute><ApprovalsPage /></PrivateRoute>} />
        <Route path="/manager" element={<PrivateRoute><ManagerPage /></PrivateRoute>} />
        <Route path="/inventory" element={<PrivateRoute><InventoryPage /></PrivateRoute>} />
        <Route path="/clients" element={<PrivateRoute><ClientsPage /></PrivateRoute>} />
        <Route path="/orders" element={<PrivateRoute><OrdersPage /></PrivateRoute>} />
        <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
        <Route path="/admin/users" element={<PrivateRoute><UsersManagementPage /></PrivateRoute>} />
        <Route path="/admin/checklist" element={<PrivateRoute><AdminChecklistPage /></PrivateRoute>} />
        <Route path="/admin/settings" element={<PrivateRoute><AdminSettingsPage /></PrivateRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}

export default App
