'use client'
import { useState } from 'react';
import styles from './page.module.css';

// Regras por modalidade (espelham o backend em loterias-sim-api/games.js)
const LOTTERIES = {
  'mega-sena': { name: 'Mega-Sena', min: 1, max: 60, minPick: 6, maxPick: 20 },
  'lotofacil': { name: 'Lotofácil', min: 1, max: 25, minPick: 15, maxPick: 20 },
  'lotomania': { name: 'Lotomania', min: 0, max: 99, minPick: 50, maxPick: 50 },
};

const pad = (n) => String(n).padStart(2, '0');

export default function Home() {
  const [selectedLottery, setSelectedLottery] = useState('mega-sena');
  const [numbersPerGame, setNumbersPerGame] = useState(LOTTERIES['mega-sena'].minPick);
  const [ticketCount, setTicketCount] = useState(1);
  const [receiveEmail, setReceiveEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [manualNumbers, setManualNumbers] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [notification, setNotification] = useState(null);
  const [result, setResult] = useState(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'COLOQUE_Sua_URL_Do_API_GATEWAY_AQUI';
  const cfg = LOTTERIES[selectedLottery];
  const isFixed = cfg.minPick === cfg.maxPick;

  const changeLottery = (id) => {
    setSelectedLottery(id);
    setNumbersPerGame(LOTTERIES[id].minPick);
    setManualNumbers([]);
    setManualMode(false);
    setResult(null);
  };

  const changeNumbersPerGame = (value) => {
    const n = parseInt(value, 10) || cfg.minPick;
    const clamped = Math.min(Math.max(n, cfg.minPick), cfg.maxPick);
    setNumbersPerGame(clamped);
    setManualNumbers([]); // muda a quantidade exigida; limpa a seleção manual
  };

  const toggleManualNumber = (n) => {
    setManualNumbers((prev) => {
      if (prev.includes(n)) return prev.filter((x) => x !== n);
      if (prev.length >= numbersPerGame) return prev; // limite atingido
      return [...prev, n];
    });
  };

  const handleGenerate = async () => {
    setNotification(null);
    setResult(null);

    if (manualMode && manualNumbers.length !== numbersPerGame) {
      setNotification({ type: 'error', text: `Selecione exatamente ${numbersPerGame} dezenas para o jogo manual.` });
      return;
    }
    if (receiveEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setNotification({ type: 'error', text: 'Informe um e-mail válido para receber o resultado.' });
      return;
    }

    setIsGenerating(true);
    try {
      const payload = {
        lottery: selectedLottery,
        numbersPerGame,
        gamesToGenerate: ticketCount,
        email: receiveEmail ? email : null,
        numbers: manualMode ? [[...manualNumbers].sort((a, b) => a - b)] : null,
      };

      const res = await fetch(`${API_URL}/jogos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setResult(data);
        setNotification({
          type: 'success',
          text: receiveEmail
            ? '✅ Jogos gerados! Você receberá o resultado por e-mail após o sorteio.'
            : '✅ Jogos gerados com sucesso!',
        });
      } else {
        setNotification({ type: 'error', text: `❌ ${data.message || 'Erro ao gerar os jogos.'}` });
      }
    } catch (err) {
      console.error(err);
      setNotification({ type: 'error', text: '❌ Falha na conexão com o servidor.' });
    } finally {
      setIsGenerating(false);
    }
  };

  const gridNumbers = Array.from({ length: cfg.max - cfg.min + 1 }, (_, i) => cfg.min + i);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className="animate-fade-in">
          <h1 className={styles.title}>Loterias <span className="text-gradient">Sim</span></h1>
          <p className={styles.subtitle}>Gere e simule seus jogos da Mega-Sena, Lotofácil e Lotomania. Confira o resultado automaticamente após o sorteio.</p>
        </div>
      </header>

      <section className={`${styles.mainPanel} glass-panel animate-fade-in`} style={{ animationDelay: '0.1s' }}>
        <div className={styles.lotterySelector}>
          {Object.entries(LOTTERIES).map(([id, l]) => (
            <button
              key={id}
              className={`${styles.lotteryBtn} ${selectedLottery === id ? styles.active : ''}`}
              onClick={() => changeLottery(id)}
            >
              {l.name}
            </button>
          ))}
        </div>

        <div className={styles.actionArea}>
          <div className={styles.controlGroup}>
            <label>Dezenas por jogo</label>
            <input
              type="number"
              min={cfg.minPick}
              max={cfg.maxPick}
              value={numbersPerGame}
              disabled={isFixed}
              onChange={(e) => changeNumbersPerGame(e.target.value)}
              className={styles.inputGlass}
            />
            <span className={styles.hint}>
              {isFixed ? `${cfg.minPick} dezenas (fixo) de ${pad(cfg.min)} a ${pad(cfg.max)}`
                : `Escolha de ${cfg.minPick} a ${cfg.maxPick} dezenas (universo ${pad(cfg.min)}–${pad(cfg.max)})`}
            </span>
          </div>

          <div className={styles.controlGroup}>
            <label>Quantidade de jogos</label>
            <input
              type="number"
              min="1"
              max="100"
              value={ticketCount}
              onChange={(e) => setTicketCount(Math.min(Math.max(parseInt(e.target.value, 10) || 1, 1), 100))}
              className={styles.inputGlass}
            />
          </div>

          <div className={styles.controlGroup}>
            <label className={styles.checkboxRow}>
              <input type="checkbox" checked={manualMode} onChange={(e) => { setManualMode(e.target.checked); setManualNumbers([]); }} />
              Escolher os números de 1 jogo manualmente
            </label>
            {manualMode && (
              <>
                <span className={styles.hint}>Selecionadas: {manualNumbers.length}/{numbersPerGame}</span>
                <div className={styles.numberGrid}>
                  {gridNumbers.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`${styles.numberCell} ${manualNumbers.includes(n) ? styles.selected : ''}`}
                      onClick={() => toggleManualNumber(n)}
                    >
                      {pad(n)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className={styles.controlGroup}>
            <label className={styles.checkboxRow}>
              <input type="checkbox" checked={receiveEmail} onChange={(e) => setReceiveEmail(e.target.checked)} />
              Quero receber o resultado por e-mail
            </label>
            {receiveEmail && (
              <input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.inputGlass}
              />
            )}
          </div>

          <button
            className="btn btn-primary"
            style={{ marginTop: '0.5rem', width: '100%' }}
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? 'Gerando...' : '✨ Gerar Jogos'}
          </button>

          {notification && (
            <div className={`${styles.notification} ${notification.type === 'error' ? styles.notifError : styles.notifSuccess}`}>
              {notification.text}
            </div>
          )}

          {result?.games && (
            <div className={styles.result}>
              <div className={styles.resultHeader}>
                <strong>{cfg.name}</strong> · Concurso #{result.lotteryNumber}
                <span className={styles.voucher}>voucher: {result.voucher}</span>
              </div>
              {result.games.map((game, i) => (
                <div key={i} className={styles.gameRow}>
                  <span className={styles.gameIndex}>{i + 1}</span>
                  {game.map((n) => <span key={n} className={styles.ball}>{pad(n)}</span>)}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className={`${styles.infoSection} animate-fade-in`} style={{ animationDelay: '0.2s' }}>
        <div className={`${styles.card} glass-panel`}>
          <h3>📈 Análise Preditiva</h3>
          <p>Estatísticas do histórico (números mais e menos sorteados) geram sugestões de jogos. Lembre-se: cada sorteio é independente — as análises são informativas e não aumentam suas chances reais.</p>
        </div>
        <div className={`${styles.card} glass-panel`}>
          <h3>⚡ Apuração Automatizada</h3>
          <p>Seus jogos são guardados e conferidos automaticamente após o sorteio. Se optar por e-mail, você recebe o resultado com seus acertos.</p>
        </div>
      </section>
    </div>
  )
}
