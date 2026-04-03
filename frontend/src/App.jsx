import { Routes, Route } from 'react-router-dom';
import SearchPage from './pages/SearchPage';
import SynonymPage from './pages/SynonymPage';
import DashboardPage from './pages/DashboardPage';
import ThresholdSettings from './components/ThresholdSettings';
import './App.css';

function App() {
  return (
    <Routes>
      <Route path="/" element={<SearchPage />} />
      <Route path="/ai-synonyms" element={<SynonymPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/settings/thresholds" element={<ThresholdSettings />} />
    </Routes>
  );
}

export default App;
