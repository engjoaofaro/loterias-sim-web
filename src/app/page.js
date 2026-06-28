'use client'
import { useState, useEffect } from 'react';
import styles from './page.module.css';

// Regras por modalidade (espelham o backend em loterias-sim-api/games.js)
const LOTTERIES = {
  'mega-sena': { name: 'Mega-Sena', min: 1, max: 60, minPick: 6, maxPick: 20 },
  'lotofacil': { name: 'Lotofácil', min: 1, max: 25, minPick: 15, maxPick: 20 },
  'lotomania': { name: 'Lotomania', min: 0, max: 99, minPick: 50, maxPick: 50 },
};

const pad = (n) => String(n).padStart(2, '0');

// fetch com timeout (AbortController) e retry opcional (use só em GETs idempotentes).
async function fetchJSON(url, { timeout = 12000, retries = 0, ...opts } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, { ...opts, signal: ctrl.signal });
      clearTimeout(timer);
      return res;
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }
  throw lastErr;
}

const isTimeout = (err) => err && (err.name === 'AbortError' || err.name === 'TimeoutError');

export default function Home() {
  const [selectedLottery, setSelectedLottery] = useState('mega-sena');
  const [numbersPerGame, setNumbersPerGame] = useState(LOTTERIES['mega-sena'].minPick);
  const [numbersPerGameRaw, setNumbersPerGameRaw] = useState(String(LOTTERIES['mega-sena'].minPick));
  const [ticketCount, setTicketCount] = useState(1);
  const [ticketCountRaw, setTicketCountRaw] = useState('1');
  const [receiveEmail, setReceiveEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [manualNumbers, setManualNumbers] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [notification, setNotification] = useState(null);
  const [result, setResult] = useState(null);
  const [lastResults, setLastResults] = useState(null);
  const [predictions, setPredictions] = useState(null);
  const [voucher, setVoucher] = useState('');
  const [aposta, setAposta] = useState(null);
  const [checking, setChecking] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'COLOQUE_Sua_URL_Do_API_GATEWAY_AQUI';
  const cfg = LOTTERIES[selectedLottery];
  const isFixed = cfg.minPick === cfg.maxPick;

  useEffect(() => {
    fetchJSON(`${API_URL}/resultados`, { timeout: 10000, retries: 1 })
      .then((r) => (r.ok ? r.json() : null)).then((d) => d && setLastResults(d.results)).catch(() => {});
    fetchJSON(`${API_URL}/sugestoes`, { timeout: 10000, retries: 1 })
      .then((r) => (r.ok ? r.json() : null)).then((d) => d && setPredictions(d.suggestions)).catch(() => {});
  }, [API_URL]);

  const changeLottery = (id) => {
    setSelectedLottery(id);
    setNumbersPerGame(LOTTERIES[id].minPick);
    setNumbersPerGameRaw(String(LOTTERIES[id].minPick));
    setManualNumbers([]);
    setManualMode(false);
    setResult(null);
  };

  const commitNumbersPerGame = (raw) => {
    const n = parseInt(raw, 10);
    const clamped = isNaN(n) ? cfg.minPick : Math.min(Math.max(n, cfg.minPick), cfg.maxPick);
    setNumbersPerGame(clamped);
    setNumbersPerGameRaw(String(clamped));
    setManualNumbers([]);
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

      // POST não é idempotente -> sem retry, só timeout.
      const res = await fetchJSON(`${API_URL}/jogos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        timeout: 15000,
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
      setNotification({
        type: 'error',
        text: isTimeout(err) ? '❌ Tempo de conexão esgotado. Tente novamente.' : '❌ Falha na conexão com o servidor.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCheck = async () => {
    if (!voucher.trim()) return;
    setChecking(true);
    setAposta(null);
    try {
      const res = await fetchJSON(`${API_URL}/apostas/${encodeURIComponent(voucher.trim())}`, { timeout: 10000, retries: 1 });
      const data = await res.json().catch(() => ({}));
      setAposta(res.ok ? data : { status: 'nao_encontrado' });
    } catch (err) {
      console.error(err);
      setAposta({ status: 'erro' });
    } finally {
      setChecking(false);
    }
  };

  const lotteryName = (id) => LOTTERIES[id]?.name || id;
  const gridNumbers = Array.from({ length: cfg.max - cfg.min + 1 }, (_, i) => cfg.min + i);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className="animate-fade-in">
          <h1 className={styles.logoHeading}>
            <img src="/logo-loterias-sim.png" alt="Loterias Sim — Simulações de Sorte" className={styles.logo} />
          </h1>
          <p className={styles.subtitle}>Gere e simule seus jogos da Mega-Sena, Lotofácil e Lotomania. Confira o resultado automaticamente após o sorteio.</p>
        </div>
      </header>

      <section className={`${styles.mainPanel} glass-panel animate-fade-in`} style={{ animationDelay: '0.1s' }} aria-label="Gerar jogos">
        <div className={styles.lotterySelector} role="group" aria-label="Escolha a loteria">
          {Object.entries(LOTTERIES).map(([id, l]) => (
            <button
              key={id}
              type="button"
              aria-pressed={selectedLottery === id}
              className={`${styles.lotteryBtn} ${selectedLottery === id ? styles.active : ''}`}
              onClick={() => changeLottery(id)}
            >
              {l.name}
            </button>
          ))}
        </div>

        <div className={styles.actionArea}>
          <div className={styles.controlGroup}>
            <label htmlFor="numbersPerGame">Dezenas por jogo</label>
            <input
              id="numbersPerGame"
              type="number"
              min={cfg.minPick}
              max={cfg.maxPick}
              value={numbersPerGameRaw}
              disabled={isFixed}
              aria-describedby="numbersHint"
              onChange={(e) => setNumbersPerGameRaw(e.target.value)}
              onBlur={() => commitNumbersPerGame(numbersPerGameRaw)}
              className={styles.inputGlass}
            />
            <span id="numbersHint" className={styles.hint}>
              {isFixed ? `${cfg.minPick} dezenas (fixo) de ${pad(cfg.min)} a ${pad(cfg.max)}`
                : `Escolha de ${cfg.minPick} a ${cfg.maxPick} dezenas (universo ${pad(cfg.min)}–${pad(cfg.max)})`}
            </span>
          </div>

          <div className={styles.controlGroup}>
            <label htmlFor="ticketCount">Quantidade de jogos</label>
            <input
              id="ticketCount"
              type="number"
              min="1"
              max="100"
              value={ticketCountRaw}
              onChange={(e) => setTicketCountRaw(e.target.value)}
              onBlur={() => {
                const n = parseInt(ticketCountRaw, 10);
                const clamped = isNaN(n) ? 1 : Math.min(Math.max(n, 1), 100);
                setTicketCount(clamped);
                setTicketCountRaw(String(clamped));
              }}
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
                <span className={styles.hint} role="status" aria-live="polite">Selecionadas: {manualNumbers.length}/{numbersPerGame}</span>
                <div className={styles.numberGrid} role="group" aria-label="Escolha suas dezenas">
                  {gridNumbers.map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={manualNumbers.includes(n)}
                      aria-label={`Dezena ${pad(n)}`}
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
                aria-label="E-mail para receber o resultado"
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
            aria-busy={isGenerating}
          >
            {isGenerating ? 'Gerando...' : '✨ Gerar Jogos'}
          </button>

          {notification && (
            <div
              className={`${styles.notification} ${notification.type === 'error' ? styles.notifError : styles.notifSuccess}`}
              role={notification.type === 'error' ? 'alert' : 'status'}
              aria-live="polite"
            >
              {notification.text}
            </div>
          )}

          {result?.games && (
            <div className={styles.result} role="status" aria-live="polite">
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

          {predictions?.[selectedLottery]?.length > 0 && (
            <div className={styles.suggestions}>
              <h4 className={styles.suggestionsTitle}>💡 Sugestões para {cfg.name}</h4>
              {predictions[selectedLottery].slice(0, 3).map((g, i) => (
                <div key={i} className={styles.gameRow}>
                  {g.map((n) => <span key={n} className={styles.ballSm}>{pad(n)}</span>)}
                </div>
              ))}
              <span className={styles.hint}>Geradas por análise estatística do histórico — não aumentam suas chances reais.</span>
            </div>
          )}
        </div>
      </section>

      <section className={`${styles.checkPanel} glass-panel animate-fade-in`} aria-label="Conferir aposta">
        <h2 className={styles.sectionTitle}>Conferir aposta</h2>
        <div className={styles.checkRow}>
          <label htmlFor="voucher" className={styles.srOnly}>Voucher da aposta</label>
          <input
            id="voucher"
            className={styles.inputGlass}
            value={voucher}
            onChange={(e) => setVoucher(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCheck(); }}
            placeholder="Cole aqui o voucher da sua aposta"
          />
          <button className="btn btn-primary" onClick={handleCheck} disabled={checking} aria-busy={checking}>
            {checking ? 'Conferindo...' : 'Conferir'}
          </button>
        </div>

        <div role="status" aria-live="polite">
          {aposta?.status === 'apurada' && (
            <div className={styles.result}>
              <div className={styles.resultHeader}>
                <strong>{lotteryName(aposta.loteria)}</strong> · Concurso #{aposta.concurso}
              </div>
              <div className={`${styles.notification} ${aposta.premiado ? styles.notifSuccess : styles.notifError}`}>
                {aposta.premiado ? '🎉 Você foi premiado!' : 'Não foi dessa vez. 🍀'}
              </div>
              <span className={styles.hint}>Dezenas sorteadas</span>
              <div className={styles.resultBalls}>
                {aposta.dezenasSorteadas.map((n) => <span key={n} className={styles.ballSm}>{pad(n)}</span>)}
              </div>
              {aposta.resultados.map((r, i) => (
                <div key={i} className={styles.gameRow}>
                  <span className={styles.gameIndex}>{i + 1}</span>
                  {r.numbers.map((n) => <span key={n} className={styles.ballSm}>{pad(n)}</span>)}
                  <span className={styles.hits}>{r.premiacao ? `★ ${r.premiacao}` : `${r.hits} acertos`}</span>
                </div>
              ))}
            </div>
          )}
          {aposta?.status === 'pendente' && (
            <div className={`${styles.notification} ${styles.notifSuccess}`}>
              ✅ Aposta registrada para {lotteryName(aposta.loteria)} — concurso #{aposta.concurso}. Aguardando o sorteio.
            </div>
          )}
          {aposta?.status === 'nao_encontrado' && (
            <div className={`${styles.notification} ${styles.notifError}`}>Voucher não encontrado.</div>
          )}
          {aposta?.status === 'erro' && (
            <div className={`${styles.notification} ${styles.notifError}`}>Falha ao conferir. Tente novamente.</div>
          )}
        </div>
      </section>

      {lastResults && (
        <section className={`${styles.resultsSection} animate-fade-in`} aria-label="Últimos resultados">
          <h2 className={styles.sectionTitle}>Últimos resultados</h2>
          <div className={styles.resultsGrid}>
            {Object.entries(LOTTERIES).map(([id, l]) => lastResults[id] && (
              <div key={id} className={`${styles.resultCard} glass-panel`}>
                <div className={styles.resultCardHead}>
                  <strong>{l.name}</strong>
                  <span>Concurso {lastResults[id].concurso}</span>
                </div>
                <div className={styles.resultBalls}>
                  {lastResults[id].dezenas.map((n) => <span key={n} className={styles.ballSm}>{pad(n)}</span>)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

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

      <footer className={styles.footer}>
        <img src="/logo-loterias-sim.png" alt="Loterias Sim" className={styles.footerLogo} />
        <p className={styles.footerText}>
          Jogue com responsabilidade. As simulações e análises estatísticas são informativas
          e não aumentam suas chances reais de premiação — cada sorteio é um evento independente.
        </p>
        <p className={styles.footerCopy}>© 2026 Loterias Sim · loteriassim.com.br</p>
      </footer>
    </div>
  )
}
