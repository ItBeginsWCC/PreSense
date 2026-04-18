import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import DispatchView from './views/DispatchView';
import CallerView from './views/CallerView';
import EmtView from './views/EmtView';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/dispatch" element={<DispatchView />} />
        <Route path="/incident/:id" element={<CallerView />} />
        <Route path="/emt/:id" element={<EmtView />} />
        <Route path="*" element={<Navigate to="/dispatch" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
