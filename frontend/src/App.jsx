import { Routes, Route } from 'react-router-dom';
import SearchPage from './pages/SearchPage';
import SynonymPage from './pages/SynonymPage';
import './App.css';

function App() {
  return (
    <Routes>
      <Route path="/" element={<SearchPage />} />
      <Route path="/ai-synonyms" element={<SynonymPage />} />
    </Routes>
  );
}

export default App;
