import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkforceProvider, useWorkforce } from './context/WorkforceContext';
import { AppShell } from './components/layout/AppShell';
import { LoginScreen } from './screens/LoginScreen';
import { HomeScreen } from './screens/HomeScreen';
import { AttendanceScreen } from './screens/AttendanceScreen';
import { MyWorkScreen } from './screens/MyWorkScreen';
import { SalaryScreen } from './screens/SalaryScreen';
import { MoreScreen } from './screens/MoreScreen';
import { LeaveScreen } from './screens/LeaveScreen';
import { AdvancesScreen } from './screens/AdvancesScreen';
import { PurchasesScreen } from './screens/PurchasesScreen';
import { DocumentsScreen } from './screens/DocumentsScreen';
import { SafetyScreen } from './screens/SafetyScreen';
import { HelpDeskScreen } from './screens/HelpDeskScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { ProfileScreen } from './screens/ProfileScreen';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

const AppRoutes: React.FC = () => {
  const { token, isAuthenticated, isLoading } = useWorkforce();

  if (!token) {
    return <LoginScreen />;
  }

  if (isLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-xl bg-[#101F35] text-white font-bold flex items-center justify-center mx-auto">
            BF
          </div>
          <p className="text-sm font-medium text-[#64748B]">Loading your site workspace...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/attendance" element={<AttendanceScreen />} />
        <Route path="/work" element={<MyWorkScreen />} />
        <Route path="/salary" element={<SalaryScreen />} />
        <Route path="/more" element={<MoreScreen />} />
        <Route path="/leave" element={<LeaveScreen />} />
        <Route path="/advances" element={<AdvancesScreen />} />
        <Route path="/purchases" element={<PurchasesScreen />} />
        <Route path="/documents" element={<DocumentsScreen />} />
        <Route path="/safety" element={<SafetyScreen />} />
        <Route path="/help" element={<HelpDeskScreen />} />
        <Route path="/notifications" element={<NotificationsScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
};

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WorkforceProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </WorkforceProvider>
    </QueryClientProvider>
  );
}

export default App;
