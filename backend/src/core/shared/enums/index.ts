// User roles
export enum UserRole {
  ADMIN = 'admin',
  OPERATOR = 'operator',
}

// Movement types
export enum MovementType {
  RECEPTION = 'reception',
  SHIPMENT = 'shipment',
  TRANSFER = 'transfer',
  ADJUSTMENT = 'adjustment',
}

// UCP History actions
export enum UcpHistoryAction {
  CREATED = 'created',
  ITEM_ADDED = 'item_added',
  ITEM_REMOVED = 'item_removed',
  MOVED = 'moved',
  STATUS_CHANGED = 'status_changed',
  DISMANTLED = 'dismantled',
  ITEM_TRANSFERRED_IN = 'item_transferred_in',
  ITEM_TRANSFERRED_OUT = 'item_transferred_out',
}

// Transfer types
export enum TransferType {
  PARTIAL = 'partial',
  COMPLETE = 'complete',
}

// Photo actions
export enum PhotoAction {
  ADDED = 'added',
  REMOVED = 'removed',
  SET_PRIMARY = 'set_primary',
  UNSET_PRIMARY = 'unset_primary',
}

// Divergence reasons for loading
export enum DivergenceReason {
  FALTA_ESPACO = 'falta_espaco',
  ITEM_AVARIADO = 'item_avariado',
  DIVERGENCIA_ESTOQUE = 'divergencia_estoque',
  ITEM_NAO_LOCALIZADO = 'item_nao_localizado',
}

// Report types
export enum ReportType {
  SUMMARY = 'summary',
  DETAILED = 'detailed',
  DIVERGENCE_ANALYSIS = 'divergence_analysis',
}

// Loading execution status
export enum LoadingExecutionStatus {
  EM_ANDAMENTO = 'em_andamento',
  FINALIZADO = 'finalizado',
  CANCELADO = 'cancelado',
}

// Rack types
export enum RackType {
  CONVENTIONAL = 'conventional',
  DRIVE_IN = 'drive-in',
  PUSH_BACK = 'push-back',
}

// Pallet types
export enum PalletType {
  PBR = 'PBR',
  EUROPEU = 'Europeu',
  CHEP = 'Chep',
}

// Pallet materials
export enum PalletMaterial {
  MADEIRA = 'Madeira',
  PLASTICO = 'Plástico',
  METAL = 'Metal',
}