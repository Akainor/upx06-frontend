import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { LayoutDashboard, History, Bell, ArrowRightLeft, Info, Droplets } from 'lucide-react';
import {
  getUnreadAlertCount,
  processDashboardAlertCheck,
  subscribeToAlerts,
} from '../utils/alertNotifications';
import {
  acquireDashboardRequestLock,
  releaseDashboardRequestLock,
} from '../utils/dashboardRequestLock';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5058';
const INTERVALO_MONITORAMENTO_MS = 15 * 60 * 1000;

export default function Layout() {
  const { pathname } = useLocation();
  const pathnameRef = useRef(pathname);
  const [alertasNaoLidos, setAlertasNaoLidos] = useState(0);
  const [erroMonitoramento, setErroMonitoramento] = useState<string | null>(null);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    function atualizarContagemAlertas() {
      try {
        setAlertasNaoLidos(getUnreadAlertCount());
      } catch (error) {
        setErroMonitoramento(
          error instanceof Error ? error.message : 'Não foi possível carregar as notificações.',
        );
      }
    }

    atualizarContagemAlertas();
    return subscribeToAlerts(atualizarContagemAlertas);
  }, []);

  useEffect(() => {
    let ativo = true;
    let controladorAtivo: AbortController | null = null;
    let temporizador: number | undefined;
    let proximaVerificacao = 0;
    let verificacaoEmAndamento = false;

    async function verificarAlertas() {
      if (
        !ativo
        || controladorAtivo
        || verificacaoEmAndamento
        || document.visibilityState !== 'visible'
      ) {
        return;
      }

      verificacaoEmAndamento = true;
      temporizador = undefined;

      if (pathnameRef.current !== '/dashboard') {
        let lock: string | null;
        try {
          lock = acquireDashboardRequestLock();
        } catch (error) {
          setErroMonitoramento(
            error instanceof Error ? error.message : 'Não foi possível iniciar a verificação de alertas.',
          );
          lock = null;
        }
        if (!lock) {
          verificacaoEmAndamento = false;
          proximaVerificacao = Date.now() + INTERVALO_MONITORAMENTO_MS;
          temporizador = window.setTimeout(() => {
            void verificarAlertas();
          }, INTERVALO_MONITORAMENTO_MS);
          return;
        }

        const controlador = new AbortController();
        controladorAtivo = controlador;
        try {
          const resposta = await fetch(`${API_URL}/Screens/Dashboard`, {
            signal: controlador.signal,
            headers: { Accept: 'application/json' },
          });
          if (!resposta.ok) {
            throw new Error(`Falha ao verificar alertas (${resposta.status}).`);
          }

          const dados: unknown = await resposta.json();
          if (!ativo || controladorAtivo !== controlador) return;
          processDashboardAlertCheck(dados, true);
          setErroMonitoramento(null);
        } catch (error) {
          if (
            ativo
            && controladorAtivo === controlador
            && (error as Error).name !== 'AbortError'
          ) {
            setErroMonitoramento(
              error instanceof Error ? error.message : 'Não foi possível verificar os alertas.',
            );
          }
        } finally {
          if (controladorAtivo === controlador) controladorAtivo = null;
          try {
            releaseDashboardRequestLock(lock);
          } catch (error) {
            if (ativo) {
              setErroMonitoramento(
                error instanceof Error ? error.message : 'Não foi possível liberar a verificação de alertas.',
              );
            }
          }
        }
      }

      verificacaoEmAndamento = false;
      if (!ativo) return;

      proximaVerificacao = Date.now() + INTERVALO_MONITORAMENTO_MS;
      temporizador = window.setTimeout(() => {
        void verificarAlertas();
      }, INTERVALO_MONITORAMENTO_MS);
    }

    function retomarVerificacao() {
      if (
        document.visibilityState !== 'visible'
        || verificacaoEmAndamento
        || proximaVerificacao === 0
        || Date.now() < proximaVerificacao
      ) {
        return;
      }

      window.clearTimeout(temporizador);
      void verificarAlertas();
    }

    document.addEventListener('visibilitychange', retomarVerificacao);
    if (document.visibilityState === 'visible') {
      void verificarAlertas();
    } else {
      proximaVerificacao = Date.now();
    }

    return () => {
      ativo = false;
      document.removeEventListener('visibilitychange', retomarVerificacao);
      window.clearTimeout(temporizador);
      controladorAtivo?.abort();
    };
  }, []);

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/historico', label: 'Histórico', icon: History },
    { path: '/alertas', label: 'Alertas', icon: Bell },
    { path: '/comparacao', label: 'Antes x Depois', icon: ArrowRightLeft },
    { path: '/sobre', label: 'Sobre o Projeto', icon: Info },
  ];

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <Droplets className="logo-icon" />
          <h1>AquaSense</h1>
        </div>
        
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => 
                  isActive ? "nav-item active" : "nav-item"
                }
              >
                <Icon className="nav-icon" />
                <span>{item.label}</span>
                {item.path === '/alertas' && alertasNaoLidos > 0 && (
                  <span
                    className="nav-alert-count"
                    aria-label={`${alertasNaoLidos} alertas não lidos`}
                    title={erroMonitoramento ?? `${alertasNaoLidos} alertas não lidos`}
                  >
                    {alertasNaoLidos}
                  </span>
                )}
                {item.path === '/alertas' && alertasNaoLidos === 0 && erroMonitoramento && (
                  <span className="nav-alert-error" title={erroMonitoramento} aria-label={erroMonitoramento} />
                )}
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}