import { useEffect, useMemo, useRef, useState } from 'react';

interface Sample {
  timestamp: string;
  sourcingPoint: 'AfterFiltration' | 'BeforeFiltration';
  ph: number;
  turbidity: number;
  temperature: number;
  tds: number;
}

interface HistoryResponse {
  samplesHistory: Sample[];
  samplesHistoryPaged: {
    items: Sample[];
    page: number;
    pageSize: number;
    lastPage: number;
    totalCount: number;
  };
}

type PeriodId = 'week' | 'month' | 'six-months';
type MetricId = 'ph' | 'turbidity' | 'temperature' | 'tds';

interface PeriodOption {
  id: PeriodId;
  label: string;
  fromLast: string;
  bucket: 'day' | 'week';
  description: string;
}

interface MetricOption {
  id: MetricId;
  label: string;
  unit: string;
  decimals: number;
}

interface HistoryPoint {
  key: string;
  label: string;
  fullDateLabel: string;
  value: number;
  count: number;
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5058';
const TIME_ZONE_BRASILIA = 'America/Sao_Paulo';
const PERIODS: PeriodOption[] = [
  {
    id: 'week',
    label: 'Última semana',
    fromLast: '7.00:00:00',
    bucket: 'day',
    description: 'Média diária',
  },
  {
    id: 'month',
    label: 'Último mês',
    fromLast: '30.00:00:00',
    bucket: 'day',
    description: 'Média diária',
  },
  {
    id: 'six-months',
    label: 'Últimos 6 meses',
    fromLast: '180.00:00:00',
    bucket: 'week',
    description: 'Média semanal',
  },
];
const METRICS: MetricOption[] = [
  { id: 'ph', label: 'pH', unit: '', decimals: 2 },
  { id: 'turbidity', label: 'Turbidez', unit: 'NTU', decimals: 2 },
  { id: 'temperature', label: 'Temperatura', unit: '°C', decimals: 2 },
  { id: 'tds', label: 'TDS', unit: 'mg/L', decimals: 2 },
];
const formatadorData = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIME_ZONE_BRASILIA,
  day: '2-digit',
  month: '2-digit',
});
const formatadorDataCompleta = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIME_ZONE_BRASILIA,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSample(value: unknown): value is Sample {
  if (!isRecord(value)) return false;

  return typeof value.timestamp === 'string'
    && (value.sourcingPoint === 'AfterFiltration' || value.sourcingPoint === 'BeforeFiltration')
    && typeof value.ph === 'number'
    && Number.isFinite(value.ph)
    && typeof value.turbidity === 'number'
    && Number.isFinite(value.turbidity)
    && typeof value.temperature === 'number'
    && Number.isFinite(value.temperature)
    && typeof value.tds === 'number'
    && Number.isFinite(value.tds);
}

function isHistoryResponse(value: unknown): value is HistoryResponse {
  if (!isRecord(value) || !Array.isArray(value.samplesHistory) || !value.samplesHistory.every(isSample)) {
    return false;
  }

  const paged = value.samplesHistoryPaged;
  return isRecord(paged)
    && Array.isArray(paged.items)
    && paged.items.every(isSample)
    && typeof paged.page === 'number'
    && typeof paged.pageSize === 'number'
    && typeof paged.lastPage === 'number'
    && typeof paged.totalCount === 'number';
}

function interpretarTimestamp(timestamp: string): number {
  const temFusoHorario = /(?:Z|[+-]\d{2}:\d{2})$/i.test(timestamp);
  return new Date(temFusoHorario ? timestamp : `${timestamp}Z`).getTime();
}

function dataBrasilia(timestamp: number): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE_BRASILIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(timestamp);
  const parte = (tipo: string) => partes.find((item) => item.type === tipo)?.value ?? '';
  return `${parte('year')}-${parte('month')}-${parte('day')}`;
}

function inicioDaSemana(data: string): string {
  const [ano, mes, dia] = data.split('-').map(Number);
  const utcDate = new Date(Date.UTC(ano, mes - 1, dia));
  const diasDesdeSegunda = (utcDate.getUTCDay() + 6) % 7;
  utcDate.setUTCDate(utcDate.getUTCDate() - diasDesdeSegunda);
  return [
    utcDate.getUTCFullYear(),
    String(utcDate.getUTCMonth() + 1).padStart(2, '0'),
    String(utcDate.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function timestampDaChave(key: string): number {
  const [ano, mes, dia] = key.split('-').map(Number);
  return Date.UTC(ano, mes - 1, dia, 12);
}

function formatarChaveData(key: string, bucket: PeriodOption['bucket']): string {
  const timestamp = timestampDaChave(key);
  return bucket === 'week'
    ? `Sem. ${formatadorData.format(timestamp)}`
    : formatadorData.format(timestamp);
}

function agregarAmostras(amostras: Sample[], periodo: PeriodOption, metrica: MetricId): HistoryPoint[] {
  const grupos = new Map<string, { sum: number; count: number }>();

  for (const amostra of amostras) {
    const timestamp = interpretarTimestamp(amostra.timestamp);
    if (!Number.isFinite(timestamp)) continue;

    const dia = dataBrasilia(timestamp);
    const chave = periodo.bucket === 'week' ? inicioDaSemana(dia) : dia;
    const grupo = grupos.get(chave) ?? { sum: 0, count: 0 };
    grupo.sum += amostra[metrica];
    grupo.count += 1;
    grupos.set(chave, grupo);
  }

  return [...grupos.entries()]
    .sort(([chaveA], [chaveB]) => chaveA.localeCompare(chaveB))
    .map(([key, grupo]) => ({
      key,
      label: formatarChaveData(key, periodo.bucket),
      fullDateLabel: formatadorDataCompleta.format(timestampDaChave(key)),
      value: grupo.sum / grupo.count,
      count: grupo.count,
    }));
}

function formatarValor(value: number, decimals: number): string {
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: decimals,
  }).format(value);
}

function calcularLarguraGrafico(pointCount: number, availableWidth: number): number {
  return Math.max(availableWidth, 800, (pointCount - 1) * 70 + 80);
}

export default function Historico() {
  const [periodoId, setPeriodoId] = useState<PeriodId>('week');
  const [metricaId, setMetricaId] = useState<MetricId>('ph');
  const [amostras, setAmostras] = useState<Sample[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [larguraDisponivel, setLarguraDisponivel] = useState(800);
  const [alturaGrafico, setAlturaGrafico] = useState(340);
  const containerRef = useRef<HTMLDivElement>(null);

  const periodo = PERIODS.find((opcao) => opcao.id === periodoId) ?? PERIODS[0];
  const metrica = METRICS.find((opcao) => opcao.id === metricaId) ?? METRICS[0];

  useEffect(() => {
    const controller = new AbortController();
    let ativo = true;

    async function carregarHistorico() {
      setCarregando(true);
      setErro(null);

      try {
        const params = new URLSearchParams({ fromLast: periodo.fromLast });
        const resposta = await fetch(`${API_URL}/Screens/History?${params}`, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });

        if (!resposta.ok) {
          throw new Error(`Falha ao carregar o histórico (${resposta.status}).`);
        }

        const dados: unknown = await resposta.json();
        if (!isHistoryResponse(dados)) {
          throw new Error('A API retornou o histórico em um formato inválido.');
        }

        if (ativo) setAmostras(dados.samplesHistory);
      } catch (error) {
        if (ativo && (error as Error).name !== 'AbortError') {
          setErro(error instanceof Error ? error.message : 'Não foi possível carregar o histórico.');
          setAmostras([]);
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    void carregarHistorico();
    return () => {
      ativo = false;
      controller.abort();
    };
  }, [periodo.fromLast, tentativa]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(([entry]) => {
      setLarguraDisponivel(entry.contentRect.width);
      setAlturaGrafico(entry.contentRect.height);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [carregando, erro]);

  const pontos = useMemo(
    () => agregarAmostras(amostras, periodo, metricaId),
    [amostras, periodo, metricaId],
  );
  const larguraGrafico = calcularLarguraGrafico(pontos.length, larguraDisponivel);
  const valores = pontos.map((ponto) => ponto.value);
  const minValor = valores.length > 0 ? Math.min(...valores) : 0;
  const maxValor = valores.length > 0 ? Math.max(...valores) : 0;
  const diferenca = maxValor - minValor;
  const escala = diferenca === 0 ? 1 : diferenca;
  const minimo = diferenca === 0 ? minValor - 1 : minValor - escala * 0.3;
  const maximo = diferenca === 0 ? maxValor + 1 : maxValor + escala * 0.3;
  const topoValores = alturaGrafico * 0.2;
  const alturaValores = alturaGrafico * 0.55;
  const pontosCalculados = pontos.map((ponto, index) => ({
    ...ponto,
    x: pontos.length > 1
      ? 40 + (index / (pontos.length - 1)) * (larguraGrafico - 80)
      : larguraGrafico / 2,
    y: topoValores + (1 - (ponto.value - minimo) / (maximo - minimo || 1)) * alturaValores,
  }));
  const pontosSvg = pontosCalculados.map((ponto) => `${ponto.x.toFixed(1)},${ponto.y.toFixed(1)}`).join(' ');
  const linha = alturaGrafico * 0.88;

  return (
    <div className="historico-page">
      <header className="historico-header">
        <div>
          <h1>Histórico</h1>
          <p>Consulte médias das medições em períodos mais longos.</p>
        </div>
      </header>

      <section className="historico-controls" aria-label="Opções do gráfico de histórico">
        <div className="historico-control-group" aria-label="Período">
          {PERIODS.map((opcao) => (
            <button
              key={opcao.id}
              type="button"
              className={`historico-option-btn ${periodoId === opcao.id ? 'active' : ''}`}
              aria-pressed={periodoId === opcao.id}
              onClick={() => setPeriodoId(opcao.id)}
            >
              {opcao.label}
            </button>
          ))}
        </div>

        <div className="historico-control-group" aria-label="Parâmetro">
          {METRICS.map((opcao) => (
            <button
              key={opcao.id}
              type="button"
              className={`historico-option-btn ${metricaId === opcao.id ? 'active' : ''}`}
              aria-pressed={metricaId === opcao.id}
              onClick={() => setMetricaId(opcao.id)}
            >
              {opcao.label}
            </button>
          ))}
        </div>
      </section>

      <section className="historico-chart-card" aria-labelledby="historico-chart-title">
        <div className="historico-chart-header">
          <div>
            <h2 id="historico-chart-title">{metrica.label} — {periodo.label.toLowerCase()}</h2>
            <p>{periodo.description} · horários agrupados conforme o horário de Brasília</p>
          </div>
          {pontos.length > 0 && (
            <span className="historico-sample-count">
              {pontos.length} {periodo.bucket === 'day' ? 'dias' : 'semanas'} com medições
            </span>
          )}
        </div>

        {erro ? (
          <div className="historico-message" role="alert">
            <span>{erro}</span>
            <button type="button" className="historico-retry-btn" onClick={() => setTentativa((atual) => atual + 1)}>
              Tentar novamente
            </button>
          </div>
        ) : carregando ? (
          <div className="historico-message" role="status">Carregando histórico...</div>
        ) : pontos.length === 0 ? (
          <div className="historico-message">Não há medições disponíveis nesse período.</div>
        ) : (
          <div className="historico-chart-container" ref={containerRef}>
            <svg
              role="img"
              aria-label={`Gráfico de ${metrica.label}, ${periodo.label.toLowerCase()}`}
              viewBox={`0 0 ${larguraGrafico} ${alturaGrafico}`}
              style={{ width: `${larguraGrafico}px`, height: '100%' }}
            >
              <line x1="40" y1={alturaGrafico * 0.2} x2={larguraGrafico - 40} y2={alturaGrafico * 0.2} stroke="#f1f5f9" />
              <line x1="40" y1={alturaGrafico * 0.475} x2={larguraGrafico - 40} y2={alturaGrafico * 0.475} stroke="#f1f5f9" />
              <line x1="40" y1={linha} x2={larguraGrafico - 40} y2={linha} stroke="#e2e8f0" />
              {pontosSvg && (
                <polyline
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={pontosSvg}
                />
              )}
              {pontosCalculados.map((ponto) => (
                <g key={ponto.key}>
                  <title>
                    {`${periodo.bucket === 'week' ? 'Semana de ' : ''}${ponto.fullDateLabel}: ${formatarValor(ponto.value, metrica.decimals)}${metrica.unit ? ` ${metrica.unit}` : ''} (média de ${ponto.count} medições)`}
                  </title>
                  <circle cx={ponto.x} cy={ponto.y} r="5" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
                  <text x={ponto.x} y={ponto.y - 12} textAnchor="middle" fontSize="11" fontWeight="600" fill="#334155">
                    {formatarValor(ponto.value, metrica.decimals)}
                  </text>
                  <text x={ponto.x} y={alturaGrafico * 0.96} textAnchor="middle" fontSize="12" fill="#64748b">
                    {ponto.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        )}
      </section>
    </div>
  );
}
