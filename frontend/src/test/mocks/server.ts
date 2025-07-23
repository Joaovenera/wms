import { setupServer } from 'msw/node'
import { handlers } from './handlers'

// Configurar o servidor de mock para uso em testes Node.js
export const server = setupServer(...handlers) 