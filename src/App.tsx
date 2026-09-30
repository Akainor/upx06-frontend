import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Historico from './pages/Historico';
import Alertas from './pages/Alertas';
import Comparacao from './pages/Comparacao';
import Sobre from './pages/Sobre';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="historico" element={<Historico />} />
          <Route path="alertas" element={<Alertas />} />
          <Route path="comparacao" element={<Comparacao />} />
          <Route path="sobre" element={<Sobre />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}