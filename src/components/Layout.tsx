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
  getLastDashboardRequestAt,
  recordDashboardRequestSuccess,
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

    function agendarVerificacao(timestamp: number) {
      proximaVerificacao = timestamp;
      window.clearTimeout(temporizador);
      temporizador = window.setTimeout(
        () => void verificarAlertas(),
        Math.max(0, timestamp - Date.now()),
      );
    }

    async function verificarAlertas() {
      if (
        !ativo
        || controladorAtivo
        || verificacaoEmAndamento
        || document.visibilityState !== 'visible'
      ) {
        return;
      }

      try {
        const proximaBuscaPermitida = getLastDashboardRequestAt() + INTERVALO_MONITORAMENTO_MS;
        if (Date.now() < proximaBuscaPermitida) {
          agendarVerificacao(proximaBuscaPermitida);
          return;
        }
      } catch (error) {
        setErroMonitoramento(
          error instanceof Error ? error.message : 'Não foi possível ler o horário da última consulta.',
        );
        agendarVerificacao(Date.now() + INTERVALO_MONITORAMENTO_MS);
        return;
      }

      verificacaoEmAndamento = true;
      temporizador = undefined;
      let consultaConcluida = false;

      if (pathnameRef.current === '/dashboard') {
        verificacaoEmAndamento = false;
        agendarVerificacao(Date.now() + INTERVALO_MONITORAMENTO_MS);
        return;
      }

      if (pathnameRef.current !== '/dashboard') {
        let lock: string | null;
        try {
          lock = await acquireDashboardRequestLock();
        } catch (error) {
          setErroMonitoramento(
            error instanceof Error ? error.message : 'Não foi possível iniciar a verificação de alertas.',
          );
          lock = null;
        }
        if (!lock) {
          verificacaoEmAndamento = false;
          agendarVerificacao(Date.now() + INTERVALO_MONITORAMENTO_MS);
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
          consultaConcluida = true;
          if (!ativo || controladorAtivo !== controlador) return;
          let erroConsulta: string | null = null;
          try {
            recordDashboardRequestSuccess(Date.now());
          } catch (error) {
            erroConsulta = error instanceof Error
              ? `A consulta foi concluída, mas não foi possível registrar seu horário: ${error.message}`
              : 'A consulta foi concluída, mas não foi possível registrar seu horário.';
          }
          try {
            processDashboardAlertCheck(dados, true);
          } catch (error) {
            erroConsulta = error instanceof Error
              ? `A consulta foi concluída, mas não foi possível processar as notificações: ${error.message}`
              : 'A consulta foi concluída, mas não foi possível processar as notificações.';
          }
          setErroMonitoramento(erroConsulta);
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

      let proximaBuscaPermitida: number;
      if (!consultaConcluida) {
        proximaBuscaPermitida = Date.now() + INTERVALO_MONITORAMENTO_MS;
      } else {
        try {
          proximaBuscaPermitida = getLastDashboardRequestAt() + INTERVALO_MONITORAMENTO_MS;
        } catch {
          proximaBuscaPermitida = Date.now() + INTERVALO_MONITORAMENTO_MS;
        }
      }
      agendarVerificacao(Math.max(Date.now(), proximaBuscaPermitida));
    }

    function sincronizarHorarioConsulta(event: StorageEvent) {
      if (event.key !== 'upx06-dashboard-last-successful-request-v1' || verificacaoEmAndamento) return;

      try {
        const proximaBuscaPermitida = getLastDashboardRequestAt() + INTERVALO_MONITORAMENTO_MS;
        agendarVerificacao(Math.max(Date.now(), proximaBuscaPermitida));
      } catch (error) {
        setErroMonitoramento(
          error instanceof Error ? error.message : 'Não foi possível sincronizar o horário da última consulta.',
        );
      }
    }

    function retomarVerificacao() {
      if (
        document.visibilityState !== 'visible'
        || verificacaoEmAndamento
        || proximaVerificacao === 0
      ) {
        return;
      }

      let proximaBuscaPermitida = proximaVerificacao;
      try {
        proximaBuscaPermitida = Math.max(
          proximaBuscaPermitida,
          getLastDashboardRequestAt() + INTERVALO_MONITORAMENTO_MS,
        );
      } catch (error) {
        setErroMonitoramento(
          error instanceof Error ? error.message : 'Não foi possível ler o horário da última consulta.',
        );
        proximaBuscaPermitida = Math.max(
          proximaBuscaPermitida,
          Date.now() + INTERVALO_MONITORAMENTO_MS,
        );
      }

      window.clearTimeout(temporizador);
      if (Date.now() >= proximaBuscaPermitida) {
        void verificarAlertas();
        return;
      }

      agendarVerificacao(proximaBuscaPermitida);
    }

    document.addEventListener('visibilitychange', retomarVerificacao);
    window.addEventListener('storage', sincronizarHorarioConsulta);
    if (document.visibilityState === 'visible') {
      void verificarAlertas();
    } else {
      proximaVerificacao = Date.now();
    }

    return () => {
      ativo = false;
      document.removeEventListener('visibilitychange', retomarVerificacao);
      window.removeEventListener('storage', sincronizarHorarioConsulta);
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