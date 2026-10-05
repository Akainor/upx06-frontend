import { useEffect, useState } from 'react';
import { AlertTriangle, Bell, CircleAlert } from 'lucide-react';
import {
  getAlertNotifications,
  markAlertsAsRead,
  subscribeToAlerts,
  type AlertNotification,
} from '../utils/alertNotifications';

const formatadorDataHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export default function Alertas() {
  const [estado, setEstado] = useState(() => {
    try {
      return { alertas: getAlertNotifications(), erro: null };
    } catch (error) {
      return {
        alertas: [] as AlertNotification[],
        erro: error instanceof Error ? error.message : 'Não foi possível carregar os alertas.',
      };
    }
  });
  const { alertas, erro } = estado;

  useEffect(() => {
    const atualizarAlertas = () => {
      try {
        setEstado({ alertas: getAlertNotifications(), erro: null });
      } catch (error) {
        setEstado({
          alertas: [],
          erro: error instanceof Error ? error.message : 'Não foi possível carregar os alertas.',
        });
      }
    };
    const cancelarInscricao = subscribeToAlerts(atualizarAlertas);

    queueMicrotask(() => {
      try {
        markAlertsAsRead();
      } catch (error) {
        setEstado((atual) => ({
          ...atual,
          erro: error instanceof Error ? error.message : 'Não foi possível marcar os alertas como lidos.',
        }));
      }
    });

    return cancelarInscricao;
  }, []);

  return (
    <div className="alertas-page">
      <header className="alertas-header">
        <div>
          <h1>Alertas</h1>
          <p>Notificações geradas pelas medições de qualidade da água.</p>
        </div>
        <span className="alertas-count">{alertas.length} de 10 recentes</span>
      </header>

      {erro && <p className="alertas-error" role="alert">{erro}</p>}

      {alertas.length === 0 ? (
        <div className="alertas-empty">
          <Bell size={28} />
          <p>Nenhuma notificação no momento.</p>
        </div>
      ) : (
        <ol className="alertas-list">
          {alertas.map((alerta) => {
            const Critico = alerta.severity === 'vermelho' ? CircleAlert : AlertTriangle;
            return (
              <li
                key={alerta.id}
                className={`alerta-item ${alerta.severity} ${alerta.read ? 'read' : 'unread'}`}
              >
                <Critico className="alerta-icon" size={22} aria-hidden="true" />
                <div className="alerta-content">
                  <p>{alerta.message}</p>
                  <time dateTime={new Date(alerta.createdAt).toISOString()}>
                    {formatadorDataHora.format(alerta.createdAt)} (horário de Brasília)
                  </time>
                </div>
                {!alerta.read && <span className="alerta-new-label">Novo</span>}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}