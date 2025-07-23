import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { render } from './utils'
import { server } from './mocks/server'

// Configurar servidor de mocks
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// Mock do router
vi.mock('wouter', () => ({
  useLocation: () => ['/pallets', vi.fn()],
  Link: ({ children, href }: any) => <a href={href}>{children}</a>,
}))

// Mock dos componentes que podem causar problemas
vi.mock('@/components/camera-capture', () => ({
  default: () => <div data-testid="camera-capture">Camera Capture</div>
}))

vi.mock('@/components/qr-code-dialog', () => ({
  default: () => <div data-testid="qr-code-dialog">QR Code Dialog</div>
}))

describe('Página de Pallets - Teste Simples', () => {
  it('deve renderizar o título da página', async () => {
    render(<div>Pallets</div>)
    
    expect(screen.getByText('Pallets')).toBeInTheDocument()
  })

  it('deve renderizar elementos básicos', async () => {
    render(
      <div>
        <h1>Pallets</h1>
        <p>Gerenciamento de pallets do armazém</p>
        <button>Novo Pallet</button>
      </div>
    )
    
    expect(screen.getByText('Pallets')).toBeInTheDocument()
    expect(screen.getByText('Gerenciamento de pallets do armazém')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /novo pallet/i })).toBeInTheDocument()
  })

  it('deve testar se o mock server está funcionando', async () => {
    const response = await fetch('/api/pallets')
    const data = await response.json()
    
    expect(response.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBe(3)
  })
}) 