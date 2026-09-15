import { Routes, Route, Navigate } from 'react-router';
import { AppLayout } from './components/AppLayout';
import { ChatPage } from './pages/ChatPage';
import { MemoriesPage } from './pages/MemoriesPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { OperationsPage } from './pages/OperationsPage';
import { TasksPage } from './pages/TasksPage';
import './App.css';

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/chat" replace />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/memories" element={<MemoriesPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/operations" element={<OperationsPage />} />
        <Route path="/tasks" element={<TasksPage />} />
      </Route>
    </Routes>
  );
}

export default App;
