import { AlertTriangle, Droplets, Target, Settings, Activity, Users } from 'lucide-react';

const EQUIPA = [
  { id: 'en', nome: 'Eduardo Bismara Nastri', iniciais: 'EN' },
  { id: 'eb', nome: 'Enzo Almeida Barbosa', iniciais: 'EB' },
  { id: 'km', nome: 'Kauã Moraes Medeiros', iniciais: 'KM' },
  { id: 'lt', nome: 'Lucca Falzoni Tomeleri', iniciais: 'LT' },
  { id: 'pm', nome: 'Pedro Ghiotti Martins', iniciais: 'PM' }
];

export default function Sobre() {
  return (
    <div>
      <div className="sobre-header">
        <h2>Sobre o Projeto</h2>
        <p>Tecnologia acessível para acompanhar, compreender e proteger a qualidade da água.</p>
      </div>

      <div className="sobre-card-destaque">
        <h3>
          <Droplets size={24} /> AquaSense
        </h3>
        <p>
          Um sistema de monitorização concebido para monitorizar parâmetros básicos de qualidade 
          da água e demonstrar uma etapa integrada de filtragem, fornecendo alertas visuais 
          simples para o controlo de qualidade.
        </p>
      </div>

      <div className="sobre-grid">
        <div className="sobre-card">
          <h3>
            <AlertTriangle size={20} color="#f59e0b" /> O Problema
          </h3>
          <p>
            O acesso irregular à água potável em comunidades de baixa renda e o armazenamento prolongado em 
            caixas-d'água aumentam significativamente o risco de contaminações impercetíveis a olho nu.
          </p>
        </div>

        <div className="sobre-card">
          <h3>
            <Target size={20} color="#10B981" /> Objetivo
          </h3>
          <p>
            Desenvolver um protótipo de baixo custo utilizando a plataforma Arduino para monitorizar e 
            traduzir dados técnicos de parâmetros físico-químicos numa interface visual de fácil interpretação.
          </p>
        </div>

        <div className="sobre-card">
          <h3>
            <Settings size={20} color="#3b82f6" /> Funcionamento
          </h3>
          <p>
            O sistema utiliza um microcontrolador da família Arduino aliado a sensores analógicos modulares 
            para adquirir dados hídricos de forma acessível. O diferencial consiste na tradução dessas 
            variáveis sem exigir literacia tecnológica do utilizador.
          </p>
        </div>

        <div className="sobre-card">
          <h3>
            <Activity size={20} color="#8b5cf6" /> Sensores Utilizados
          </h3>
          <ul>
            <li>Sensor de pH</li>
            <li>Sensor de turbidez</li>
            <li>Sensor de temperatura DS18B20 (à prova d'água)</li>
            <li>Sensor TDS (Sólidos dissolvidos)</li>
          </ul>
        </div>
      </div>

      <div className="sobre-header">
        <h3 className="flex items-center gap-2 text-[var(--text-main)]">
          <Users size={24} /> Equipe
        </h3>
      </div>
      
      <div className="equipa-grid">
        {EQUIPA.map((membro) => (
          <div className="membro-card" key={membro.id}>
            <div className="avatar">{membro.iniciais}</div>
            <div className="membro-info">
              <strong>{membro.nome}</strong>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}