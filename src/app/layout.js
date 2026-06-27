import './globals.css'

export const metadata = {
  title: 'Loterias Sim | Simulações Inteligentes',
  description: 'Simulador inteligente de Loterias com análise preditiva.',
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
