export interface ContainerPhoto {
  id: string;
  type: 'seal' | 'container_number' | 'first_opening' | 'clean_empty' | 'truck_plate' | 'trailer_plate' | 'evidence';
  url: string;
  filename: string;
  uploadedAt: string;
  size: number;
  mimeType: string;
  note?: string;
}

// Tipos de chegada (Arrival Types)
export type ArrivalType = 'container' | 'truck' | 'delivery';
export type DepartureType = 'transfer' | 'withdrawal';

// Container Arrival (existing)
export interface ContainerArrival {
  id: number;
  containerNumber: string;
  sealNumber: string;
  status: 'awaiting' | 'arrived' | 'documenting' | 'unloading' | 'completed';
  
  // Informações básicas
  supplierName: string;
  estimatedArrival: string;
  actualArrival?: string;
  notes?: string;
  
  // Transportador/Veículo (preenchido na chegada)
  transporterName?: string;
  transporterContact?: string;
  vehicleInfo?: string;
  driverName?: string;
  driverDocument?: string;
  
  // Fotos obrigatórias
  photos: ContainerPhoto[];
  
  // Produtos (sem limitação de estoque)
  items: ContainerItem[];
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  createdByName: string;
  completedAt?: string;
}

// Truck Arrival (new)
export interface TruckArrival {
  id: number;
  type: 'truck';
  status: 'awaiting' | 'arrived' | 'unloading' | 'completed';
  
  // Informações básicas
  supplierName: string;
  estimatedArrival: string;
  actualArrival?: string;
  notes?: string;
  
  // Informações do veículo (obrigatórias)
  vehicleInfo: {
    licensePlate?: string;
    trailerPlate?: string;
    driverName?: string;
    driverDocument?: string;
    transporterName?: string;
    transporterContact?: string;
  };
  
  // Produtos (sem limitação de estoque)
  items: ArrivalItem[];
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  createdByName: string;
  completedAt?: string;
}

// Delivery Arrival (new)
export interface DeliveryArrival {
  id: number;
  type: 'delivery';
  status: 'awaiting' | 'arrived' | 'unloading' | 'completed';
  
  // Informações básicas
  supplierName: string;
  estimatedArrival: string;
  actualArrival?: string;
  notes?: string;
  
  // Transportadora (opcional)
  transporterName?: string;
  
  // Produtos (sem limitação de estoque)
  items: ArrivalItem[];
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  createdByName: string;
  completedAt?: string;
}

// Transfer Departure (existing, but with new structure)
export interface TransferDeparture {
  id: number;
  type: 'transfer';
  status: 'planning' | 'approved' | 'loading' | 'in_transit' | 'completed';
  
  // Informações básicas
  fromLocation: string;
  toLocation: string;
  estimatedDeparture: string;
  actualDeparture?: string;
  notes?: string;
  
  // Informações do veículo (obrigatórias)
  vehicleInfo: {
    vehicleId: number;
    licensePlate: string;
    driverName: string;
    driverDocument?: string;
  };
  
  // Itens obrigatórios e opcionais
  mandatoryItems: TransferItem[];
  optionalItems: TransferItem[];
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  createdByName: string;
  completedAt?: string;
}

// Withdrawal Departure (new)
export interface WithdrawalDeparture {
  id: number;
  type: 'withdrawal';
  status: 'pending' | 'approved' | 'ready' | 'picked_up';
  
  // Informações do cliente
  clientInfo: {
    clientId?: number;
    clientName: string;
    clientDocument?: string;
    contactInfo?: string;
  };
  
  // Informações básicas (sem data definida)
  notes?: string;
  
  // Produtos para retirada
  items: WithdrawalItem[];
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  createdByName: string;
  pickedUpAt?: string;
}

// Base item interface
export interface BaseItem {
  id?: number;
  productId: number;
  productName: string;
  productSku: string;
  quantity: string;
  unitCubicVolume?: number;
  totalCubicVolume?: number;
  notes?: string;
}

// Container items (existing)
export interface ContainerItem extends BaseItem {
  condition?: 'good' | 'damaged' | 'missing';
}

// Arrival items (for truck and delivery arrivals)
export interface ArrivalItem extends BaseItem {
  condition?: 'good' | 'damaged' | 'missing';
}

// Transfer items (for departures)
export interface TransferItem extends BaseItem {
  availableStock?: number;
  priority?: 'mandatory' | 'optional';
}

// Withdrawal items (for client withdrawals)
export interface WithdrawalItem extends BaseItem {
  availableStock?: number;
  approvedQuantity?: string;
}

export interface ContainerPhotoType {
  type: 'seal' | 'container_number' | 'first_opening' | 'clean_empty' | 'truck_plate' | 'trailer_plate';
  label: string;
  description: string;
  required: boolean;
  icon: string;
}

export const CONTAINER_PHOTO_TYPES: ContainerPhotoType[] = [
  {
    type: 'seal',
    label: 'Lacre do Container',
    description: 'Foto clara do lacre/selo de segurança do container',
    required: true,
    icon: 'Lock'
  },
  {
    type: 'container_number',
    label: 'Número do Container',
    description: 'Foto do número de identificação do container',
    required: true,
    icon: 'Hash'
  },
  {
    type: 'first_opening',
    label: 'Primeira Abertura',
    description: 'Foto da primeira abertura das portas do container',
    required: true,
    icon: 'DoorOpen'
  },
  {
    type: 'truck_plate',
    label: 'Placa do Caminhão',
    description: 'Foto nítida da placa do cavalo mecânico/caminhão',
    required: true,
    icon: 'Hash'
  },
  {
    type: 'trailer_plate',
    label: 'Placa do Reboque',
    description: 'Foto nítida da placa do reboque/carreta',
    required: true,
    icon: 'Hash'
  },
  {
    type: 'clean_empty',
    label: 'Container Limpo',
    description: 'Foto do container vazio e limpo após descarregamento',
    required: true,
    icon: 'Sparkles'
  }
];

export interface ContainerArrivalStats {
  total: number;
  awaiting: number;
  arrived: number;
  documenting: number;
  unloading: number;
  completed: number;
}

// Status do container com informações de display
// Arrival/Departure type configurations
export const ARRIVAL_TYPE_CONFIG = {
  container: {
    label: 'Container',
    icon: 'Ship',
    color: 'blue',
    description: 'Chegada de container com documentação fotográfica'
  },
  truck: {
    label: 'Caminhão',
    icon: 'Truck', 
    color: 'green',
    description: 'Chegada de mercadoria via caminhão próprio'
  },
  delivery: {
    label: 'Entrega',
    icon: 'Package',
    color: 'purple', 
    description: 'Entrega via transportadora'
  }
} as const;

export const DEPARTURE_TYPE_CONFIG = {
  transfer: {
    label: 'Transferência',
    icon: 'ArrowRight',
    color: 'blue',
    description: 'Transferência entre locais com veículo definido'
  },
  withdrawal: {
    label: 'Retirada',
    icon: 'UserCheck',
    color: 'orange',
    description: 'Retirada de mercadoria por cliente'
  }
} as const;

// Status configurations
export const CONTAINER_STATUS_CONFIG = {
  awaiting: {
    label: 'Aguardando',
    color: 'gray',
    icon: 'Clock',
    description: 'Container programado, aguardando chegada'
  },
  arrived: {
    label: 'Chegou',
    color: 'blue', 
    icon: 'Truck',
    description: 'Container chegou, aguardando documentação'
  },
  documenting: {
    label: 'Documentando',
    color: 'yellow',
    icon: 'Camera',
    description: 'Registrando fotos e informações do container'
  },
  unloading: {
    label: 'Descarregando',
    color: 'orange',
    icon: 'Package',
    description: 'Container sendo descarregado'
  },
  completed: {
    label: 'Concluído',
    color: 'green',
    icon: 'CheckCircle',
    description: 'Container processado e documentado completamente'
  }
} as const;

export const ARRIVAL_STATUS_CONFIG = {
  awaiting: {
    label: 'Aguardando',
    color: 'gray',
    icon: 'Clock',
    description: 'Mercadoria programada, aguardando chegada'
  },
  arrived: {
    label: 'Chegou',
    color: 'blue',
    icon: 'Truck', 
    description: 'Mercadoria chegou, iniciando descarregamento'
  },
  unloading: {
    label: 'Descarregando',
    color: 'orange',
    icon: 'Package',
    description: 'Mercadoria sendo descarregada'
  },
  completed: {
    label: 'Concluído',
    color: 'green',
    icon: 'CheckCircle',
    description: 'Mercadoria recebida e registrada completamente'
  }
} as const;

export const DEPARTURE_STATUS_CONFIG = {
  planning: {
    label: 'Planejamento',
    color: 'gray',
    icon: 'Clock',
    description: 'Em fase de planejamento'
  },
  approved: {
    label: 'Aprovado',
    color: 'green',
    icon: 'CheckCircle',
    description: 'Aprovado, aguardando carregamento'
  },
  loading: {
    label: 'Carregando',
    color: 'yellow',
    icon: 'Package',
    description: 'Mercadoria sendo carregada'
  },
  in_transit: {
    label: 'Em Trânsito',
    color: 'blue',
    icon: 'Truck',
    description: 'Mercadoria em trânsito'
  },
  completed: {
    label: 'Concluído',
    color: 'green',
    icon: 'CheckCircle',
    description: 'Transferência concluída'
  }
} as const;

export const WITHDRAWAL_STATUS_CONFIG = {
  pending: {
    label: 'Pendente',
    color: 'gray',
    icon: 'Clock',
    description: 'Aguardando aprovação'
  },
  approved: {
    label: 'Aprovado',
    color: 'green',
    icon: 'CheckCircle',
    description: 'Aprovado para retirada'
  },
  ready: {
    label: 'Pronto',
    color: 'blue',
    icon: 'Package',
    description: 'Mercadoria separada e pronta para retirada'
  },
  picked_up: {
    label: 'Retirado',
    color: 'green',
    icon: 'UserCheck',
    description: 'Mercadoria retirada pelo cliente'
  }
} as const;