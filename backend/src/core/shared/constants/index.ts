// Application constants
export const API_VERSION = 'v1';
export const APP_NAME = 'WMS Backend';

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Cache TTL values (in seconds)
export const CACHE_TTL = {
  SHORT: 300,    // 5 minutes
  MEDIUM: 1800,  // 30 minutes
  LONG: 3600,    // 1 hour
  DAY: 86400,    // 24 hours
} as const;

// File upload limits
export const FILE_LIMITS = {
  MAX_SIZE: 150 * 1024 * 1024, // 150MB
  MAX_COUNT: 10,
  ALLOWED_MIME_TYPES: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/pdf',
  ],
} as const;

// Business logic constants
export const BUSINESS_RULES = {
  UCP_CODE_PREFIX: 'UCP',
  PALLET_CODE_PREFIX: 'PLT',
  TRANSFER_REQUEST_PREFIX: 'TR',
  MIN_PASSWORD_LENGTH: 8,
  SESSION_DURATION: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
} as const;

// Status enums as constants
export const STATUS = {
  PALLET: {
    DISPONIVEL: 'disponivel',
    EM_USO: 'em_uso',
    DEFEITUOSO: 'defeituoso',
    RECUPERACAO: 'recuperacao',
    DESCARTE: 'descarte',
  },
  POSITION: {
    DISPONIVEL: 'disponivel',
    OCUPADA: 'ocupada',
    RESERVADA: 'reservada',
    MANUTENCAO: 'manutencao',
    BLOQUEADA: 'bloqueada',
  },
  UCP: {
    ACTIVE: 'active',
    EMPTY: 'empty',
    ARCHIVED: 'archived',
  },
  TRANSFER_REQUEST: {
    PLANEJAMENTO: 'planejamento',
    APROVADO: 'aprovado',
    CARREGAMENTO: 'carregamento',
    TRANSITO: 'transito',
    FINALIZADO: 'finalizado',
    CANCELADO: 'cancelado',
  },
  VEHICLE: {
    DISPONIVEL: 'disponivel',
    EM_USO: 'em_uso',
    MANUTENCAO: 'manutencao',
    INATIVO: 'inativo',
  },
} as const;