import { ArrowRight, Droplets, Filter, CheckCircle2 } from 'lucide-react';

export default function Comparacao() {
  // Dados estáticos baseados no protótipo Figma para demonstração
  const dadosComparativos = [
    { parametro: 'pH', antes: '7.8', depois: '7.2', alturaAntes: '80%', alturaDepois: '70%' },
    { parametro: 'Turbidez', antes: '45 NTU', depois: '14 NTU', alturaAntes: '95%', alturaDepois: '30%' },
    { parametro: 'Temperatura', antes: '25.8°C', depois: '24.5°C', alturaAntes: '75%', alturaDepois: '70%' },
    { parametro: 'TDS', antes: '320 ppm', depois: '210 ppm', alturaAntes: '85%', alturaDepois: '55%' }
  ];

  return (
    <div>
      <div className="comparacao-header">
        <h2>Antes x Depois</h2>
        <p>Compare a qualidade da água antes e após o processo de tratamento.</p>
      </div>

      <div className="fluxo-card">
        <h3>Processo de tratamento</h3>
        <p>Fluxo da água monitorada pelos sensores</p>

        <div className="fluxo-etapas">
          <div className="etapa-item">
            <Droplets size={24} className="text-gray-500" />
            <span>Água Bruta</span>
          </div>

          <ArrowRight className="etapa-seta" size={20} />

          <div className="etapa-item">
            <Filter size={24} className="text-gray-500" />
            <span>Filtro</span>
          </div>

          <ArrowRight className="etapa-seta" size={20} />

          <div className="etapa-item destaque">
            <CheckCircle2 size={24} />
            <span>Água Tratada</span>
          </div>
        </div>
      </div>

      <div className="metricas-grid">
        {dadosComparativos.map((item, index) => (
          <div className="metrica-card" key={index}>
            <div className="metrica-titulo">{item.parametro}</div>
            <div className="metrica-valores">
              <div className="valor-bloco">
                <span className="valor-rotulo">Antes</span>
                <span className="valor-num">{item.antes}</span>
              </div>
              <div className="valor-bloco" style={{ textAlign: 'right' }}>
                <span className="valor-rotulo">Depois</span>
                <span className="valor-num depois">{item.depois}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grafico-card">
        <div className="grafico-header">
          <div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Comparativo de qualidade</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-light)' }}>
              Valores medidos no último ciclo de tratamento
            </p>
          </div>

          <div className="legenda-container">
            <div className="legenda-item">
              <div className="legenda-cor antes"></div>
              <span>Antes</span>
            </div>
            <div className="legenda-item">
              <div className="legenda-cor depois"></div>
              <span>Depois</span>
            </div>
          </div>
        </div>

        <div className="barras-container">
          {dadosComparativos.map((item, index) => (
            <div className="grupo-barra" key={index}>
              <div className="par-barras">
                <div 
                  className="barra antes" 
                  style={{ height: item.alturaAntes }} 
                  title={`Antes: ${item.antes}`}
                />
                <div 
                  className="barra depois" 
                  style={{ height: item.alturaDepois }} 
                  title={`Depois: ${item.depois}`}
                />
              </div>
              <span className="parametro-rotulo">{item.parametro}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}