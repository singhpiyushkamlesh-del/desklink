import { Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { useDeskLinkBootstrap } from '@/hooks/useDeskLinkBootstrap';
import { PairDevicePage } from '@/pages/PairDevice/PairDevicePage';
import { DashboardPage } from '@/pages/Dashboard/DashboardPage';
import { NotificationsPage } from '@/pages/Notifications/NotificationsPage';
import { MessagesPage } from '@/pages/Messages/MessagesPage';
import { PhotosPage } from '@/pages/Photos/PhotosPage';
import { SettingsPage } from '@/pages/Settings/SettingsPage';

export function App() {
  useDeskLinkBootstrap();

  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/pair" element={<PairDevicePage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/photos" element={<PhotosPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
