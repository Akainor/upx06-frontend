import { getMetricStatus, type MetricAttribute, type MetricStatus } from './metricStatus';

type StatusCor = MetricStatus;
type AttributeId = MetricAttribute;
type Severity = 'amarelo' | 'vermelho';

export interface AlertNotification {
  id: string;
  createdAt: number;
  severity: Severity;
  message: string;
  read: boolean;
}

interface YellowStreak {
  count: number;
  notified: boolean;
}

type YellowStreaks = Partial<Record<AttributeId, YellowStreak>>;

interface MetricResult {
  value: number;
  isSuccessful: boolean;
  evaluator: {
    lowerBound: number;
    upperBound: number;
    isEnabled: boolean;
  };
}

interface Evaluation {
  phEvaluationResult: MetricResult;
  turbidityEvaluationResult: MetricResult;
  temperatureEvaluationResult: MetricResult;
  tdsEvaluationResult: MetricResult;
}

const ALERTS_STORAGE_KEY = 'upx06-dashboard-alerts-v1';
const YELLOW_STREAKS_STORAGE_KEY = 'upx06-dashboard-yellow-streaks-v1';
export const ALERTS_UPDATED_EVENT = 'upx06-dashboard-alerts-updated';
const MAX_ALERTS = 10;

const ATTRIBUTES: { id: AttributeId; label: string }[] = [
  { id: 'ph', label: 'pH' },
  { id: 'turbidez', label: 'Turbidez' },
  { id: 'temp', label: 'Temperatura' },
  { id: 'tds', label: 'TDS' },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAlertNotification(value: unknown): value is AlertNotification {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.createdAt === 'number'
    && (value.severity === 'amarelo' || value.severity === 'vermelho')
    && typeof value.message === 'string'
    && typeof value.read === 'boolean';
}

function isMetricResult(value: unknown): value is MetricResult {
  if (!isRecord(value) || !isRecord(value.evaluator)) return false;

  return typeof value.value === 'number'
    && typeof value.isSuccessful === 'boolean'
    && typeof value.evaluator.lowerBound === 'number'
    && typeof value.evaluator.upperBound === 'number'
    && typeof value.evaluator.isEnabled === 'boolean';
}

function readEvaluation(data: unknown): Evaluation | null {
  if (!isRecord(data)) {
    throw new Error('A API retornou dados inválidos; não foi possível verificar os alertas.');
  }
  if (data.latestSampleEvaluation === null) return null;
  if (!isRecord(data.latestSampleEvaluation)) {
    throw new Error('A API não retornou a avaliação esperada para verificar os alertas.');
  }

  const evaluation = data.latestSampleEvaluation;
  if (
    !isMetricResult(evaluation.phEvaluationResult)
    || !isMetricResult(evaluation.turbidityEvaluationResult)
    || !isMetricResult(evaluation.temperatureEvaluationResult)
    || !isMetricResult(evaluation.tdsEvaluationResult)
  ) {
    throw new Error('A API retornou avaliações inválidas; não foi possível verificar os alertas.');
  }

  return {
    phEvaluationResult: evaluation.phEvaluationResult,
    turbidityEvaluationResult: evaluation.turbidityEvaluationResult,
    temperatureEvaluationResult: evaluation.temperatureEvaluationResult,
    tdsEvaluationResult: evaluation.tdsEvaluationResult,
  };
}

function formatarValor(valor: number, atributo: AttributeId): string {
  const casasDecimais = atributo === 'ph' || atributo === 'turbidez' ? 1 : 0;
  const valorFormatado = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: casasDecimais }).format(valor);
  const unidade = atributo === 'turbidez' ? ' NTU' : atributo === 'tds' ? ' mg/L' : atributo === 'temp' ? ' °C' : '';
  return `${valorFormatado}${unidade}`;
}

function formatarDistancia(distancia: number, atributo: AttributeId): string {
  return formatarValor(Math.abs(distancia), atributo);
}

function descreverEstado(
  metric: MetricResult,
  attribute: AttributeId,
  severity: Severity,
): string {
  const label = ATTRIBUTES.find(({ id }) => id === attribute)?.label ?? attribute;
  const valor = formatarValor(metric.value, attribute);

  if (!metric.evaluator.isEnabled) {
    return `${label}: ${valor}; avaliação desativada no backend (limites configurados: ${formatarValor(metric.evaluator.lowerBound, attribute)} a ${formatarValor(metric.evaluator.upperBound, attribute)}).`;
  }

  let limiteMinimo: number;
  let limiteMaximo: number;
  if (attribute === 'ph') {
    limiteMinimo = 6.5;
    limiteMaximo = 9.5;
  } else if (attribute === 'turbidez') {
    limiteMinimo = 0;
    limiteMaximo = 1;
  } else if (attribute === 'tds') {
    limiteMinimo = 0;
    limiteMaximo = 600;
  } else {
    limiteMinimo = metric.evaluator.lowerBound;
    limiteMaximo = metric.evaluator.upperBound;
  }

  if (metric.value < limiteMinimo) {
    return `${label}: ${valor}, ${formatarDistancia(limiteMinimo - metric.value, attribute)} abaixo do limite mínimo de ${formatarValor(limiteMinimo, attribute)}.`;
  }

  if (metric.value > limiteMaximo) {
    return `${label}: ${valor}, ${formatarDistancia(metric.value - limiteMaximo, attribute)} acima do limite máximo de ${formatarValor(limiteMaximo, attribute)}.`;
  }

  if (severity === 'vermelho') {
    return `${label}: ${valor}; a avaliação está fora da faixa permitida de ${formatarValor(limiteMinimo, attribute)} a ${formatarValor(limiteMaximo, attribute)}.`;
  }

  if (attribute === 'ph') {
    if (metric.value <= 7) {
      return `${label}: ${valor}, ${formatarDistancia(metric.value - limiteMinimo, attribute)} acima do limite mínimo de ${formatarValor(limiteMinimo, attribute)}.`;
    }
    return `${label}: ${valor}, ${formatarDistancia(limiteMaximo - metric.value, attribute)} abaixo do limite máximo de ${formatarValor(limiteMaximo, attribute)}.`;
  }

  return `${label}: ${valor}, ${formatarDistancia(limiteMaximo - metric.value, attribute)} abaixo do limite máximo de ${formatarValor(limiteMaximo, attribute)}.`;
}

function readAlerts(): AlertNotification[] {
  const saved = localStorage.getItem(ALERTS_STORAGE_KEY);
  if (!saved) return [];

  const parsed: unknown = JSON.parse(saved);
  if (!Array.isArray(parsed) || !parsed.every(isAlertNotification)) {
    throw new Error('A lista de alertas salva está inválida.');
  }

  return parsed;
}

function readYellowStreaks(): YellowStreaks {
  const saved = localStorage.getItem(YELLOW_STREAKS_STORAGE_KEY);
  if (!saved) return {};

  const parsed: unknown = JSON.parse(saved);
  if (!isRecord(parsed)) throw new Error('O histórico de avisos amarelos está inválido.');

  const streaks: YellowStreaks = {};
  for (const attribute of ATTRIBUTES) {
    const streak = parsed[attribute.id];
    if (streak === undefined) continue;
    if (
      !isRecord(streak)
      || typeof streak.count !== 'number'
      || !Number.isInteger(streak.count)
      || streak.count < 0
      || typeof streak.notified !== 'boolean'
    ) {
      throw new Error('O histórico de avisos amarelos está inválido.');
    }
    streaks[attribute.id] = { count: streak.count, notified: streak.notified };
  }

  return streaks;
}

function createNotification(
  severity: Severity,
  message: string,
  createdAt: number,
): AlertNotification {
  return {
    id: `${createdAt}-${Math.random().toString(36).slice(2)}`,
    createdAt,
    severity,
    message,
    read: false,
  };
}

function saveAlerts(alerts: AlertNotification[]): void {
  localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(
    alerts.sort((a, b) => a.createdAt - b.createdAt).slice(-MAX_ALERTS),
  ));
  queueMicrotask(() => window.dispatchEvent(new Event(ALERTS_UPDATED_EVENT)));
}

export function getAlertNotifications(): AlertNotification[] {
  return readAlerts().sort((a, b) => a.createdAt - b.createdAt);
}

export function getUnreadAlertCount(): number {
  return readAlerts().filter((alert) => !alert.read).length;
}

export function markAlertsAsRead(): void {
  const alerts = readAlerts();
  if (alerts.every((alert) => alert.read)) return;

  saveAlerts(alerts.map((alert) => ({ ...alert, read: true })));
}

export function subscribeToAlerts(listener: () => void): () => void {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === ALERTS_STORAGE_KEY) listener();
  };

  window.addEventListener(ALERTS_UPDATED_EVENT, listener);
  window.addEventListener('storage', handleStorage);
  return () => {
    window.removeEventListener(ALERTS_UPDATED_EVENT, listener);
    window.removeEventListener('storage', handleStorage);
  };
}

export function processDashboardAlertCheck(
  data: unknown,
  automatic: boolean,
  checkedAt = Date.now(),
): void {
  const evaluation = readEvaluation(data);
  if (!evaluation) return;

  const metrics: Record<AttributeId, MetricResult> = {
    ph: evaluation.phEvaluationResult,
    turbidez: evaluation.turbidityEvaluationResult,
    temp: evaluation.temperatureEvaluationResult,
    tds: evaluation.tdsEvaluationResult,
  };
  const statuses: Record<AttributeId, StatusCor> = {
    ph: getMetricStatus(metrics.ph, 'ph'),
    turbidez: getMetricStatus(metrics.turbidez, 'turbidez'),
    temp: getMetricStatus(metrics.temp, 'temp'),
    tds: getMetricStatus(metrics.tds, 'tds'),
  };
  const notifications: AlertNotification[] = [];
  const redDetails = ATTRIBUTES
    .filter(({ id }) => statuses[id] === 'vermelho')
    .map(({ id }) => descreverEstado(metrics[id], id, 'vermelho'));
  let streaksToSave: YellowStreaks | null = null;

  if (redDetails.length > 0) {
    notifications.push(createNotification(
      'vermelho',
      `Alerta crítico:\n${redDetails.join('\n')}`,
      checkedAt,
    ));
  }

  if (automatic) {
    const streaks = readYellowStreaks();
    const yellowDetails: string[] = [];

    for (const { id } of ATTRIBUTES) {
      if (statuses[id] !== 'amarelo') {
        delete streaks[id];
        continue;
      }

      const streak = streaks[id] ?? { count: 0, notified: false };
      streak.count = Math.min(4, streak.count + 1);
      if (streak.count >= 4 && !streak.notified) {
        yellowDetails.push(descreverEstado(metrics[id], id, 'amarelo'));
        streak.notified = true;
      }
      streaks[id] = streak;
    }
    streaksToSave = streaks;

    if (yellowDetails.length > 0) {
      notifications.push(createNotification(
        'amarelo',
        `Atenção após quatro consultas automáticas consecutivas:\n${yellowDetails.join('\n')}`,
        checkedAt,
      ));
    }
  }

  if (notifications.length > 0) {
    saveAlerts([...readAlerts(), ...notifications]);
  }

  if (streaksToSave) {
    localStorage.setItem(YELLOW_STREAKS_STORAGE_KEY, JSON.stringify(streaksToSave));
  }
}
