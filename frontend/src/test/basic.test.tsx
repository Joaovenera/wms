import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

// Componente simples para teste
function TestComponent() {
  return (
    <div>
      <h1>Sistema de Testes</h1>
      <p>Funcionando corretamente!</p>
    </div>
  )
}

describe('Infraestrutura de Testes', () => {
  it('deve renderizar componente básico', () => {
    render(<TestComponent />)
    
    expect(screen.getByText('Sistema de Testes')).toBeInTheDocument()
    expect(screen.getByText('Funcionando corretamente!')).toBeInTheDocument()
  })

  it('deve executar assertions básicas', () => {
    expect(1 + 1).toBe(2)
    expect('hello').toMatch(/ell/)
    expect([1, 2, 3]).toHaveLength(3)
  })
}) 