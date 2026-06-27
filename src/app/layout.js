import './globals.css'

export const metadata = {
  metadataBase: new URL('https://loteriassim.com.br'),
  title: 'Loterias Sim | Simulações Inteligentes',
  description: 'Gere e simule jogos da Mega-Sena, Lotofácil e Lotomania, confira resultados e veja sugestões a partir da análise estatística do histórico.',
  keywords: ['loteria', 'mega-sena', 'lotofácil', 'lotomania', 'simulador', 'resultados', 'sorteio'],
  openGraph: {
    title: 'Loterias Sim',
    description: 'Simulador das loterias brasileiras com análise estatística e conferência de resultados.',
    url: 'https://loteriassim.com.br',
    siteName: 'Loterias Sim',
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Loterias Sim',
    description: 'Simulador das loterias brasileiras com análise estatística e conferência de resultados.',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        <main className="app-container">
          {children}
        </main>
      </body>
    </html>
  )
}
