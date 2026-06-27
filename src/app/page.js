'use client'
import { useState, useEffect } from 'react';
import styles from './page.module.css';

export default function Home() {
  const [selectedLottery, setSelectedLottery] = useState('mega-sena');
  const [ticketCount, setTicketCount] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [notification, setNotification] = useState('');
  
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'COLOQUE_Sua_URL_Do_API_GATEWAY_AQUI';

  const lotteries = [
    { id: 'mega-sena', name: 'Mega-Sena' },
    { id: 'lotofacil', name: 'Lotofácil' },
    { id: 'lotomania', name: 'Lotomania' }
  ];

  const handleGenerate = async () => {
    setIsGenerating(true);
    setNotification('');
    try {
      // 1. Opcional: Buscar predições inteligentes do Motor ML (GET)
      /* 
      const resPred = await fetch(`${API_URL}/sugestoes`);
      const predData = await resPred.json();
      setSuggestions(predData); 
      */

      // 2. Enviar a simulação desejada pro Backend que jogará no SQS (POST)
      const payload = {
        lottery: selectedLottery,
        gamesToGenerate: ticketCount,
        timestamp: new Date().toISOString()
      };

      const res = await fetch(`${API_URL}/jogos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setNotification('✅ Jogos enviados para simulação com sucesso! O processamento já iniciou na AWS.');
      } else {
        setNotification('❌ Ocorreu um erro ao enviar os jogos. Verifique a URL da API.');
      }
    } catch (error) {
      console.error(error);
      setNotification('❌ Falha na conexão com o Backend.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className="animate-fade-in">
          <h1 className={styles.title}>Loterias <span className="text-gradient">Sim</span></h1>
          <p className={styles.subtitle}>O simulador mais avançado para suas apostas. Potencializado por IA e estatística.</p>
        </div>
      </header>

      <section className={`${styles.mainPanel} glass-panel animate-fade-in`} style={{ animationDelay: '0.1s' }}>
        <div className={styles.lotterySelector}>
          {lotteries.map((l) => (
            <button 
              key={l.id}
              className={`${styles.lotteryBtn} ${selectedLottery === l.id ? styles.active : ''}`}
              onClick={() => setSelectedLottery(l.id)}
            >
              {l.name}
            </button>
          ))}
        </div>

        <div className={styles.actionArea}>
          <div className={styles.controlGroup}>
            <label>Quantidade de Jogos</label>
            <input 
              type="number" 
              min="1" 
              max="100" 
              value={ticketCount}
              onChange={(e) => setTicketCount(parseInt(e.target.value) || 1)}
              className={styles.inputGlass} 
            />
          </div>

          <button 
            className="btn btn-primary" 
            style={{marginTop: '1.5rem', width: '100%'}}
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? 'Analisando histórico...' : '✨ Gerar Jogo Inteligente'}
          </button>

          {notification && (
            <div style={{marginTop: '1rem', padding: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', textAlign: 'center'}}>
              {notification}
            </div>
          )}
        </div>
      </section>

      <section className={`${styles.infoSection} animate-fade-in`} style={{ animationDelay: '0.2s' }}>
        <div className={`${styles.card} glass-panel`}>
          <h3>📈 Análise Preditiva</h3>
          <p>Nossos algoritmos analisam anos de histórico da Mega-Sena, Lotofácil e Lotomania para maximizar suas chances e simular cenários otimizados.</p>
        </div>
        <div className={`${styles.card} glass-panel`}>
          <h3>⚡ Apuração Automatizada</h3>
          <p>O ecossistema Serverless faz todo o processamento em background, notificando os resultados com extrema precisão.</p>
        </div>
      </section>
    </div>
  )
}
