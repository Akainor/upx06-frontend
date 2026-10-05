import { useState, useMemo } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Clock } from 'lucide-react';

type StatusCor = 'verde' | 'amarelo' | 'vermelho';
type AtributoId = 'ph' | 'turbidez' | 'temp' | 'tds';
type StatusPorAtributo = Record<AtributoId, StatusCor>;

interface PontoHistorico {
  hora: string;
  valor: number;
}

interface Leituras {
  ph: number;
  turbidez: number;
  temp: number;
  tds: number;
}

const SIMULACOES_LEITURAS: Record<string, Leituras> = {
  normais: { ph: 7.2, turbidez: 0.3, temp: 24.5, tds: 210 },
  phAlerta: { ph: 6.8, turbidez: 0.3, temp: 24.5, tds: 210 },
  turbidezAlerta: { ph: 7.2, turbidez: 0.8, temp: 24.5, tds: 210 },
  tempAlerta: { ph: 7.2, turbidez: 0.3, temp: 37.0, tds: 210 },
  phCritico: { ph: 5.5, turbidez: 0.3, temp: 24.5, tds: 210 },
  turbidezCritica: { ph: 7.2, turbidez: 1.5, temp: 24.5, tds: 210 },
  tdsCritico: { ph: 7.2, turbidez: 0.3, temp: 24.5, tds: 750 },
};

const HISTORICO_24H: Record<AtributoId, PontoHistorico[]> = {
  ph: [
    { hora: '00h', valor: 7.1 },
    { hora: '04h', valor: 7.2 },
    { hora: '08h', valor: 7.0 },
    { hora: '12h', valor: 7.3 },
    { hora: '16h', valor: 7.2 },
    { hora: '20h', valor: 7.1 },
    { hora: '24h', valor: 7.2 },
  ],
  turbidez: [
    { hora: '00h', valor: 0.2 },
    { hora: '04h', valor: 0.3 },
    { hora: '08h', valor: 0.4 },
    { hora: '12h', valor: 0.6 },
    { hora: '16h', valor: 0.3 },
    { hora: '20h', valor: 0.2 },
    { hora: '24h', valor: 0.4 },
  ],
  temp: [
    { hora: '00h', valor: 23.5 },
    { hora: '04h', valor: 22.8 },
    { hora: '08h', valor: 24.0 },
    { hora: '12h', valor: 26.5 },
    { hora: '16h', valor: 25.8 },
    { hora: '20h', valor: 24.5 },
    { hora: '24h', valor: 24.0 },
  ],
  tds: [
    { hora: '00h', valor: 190 },
    { hora: '04h', valor: 200 },
    { hora: '08h', valor: 210 },
    { hora: '12h', valor: 230 },
    { hora: '16h', valor: 215 },
    { hora: '20h', valor: 205 },
    { hora: '24h', valor: 210 },
  ],
};

const OPCOES_GRAFICO: { id: AtributoId; rotulo: string }[] = [
  { id: 'ph', rotulo: 'pH' },
  { id: 'turbidez', rotulo: 'Turbidez' },
  { id: 'temp', rotulo: 'Temp' },
  { id: 'tds', rotulo: 'TDS' },
];

function getStatusPH(ph: number): StatusCor {
  if (ph < 6.5 || ph > 9.5) return 'vermelho';
  if ((ph >= 6.5 && ph <= 7.0) || (ph >= 9.0 && ph <= 9.5)) return 'amarelo';
  return 'verde';
}

function getStatusTurbidez(turbidez: number): StatusCor {
  if (turbidez < 0 || turbidez > 1.0) return 'vermelho';
  if (turbidez >= 0.5 && turbidez <= 1.0) return 'amarelo';
  return 'verde';
}

function getStatusTDS(tds: number): StatusCor {
  if (tds < 0 || tds > 600) return 'vermelho';
  if (tds >= 500 && tds <= 600) return 'amarelo';
  return 'verde';
}

function getStatusTemp(temp: number): StatusCor {
  if (temp > 40) return 'vermelho';
  if (temp > 35) return 'amarelo';
  return 'verde';
}

export default function Dashboard() {
  const [leituras, setLeituras] = useState<Leituras>(SIMULACOES_LEITURAS.normais);

  const [atributoGrafico, setAtributoGrafico] = useState<AtributoId>('ph');

  const statusPorAtributo = useMemo<StatusPorAtributo>(() => ({
    ph: getStatusPH(leituras.ph),
    turbidez: getStatusTurbidez(leituras.turbidez),
    temp: getStatusTemp(leituras.temp),
    tds: getStatusTDS(leituras.tds),
  }), [leituras]);

  const { statusGeral, textoStatusGeral, listaAtributos } = useMemo(() => {
    const valores = Object.values(statusPorAtributo);
    const temVermelhoAtual = valores.includes('vermelho');
    const temAmareloAtual = valores.includes('amarelo');

    return {
      statusGeral: temVermelhoAtual ? 'vermelho' : temAmareloAtual ? 'amarelo' : 'verde',
      textoStatusGeral: temVermelhoAtual ? 'ALERTA CRÍTICO' : temAmareloAtual ? 'ATENÇÃO' : 'NORMAL',
      listaAtributos: [
        { id: 'ph', nome: 'pH', valor: leituras.ph, unidade: '', limites: 'Limite: 6.5 - 9.5', status: statusPorAtributo.ph },
        { id: 'turbidez', nome: 'Turbidez', valor: leituras.turbidez, unidade: ' NTU', limites: 'Limite: 0 - 1.0 NTU', status: statusPorAtributo.turbidez },
        { id: 'temp', nome: 'Temperatura', valor: leituras.temp, unidade: '°C', limites: 'Alerta: > 35°C', status: statusPorAtributo.temp },
        { id: 'tds', nome: 'TDS', valor: leituras.tds, unidade: ' mg/L', limites: 'Limite: 0 - 600 mg/L', status: statusPorAtributo.tds },
      ],
    };
  }, [leituras, statusPorAtributo]);

  const corLinhaGrafico = useMemo(() => {
    const cores: Record<StatusCor, string> = {
      verde: '#10b981',
      amarelo: '#f59e0b',
      vermelho: '#ef4444',
    };

    return cores[statusPorAtributo[atributoGrafico]];
  }, [atributoGrafico, statusPorAtributo]);

  const { pontosCalculados, pointsSVG } = useMemo(() => {
    const dadosGrafico = HISTORICO_24H[atributoGrafico];
    const valores = dadosGrafico.map((d) => d.valor);

    const minBase = Math.min(...valores);
    const maxBase = Math.max(...valores);
    const diff = maxBase - minBase;

    const range = diff === 0 ? 1 : diff;
    const minVal = diff === 0 ? minBase - 1 : minBase - range * 0.3;
    const maxVal = diff === 0 ? maxBase + 1 : maxBase + range * 0.3;
    const deltaY = maxVal - minVal;

    const pontosCalculados = dadosGrafico.map((d, index) => {
      const x = (index / (dadosGrafico.length - 1)) * 500 + 40;
      const y = 180 - ((d.valor - minVal) / deltaY) * 130;
      return { ...d, x, y };
    });

    const pointsSVG = pontosCalculados.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    return { pontosCalculados, pointsSVG };
  }, [atributoGrafico]);

  return (
    <div className="flex flex-col gap-6">
      <div className="dashboard-header-bar">
        <div className="dashboard-title-area">
          <h2>Monitoramento em Tempo Real</h2>
          <p>Visão geral das leituras coletadas pelos sensores da estação principal.</p>
        </div>

        <div className={`status-badge-general ${statusGeral}`}>
          {statusGeral === 'verde' && <CheckCircle2 size={18} />}
          {statusGeral === 'amarelo' && <AlertTriangle size={18} />}
          {statusGeral === 'vermelho' && <AlertCircle size={18} />}
          <span>STATUS GERAL: {textoStatusGeral}</span>
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
              {item.valor}
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
            <p>Selecione um atributo abaixo para analisar as medições ao longo do dia.</p>
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

            <polyline
              fill="none"
              stroke={corLinhaGrafico}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={pointsSVG}
            />

            {pontosCalculados.map((p, index) => (
              <g key={index}>
                <circle cx={p.x} cy={p.y} r="5" fill={corLinhaGrafico} stroke="#ffffff" strokeWidth="2" />
                <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize="11" fontWeight="600" fill="#334155">
                  {p.valor}
                </text>
                <text x={p.x} y="220" textAnchor="middle" fontSize="12" fill="#64748b">
                  {p.hora}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>

      <div className="simulador-box">
        <h4><Clock size={14} style={{ display: 'inline', marginRight: '6px' }} /> Testar Simulação de Regras do Sistema</h4>
        <div className="simulador-controles">
          <button type="button" className="simulador-btn" onClick={() => setLeituras(SIMULACOES_LEITURAS.normais)}>
            🟢 Todos Normais
          </button>
          <button type="button" className="simulador-btn" onClick={() => setLeituras(SIMULACOES_LEITURAS.phAlerta)}>
            🟡 pH em Alerta (6.8)
          </button>
          <button type="button" className="simulador-btn" onClick={() => setLeituras(SIMULACOES_LEITURAS.turbidezAlerta)}>
            🟡 Turbidez em Alerta (0.8 NTU)
          </button>
          <button type="button" className="simulador-btn" onClick={() => setLeituras(SIMULACOES_LEITURAS.tempAlerta)}>
            🟡 Temp em Alerta (&gt;35°C)
          </button>
          <button type="button" className="simulador-btn" onClick={() => setLeituras(SIMULACOES_LEITURAS.phCritico)}>
            🔴 pH Crítico (5.5)
          </button>
          <button type="button" className="simulador-btn" onClick={() => setLeituras(SIMULACOES_LEITURAS.turbidezCritica)}>
            🔴 Turbidez Crítica (1.5 NTU)
          </button>
          <button type="button" className="simulador-btn" onClick={() => setLeituras(SIMULACOES_LEITURAS.tdsCritico)}>
            🔴 TDS Crítico (750 mg/L)
          </button>
        </div>
      </div>
    </div>
  );
}