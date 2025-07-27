import { Repository, QueryFilters } from '../../shared/types/index.js';
import { PalletEntity, CreatePalletData, UpdatePalletData } from '../entities/pallet.entity.js';

export interface PalletRepository extends Repository<PalletEntity> {
  // Basic CRUD
  findById(id: number): Promise<PalletEntity | null>;
  findAll(filters?: PalletQueryFilters): Promise<PalletEntity[]>;
  create(data: CreatePalletData & { createdBy: number }): Promise<PalletEntity>;
  update(id: number, data: UpdatePalletData): Promise<PalletEntity | null>;
  delete(id: number): Promise<boolean>;
  
  // Specific finders
  findByCode(code: string): Promise<PalletEntity | null>;
  findByStatus(status: string): Promise<PalletEntity[]>;
  findByType(type: string): Promise<PalletEntity[]>;
  findByMaterial(material: string): Promise<PalletEntity[]>;
  
  // Availability methods
  findAvailable(): Promise<PalletEntity[]>;
  findAvailableForUcp(): Promise<PalletEntity[]>;
  findInUse(): Promise<PalletEntity[]>;
  findDefective(): Promise<PalletEntity[]>;
  
  // Status management
  markAsInUse(id: number): Promise<PalletEntity | null>;
  markAsAvailable(id: number): Promise<PalletEntity | null>;
  markAsDefective(id: number, reason?: string): Promise<PalletEntity | null>;
  
  // Inspection methods
  findNeedingInspection(): Promise<PalletEntity[]>;
  updateLastInspection(id: number, date: Date): Promise<PalletEntity | null>;
  
  // Code generation
  getNextCode(): Promise<string>;
  codeExists(code: string): Promise<boolean>;
  
  // Statistics
  countByStatus(): Promise<{ status: string; count: number }[]>;
  countByType(): Promise<{ type: string; count: number }[]>;
  countByMaterial(): Promise<{ material: string; count: number }[]>;
  
  // Bulk operations
  createMany(pallets: (CreatePalletData & { createdBy: number })[]): Promise<PalletEntity[]>;
  updateStatusBulk(ids: number[], status: string): Promise<number>;
  
  // Utility methods
  count(filters?: PalletQueryFilters): Promise<number>;
  existsByCode(code: string): Promise<boolean>;
  
  // Capacity methods
  findByCapacity(minWeight?: number, maxWeight?: number, minVolume?: number, maxVolume?: number): Promise<PalletEntity[]>;
  getCapacityStats(): Promise<{ avgWeight: number; avgVolume: number; totalCapacity: number }>;
}

export interface PalletQueryFilters extends QueryFilters {
  code?: string;
  type?: string;
  material?: string;
  status?: string;
  minWeight?: number;
  maxWeight?: number;
  minVolume?: number;
  maxVolume?: number;
  needsInspection?: boolean;
  createdFrom?: Date;
  createdTo?: Date;
  lastInspectionFrom?: Date;
  lastInspectionTo?: Date;
}