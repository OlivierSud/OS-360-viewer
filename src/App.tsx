import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import EditorPage from './pages/EditorPage';
import ViewerPage from './pages/ViewerPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/editor" element={<EditorPage />} />
        <Route path="/viewer" element={<ViewerPage />} />
        <Route path="*" element={<Navigate to="/editor" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
