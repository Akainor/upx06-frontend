import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, RefreshCw } from 'lucide-react';

type StatusCor = 'verde' | 'amarelo' | 'vermelho';
type AtributoId = 'ph' | 'turbidez' | 'temp' | 'tds';
type SampleQuality = 'ProperForConsumption' | 'ImproperForConsumption';
type SampleSourcingPoint = 'AfterFiltration' | 'BeforeFiltration';

interface Evaluator {
  lowerBound: number;
  upperBound: number;
  isEnabled: boolean;
}

interface MetricEvaluationResult {
  isSuccessful: boolean;
  value: number;
  evaluator: Evaluator;
}

interface Sample {
  timestamp: string;
  sourcingPoint: SampleSourcingPoint;
  ph: number;
  turbidity: number;
  temperature: number;
  tds: number;
}

interface LatestSampleEvaluation {
  sampleSourcingPoint: SampleSourcingPoint;
  timestamp: string;
  phEvaluationResult: MetricEvaluationResult;
  turbidityEvaluationResult: MetricEvaluationResult;
  temperatureEvaluationResult: MetricEvaluationResult;
  tdsEvaluationResult: MetricEvaluationResult;
  quality: SampleQuality;
}

interface DashboardScreenData {
  latestSampleEvaluation: LatestSampleEvaluation | null;
  samples: Sample[];
}

interface DashboardCache {
  data: DashboardScreenData;
  snapshots: Sample[];
  updatedAt: number;
}

interface DashboardCacheLoad {
  cache: DashboardCache | null;
  error: string | null;
}

const CHAVE_CACHE_DASHBOARD = 'upx06-dashboard-cache-v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSample(value: unknown): value is Sample {
  if (!isRecord(value)) return false;

  return typeof value.timestamp === 'string'
    && (value.sourcingPoint === 'AfterFiltration' || value.sourcingPoint === 'BeforeFiltration')
    && typeof value.ph === 'number'
    && typeof value.turbidity === 'number'
    && typeof value.temperature === 'number'
    && typeof value.tds === 'number';
}

function isMetricEvaluationResult(value: unknown): value is MetricEvaluationResult {
  if (!isRecord(value) || !isRecord(value.evaluator)) return false;

  return typeof value.isSuccessful === 'boolean'
    && typeof value.value === 'number'
    && typeof value.evaluator.lowerBound === 'number'
    && typeof value.evaluator.upperBound === 'number'
    && typeof value.evaluator.isEnabled === 'boolean';
}

function isLatestSampleEvaluation(value: unknown): value is LatestSampleEvaluation {
  if (!isRecord(value)) return false;

  return (value.sampleSourcingPoint === 'AfterFiltration' || value.sampleSourcingPoint === 'BeforeFiltration')
    && typeof value.timestamp === 'string'
    && isMetricEvaluationResult(value.phEvaluationResult)
    && isMetricEvaluationResult(value.turbidityEvaluationResult)
    && isMetricEvaluationResult(value.temperatureEvaluationResult)
    && isMetricEvaluationResult(value.tdsEvaluationResult)
    && (value.quality === 'ProperForConsumption' || value.quality === 'ImproperForConsumption');
}

function isDashboardScreenData(value: unknown): value is DashboardScreenData {
  return isRecord(value)
    && (value.latestSampleEvaluation === null || isLatestSampleEvaluation(value.latestSampleEvaluation))
    && Array.isArray(value.samples)
    && value.samples.every(isSample);
}

function isDashboardCache(value: unknown): value is DashboardCache {
  return isRecord(value)
    && isDashboardScreenData(value.data)
    && Array.isArray(value.snapshots)
    && value.snapshots.every(isSample)
    && typeof value.updatedAt === 'number'
    && Number.isFinite(value.updatedAt);
}

function carregarCacheDashboard(): DashboardCacheLoad {
  try {
    const salvo = localStorage.getItem(CHAVE_CACHE_DASHBOARD);
    if (!salvo) return { cache: null, error: null };

    const cache: unknown = JSON.parse(salvo);
    if (!isDashboardCache(cache)) {
      return { cache: null, error: 'Os dados salvos da dashboard estão inválidos; faça uma nova consulta.' };
    }

    return { cache, error: null };
  } catch {
    return { cache: null, error: 'Não foi possível ler os dados salvos da dashboard neste navegador.' };
  }
}

function criarSnapshotConsulta(dados: DashboardScreenData, timestamp: string): Sample | null {
  const avaliacao = dados.latestSampleEvaluation;

  if (avaliacao) {
    return {
      timestamp,
      sourcingPoint: avaliacao.sampleSourcingPoint,
      ph: avaliacao.phEvaluationResult.value,
      turbidity: avaliacao.turbidityEvaluationResult.value,
      temperature: avaliacao.temperatureEvaluationResult.value,
      tds: avaliacao.tdsEvaluationResult.value,
    };
  }

  const amostraMaisRecente = [...dados.samples].sort(
    (a, b) => interpretarTimestamp(b.timestamp).getTime() - interpretarTimestamp(a.timestamp).getTime(),
  )[0];

  return amostraMaisRecente ? { ...amostraMaisRecente, timestamp } : null;
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5058';
const INTERVALO_ATUALIZACAO_MS = 15 * 60 * 1000;
const JANELA_GRAFICO_MS = 24 * 60 * 60 * 1000;
const TIME_ZONE_BRASILIA = 'America/Sao_Paulo';
const formatadorHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIME_ZONE_BRASILIA,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const formatadorDataHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIME_ZONE_BRASILIA,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const OPCOES_GRAFICO: { id: AtributoId; rotulo: string }[] = [
  { id: 'ph', rotulo: 'pH' },
  { id: 'turbidez', rotulo: 'Turbidez' },
  { id: 'temp', rotulo: 'Temp' },
  { id: 'tds', rotulo: 'TDS' },
];

function formatarValor(valor: number, casasDecimais = 1): string {
  if (Number.isInteger(valor)) return valor.toString();
  return valor.toFixed(casasDecimais);
}

function interpretarTimestamp(timestamp: string): Date {
  const temFusoHorario = /(?:Z|[+-]\d{2}:\d{2})$/i.test(timestamp);
  return new Date(temFusoHorario ? timestamp : `${timestamp}Z`);
}

function getStatusMetric(metric: MetricEvaluationResult | undefined): StatusCor {
  if (!metric) return 'vermelho';
  if (!metric.evaluator.isEnabled) return 'amarelo';
  return metric.isSuccessful ? 'verde' : 'vermelho';
}

function getStatusGeral(quality: SampleQuality | undefined): StatusCor {
  if (!quality) return 'amarelo';
  return quality === 'ProperForConsumption' ? 'verde' : 'vermelho';
}

function getStatusLabel(quality: SampleQuality | undefined): string {
  if (!quality) return 'SEM AVALIAÇÃO';
  return quality === 'ProperForConsumption' ? 'NORMAL' : 'ALERTA CRÍTICO';
}

export default function Dashboard() {
  const [cacheInicial] = useState(carregarCacheDashboard);
  const [dadosDashboard, setDadosDashboard] = useState<DashboardScreenData | null>(cacheInicial.cache?.data ?? null);
  const [erro, setErro] = useState<string | null>(cacheInicial.error);
  const [instanteAtualizacao, setInstanteAtualizacao] = useState(cacheInicial.cache?.updatedAt ?? 0);
  const [snapshotsConsultas, setSnapshotsConsultas] = useState<Sample[]>(cacheInicial.cache?.snapshots ?? []);
  const [consultando, setConsultando] = useState(false);
  const [atributoGrafico, setAtributoGrafico] = useState<AtributoId>('ph');
  const dadosDashboardRef = useRef(dadosDashboard);
  const snapshotsConsultasRef = useRef(snapshotsConsultas);
  const requisicaoAtivaRef = useRef(false);
  const controladorRef = useRef<AbortController | null>(null);
  const componenteAtivoRef = useRef(true);

  const carregarDados = useCallback(async () => {
    if (requisicaoAtivaRef.current) return;

    requisicaoAtivaRef.current = true;
    const controlador = new AbortController();
    controladorRef.current = controlador;
    setConsultando(true);
    setErro(null);

    try {
      const resposta = await fetch(`${API_URL}/Screens/Dashboard`, {
        signal: controlador.signal,
        headers: {
          Accept: 'application/json',
        },
      });

      if (!resposta.ok) {
        throw new Error(`Falha ao carregar dados do dashboard (${resposta.status})`);
      }

      const dados: unknown = await resposta.json();
      if (!componenteAtivoRef.current) return;
      if (!isDashboardScreenData(dados)) {
        throw new Error('A API retornou dados em um formato inválido.');
      }

      const horarioConsulta = new Date().toISOString();
      const timestampConsulta = new Date(horarioConsulta).getTime();
      const temLeituras = dados.latestSampleEvaluation !== null || dados.samples.length > 0;
      const dadosPersistidos = temLeituras ? dados : dadosDashboardRef.current ?? dados;
      const snapshot = criarSnapshotConsulta(dados, horarioConsulta);
      const limiteHistorico = timestampConsulta - JANELA_GRAFICO_MS;
      const novosSnapshots = [
        ...snapshotsConsultasRef.current.filter(
          (amostra) => interpretarTimestamp(amostra.timestamp).getTime() >= limiteHistorico,
        ),
        ...(snapshot ? [snapshot] : []),
      ];
      const haviaDadosAnteriores = dadosDashboardRef.current !== null
        && (
          dadosDashboardRef.current.latestSampleEvaluation !== null
          || dadosDashboardRef.current.samples.length > 0
        );

      dadosDashboardRef.current = dadosPersistidos;
      snapshotsConsultasRef.current = novosSnapshots;
      setDadosDashboard(dadosPersistidos);
      setInstanteAtualizacao(timestampConsulta);
      setSnapshotsConsultas(novosSnapshots);

      try {
        localStorage.setItem(CHAVE_CACHE_DASHBOARD, JSON.stringify({
          data: dadosPersistidos,
          snapshots: novosSnapshots,
          updatedAt: timestampConsulta,
        } satisfies DashboardCache));
        setErro(temLeituras
          ? null
          : haviaDadosAnteriores
            ? 'A API não retornou leituras novas; mantendo os últimos dados disponíveis.'
            : 'A API respondeu, mas ainda não há leituras disponíveis.');
      } catch {
        setErro('Os dados foram atualizados, mas não foi possível salvá-los neste navegador.');
      }
    } catch (error) {
      if (componenteAtivoRef.current && (error as Error).name !== 'AbortError') {
        setErro(error instanceof Error ? error.message : 'Não foi possível carregar os dados da dashboard.');
      }
    } finally {
      requisicaoAtivaRef.current = false;
      controladorRef.current = null;
      if (componenteAtivoRef.current) {
        setConsultando(false);
      }
    }
  }, []);

  useEffect(() => {
    componenteAtivoRef.current = true;
    const intervalo = window.setInterval(() => {
      void carregarDados();
    }, INTERVALO_ATUALIZACAO_MS);
    return () => {
      componenteAtivoRef.current = false;
      window.clearInterval(intervalo);
      controladorRef.current?.abort();
    };
  }, [carregarDados]);

  const statusPorAtributo = useMemo<Partial<Record<AtributoId, StatusCor>>>(() => {
    const metricas = dadosDashboard?.latestSampleEvaluation;

    if (!metricas) {
      return { ph: 'amarelo', turbidez: 'amarelo', temp: 'amarelo', tds: 'amarelo' };
    }

    return {
      ph: getStatusMetric(metricas.phEvaluationResult),
      turbidez: getStatusMetric(metricas.turbidityEvaluationResult),
      temp: getStatusMetric(metricas.temperatureEvaluationResult),
      tds: getStatusMetric(metricas.tdsEvaluationResult),
    };
  }, [dadosDashboard]);

  const statusGeral = useMemo(() => {
    if (!dadosDashboard?.latestSampleEvaluation) return 'amarelo';
    return getStatusGeral(dadosDashboard.latestSampleEvaluation.quality);
  }, [dadosDashboard]);

  const textoStatusGeral = useMemo(() => {
    if (!dadosDashboard?.latestSampleEvaluation) return 'SEM AVALIAÇÃO';
    return getStatusLabel(dadosDashboard.latestSampleEvaluation.quality);
  }, [dadosDashboard]);

  const listaAtributos = useMemo(() => {
    const avaliacao = dadosDashboard?.latestSampleEvaluation;

    if (!avaliacao) {
      return [];
    }

    return [
      {
        id: 'ph' as const,
        nome: 'pH',
        valor: Number(avaliacao.phEvaluationResult.value),
        unidade: '',
        limites: `Limite: ${avaliacao.phEvaluationResult.evaluator.lowerBound} - ${avaliacao.phEvaluationResult.evaluator.upperBound}`,
        status: getStatusMetric(avaliacao.phEvaluationResult),
      },
      {
        id: 'turbidez' as const,
        nome: 'Turbidez',
        valor: Number(avaliacao.turbidityEvaluationResult.value),
        unidade: ' NTU',
        limites: `Limite: ${avaliacao.turbidityEvaluationResult.evaluator.lowerBound} - ${avaliacao.turbidityEvaluationResult.evaluator.upperBound} NTU`,
        status: getStatusMetric(avaliacao.turbidityEvaluationResult),
      },
      {
        id: 'temp' as const,
        nome: 'Temperatura',
        valor: Number(avaliacao.temperatureEvaluationResult.value),
        unidade: '°C',
        limites: `Limite: ${avaliacao.temperatureEvaluationResult.evaluator.lowerBound} - ${avaliacao.temperatureEvaluationResult.evaluator.upperBound}°C`,
        status: getStatusMetric(avaliacao.temperatureEvaluationResult),
      },
      {
        id: 'tds' as const,
        nome: 'TDS',
        valor: Number(avaliacao.tdsEvaluationResult.value),
        unidade: ' mg/L',
        limites: `Limite: ${avaliacao.tdsEvaluationResult.evaluator.lowerBound} - ${avaliacao.tdsEvaluationResult.evaluator.upperBound} mg/L`,
        status: getStatusMetric(avaliacao.tdsEvaluationResult),
      },
    ];
  }, [dadosDashboard]);

  const corLinhaGrafico = useMemo(() => {
    const cores: Record<StatusCor, string> = {
      verde: '#10b981',
      amarelo: '#f59e0b',
      vermelho: '#ef4444',
    };

    return cores[statusPorAtributo[atributoGrafico] ?? 'amarelo'];
  }, [atributoGrafico, statusPorAtributo]);

  const dadosGrafico = useMemo(() => {
    if (instanteAtualizacao === 0) {
      return [];
    }

    const inicioJanela = instanteAtualizacao - JANELA_GRAFICO_MS;
    const avaliacaoMaisRecente = dadosDashboard?.latestSampleEvaluation;
    const timestampAvaliacaoMaisRecente = avaliacaoMaisRecente
      ? interpretarTimestamp(avaliacaoMaisRecente.timestamp).getTime()
      : null;
    const amostrasHistoricas = (dadosDashboard?.samples ?? []).filter((sample) => {
      if (timestampAvaliacaoMaisRecente === null) {
        return true;
      }

      return !(
        sample.sourcingPoint === avaliacaoMaisRecente?.sampleSourcingPoint
        && interpretarTimestamp(sample.timestamp).getTime() === timestampAvaliacaoMaisRecente
      );
    });
    const samples = [...amostrasHistoricas, ...snapshotsConsultas]
      .map((sample) => ({ sample, timestampMs: interpretarTimestamp(sample.timestamp).getTime() }))
      .filter(({ timestampMs }) => Number.isFinite(timestampMs) && timestampMs >= inicioJanela && timestampMs <= instanteAtualizacao)
      .sort((a, b) => a.timestampMs - b.timestampMs);

    if (samples.length === 0) {
      return [];
    }

    return samples.map(({ sample, timestampMs }, index) => {
      const valor = atributoGrafico === 'ph'
        ? sample.ph
        : atributoGrafico === 'turbidez'
          ? sample.turbidity
          : atributoGrafico === 'temp'
            ? sample.temperature
            : sample.tds;
      return {
        timestampMs,
        x: samples.length > 1 ? 40 + (index / (samples.length - 1)) * 500 : 270,
        hora: formatadorHora.format(timestampMs),
        dataHora: formatadorDataHora.format(timestampMs),
        valor,
      };
    });
  }, [atributoGrafico, dadosDashboard, instanteAtualizacao, snapshotsConsultas]);

  const { pontosCalculados, pointsSVG } = useMemo(() => {
    if (dadosGrafico.length === 0) {
      return { pontosCalculados: [], pointsSVG: '' };
    }

    const valores = dadosGrafico.map((d) => d.valor);
    const minBase = Math.min(...valores);
    const maxBase = Math.max(...valores);
    const diff = maxBase - minBase;
    const range = diff === 0 ? 1 : diff;
    const minVal = diff === 0 ? minBase - 1 : minBase - range * 0.3;
    const maxVal = diff === 0 ? maxBase + 1 : maxBase + range * 0.3;
    const deltaY = maxVal - minVal;

    const pontosCalculados = dadosGrafico.map((d) => {
      const y = 180 - ((d.valor - minVal) / (deltaY || 1)) * 130;
      return { ...d, y };
    });

    const pointsSVG = pontosCalculados.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    return { pontosCalculados, pointsSVG };
  }, [dadosGrafico]);

  const botaoConsultar = (
    <button
      type="button"
      className="dashboard-refresh-btn"
      onClick={() => void carregarDados()}
      disabled={consultando}
    >
      <RefreshCw size={16} className={consultando ? 'animate-spin' : ''} />
      {consultando ? 'Consultando...' : 'Buscar valores agora'}
    </button>
  );

  if (
    !dadosDashboard
    || (
      !dadosDashboard.latestSampleEvaluation
      && dadosDashboard.samples.length === 0
      && snapshotsConsultas.length === 0
    )
  ) {
    return (
      <div className="dashboard-header-bar">
        <div className="dashboard-title-area">
          <h2>Dashboard</h2>
          <p>
            {erro
              ?? 'Nenhum valor carregado ainda. A primeira atualização automática ocorrerá em até 15 minutos.'}
          </p>
        </div>
        {botaoConsultar}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="dashboard-header-bar">
        <div className="dashboard-title-area">
          <h2>Dashboard</h2>
          {instanteAtualizacao > 0 && (
            <p>Última atualização: {formatadorDataHora.format(instanteAtualizacao)} (horário de Brasília).</p>
          )}
          <p>{erro ? `${erro} Exibindo os últimos dados salvos.` : 'Consulta automática a cada 15 minutos.'}</p>
        </div>

        <div className="dashboard-header-actions">
          {botaoConsultar}
          <div className={`status-badge-general ${statusGeral}`}>
            {statusGeral === 'verde' && <CheckCircle2 size={18} />}
            {statusGeral === 'amarelo' && <AlertTriangle size={18} />}
            {statusGeral === 'vermelho' && <AlertCircle size={18} />}
            <span>STATUS GERAL: {textoStatusGeral}</span>
          </div>
        </div>
      </div>

      <div className="dashboard-cards-grid">
        {listaAtributos.map((item) => (
          <div key={item.id} className={`atributo-card border-${item.status}`}>
            <div className="atributo-card-top">
              <span className="atributo-nome">{item.nome}</span>
              <span className={`atributo-status-dot ${item.status}`} title={`Status: ${item.status}`} />
            </div>

            <div className="atributo-valor">
              {formatarValor(item.valor, item.id === 'ph' ? 1 : 0)}
              <span className="text-base font-medium ml-0.5">{item.unidade}</span>
            </div>

            <div className="atributo-limites">{item.limites}</div>
          </div>
        ))}
      </div>

      <div className="chart-card">
        <div className="chart-header">
          <div>
            <h3>Estabilidade nas últimas 24h</h3>
            <p>Medições por horário de Brasília. Passe sobre um ponto para ver a data e o valor.</p>
          </div>

          <div className="chart-tabs">
            {OPCOES_GRAFICO.map((opcao) => (
              <button
                key={opcao.id}
                type="button"
                className={`chart-tab-btn ${atributoGrafico === opcao.id ? 'active' : ''}`}
                onClick={() => setAtributoGrafico(opcao.id)}
                aria-pressed={atributoGrafico === opcao.id}
              >
                {opcao.rotulo}
              </button>
            ))}
          </div>
        </div>

        <div className="chart-svg-container">
          <svg viewBox="0 0 580 230" style={{ width: '100%', height: '100%' }}>
            <line x1="40" y1="40" x2="540" y2="40" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="40" y1="120" x2="540" y2="120" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="40" y1="200" x2="540" y2="200" stroke="#e2e8f0" strokeWidth="1" />

            {pointsSVG ? (
              <polyline
                fill="none"
                stroke={corLinhaGrafico}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={pointsSVG}
              />
            ) : null}

            {pontosCalculados.map((p, index) => (
              <g key={`${p.hora}-${index}`}>
                <title>{`${p.dataHora} — ${formatarValor(p.valor, atributoGrafico === 'ph' ? 1 : 0)}`}</title>
                <circle cx={p.x} cy={p.y} r="5" fill={corLinhaGrafico} stroke="#ffffff" strokeWidth="2" />
                <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize="11" fontWeight="600" fill="#334155">
                  {formatarValor(p.valor, atributoGrafico === 'ph' ? 1 : 0)}
                </text>
                <text x={p.x} y="220" textAnchor="middle" fontSize="12" fill="#64748b">
                  {p.hora}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}