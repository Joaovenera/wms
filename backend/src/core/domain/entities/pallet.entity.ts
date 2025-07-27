import { BaseEntity, Dimensions } from '../../shared/types/index.js';
import { PalletType, PalletMaterial } from '../../shared/enums/index.js';
import { STATUS } from '../../shared/constants/index.js';

export interface PalletEntity extends BaseEntity {
  code: string;
  type: PalletType;
  material: PalletMaterial;
  width: number;
  length: number;
  height: number;
  maxWeight: number;
  status: string;
  photoUrl?: string;
  observations?: string;
  lastInspectionDate?: Date;
}

export interface CreatePalletData {
  code: string;
  type: PalletType;
  material: PalletMaterial;
  width: number;
  length: number;
  height: number;
  maxWeight: number;
  photoUrl?: string;
  observations?: string;
  lastInspectionDate?: Date;
}

export interface UpdatePalletData {
  type?: PalletType;
  material?: PalletMaterial;
  width?: number;
  length?: number;
  height?: number;
  maxWeight?: number;
  status?: string;
  photoUrl?: string;
  observations?: string;
  lastInspectionDate?: Date;
}

export class Pallet implements PalletEntity {
  public readonly id: number;
  public readonly code: string;
  public readonly type: PalletType;
  public readonly material: PalletMaterial;
  public readonly width: number;
  public readonly length: number;
  public readonly height: number;
  public readonly maxWeight: number;
  public readonly status: string;
  public readonly photoUrl?: string;
  public readonly observations?: string;
  public readonly lastInspectionDate?: Date;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;
  public readonly createdBy?: number;

  constructor(data: PalletEntity) {
    this.id = data.id;
    this.code = data.code;
    this.type = data.type;
    this.material = data.material;
    this.width = data.width;
    this.length = data.length;
    this.height = data.height;
    this.maxWeight = data.maxWeight;
    this.status = data.status;
    this.photoUrl = data.photoUrl;
    this.observations = data.observations;
    this.lastInspectionDate = data.lastInspectionDate;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.createdBy = data.createdBy;
  }

  // Domain methods
  get dimensions(): Dimensions {
    return {
      width: this.width,
      length: this.length,
      height: this.height,
    };
  }

  get volume(): number {
    return this.width * this.length * this.height;
  }

  get surfaceArea(): number {
    return this.width * this.length;
  }

  isAvailable(): boolean {
    return this.status === STATUS.PALLET.DISPONIVEL;
  }

  isInUse(): boolean {
    return this.status === STATUS.PALLET.EM_USO;
  }

  isDefective(): boolean {
    return this.status === STATUS.PALLET.DEFEITUOSO;
  }

  needsInspection(): boolean {
    if (!this.lastInspectionDate) return true;
    
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    return this.lastInspectionDate < sixMonthsAgo;
  }

  canBeUsed(): boolean {
    return this.isAvailable() && !this.isDefective();
  }

  getCapacityInfo(): {
    maxWeight: number;
    volume: number;
    surfaceArea: number;
    dimensions: Dimensions;
  } {
    return {
      maxWeight: this.maxWeight,
      volume: this.volume,
      surfaceArea: this.surfaceArea,
      dimensions: this.dimensions,
    };
  }

  // Factory methods
  static create(data: CreatePalletData & { createdBy: number }): Omit<PalletEntity, 'id' | 'createdAt' | 'updatedAt'> {
    return {
      code: data.code.toUpperCase().trim(),
      type: data.type,
      material: data.material,
      width: data.width,
      length: data.length,
      height: data.height,
      maxWeight: data.maxWeight,
      status: STATUS.PALLET.DISPONIVEL,
      photoUrl: data.photoUrl,
      observations: data.observations?.trim(),
      lastInspectionDate: data.lastInspectionDate,
      createdBy: data.createdBy,
    };
  }

  static update(current: PalletEntity, updates: UpdatePalletData): Partial<PalletEntity> {
    const updated: Partial<PalletEntity> = {};

    if (updates.type && updates.type !== current.type) {
      updated.type = updates.type;
    }

    if (updates.material && updates.material !== current.material) {
      updated.material = updates.material;
    }

    if (updates.width && updates.width !== current.width) {
      updated.width = updates.width;
    }

    if (updates.length && updates.length !== current.length) {
      updated.length = updates.length;
    }

    if (updates.height && updates.height !== current.height) {
      updated.height = updates.height;
    }

    if (updates.maxWeight && updates.maxWeight !== current.maxWeight) {
      updated.maxWeight = updates.maxWeight;
    }

    if (updates.status && updates.status !== current.status) {
      updated.status = updates.status;
    }

    if (updates.photoUrl !== undefined && updates.photoUrl !== current.photoUrl) {
      updated.photoUrl = updates.photoUrl;
    }

    if (updates.observations !== undefined && updates.observations !== current.observations) {
      updated.observations = updates.observations?.trim();
    }

    if (updates.lastInspectionDate !== undefined && updates.lastInspectionDate !== current.lastInspectionDate) {
      updated.lastInspectionDate = updates.lastInspectionDate;
    }

    return updated;
  }

  // Status change methods
  static markAsInUse(current: PalletEntity): Partial<PalletEntity> {
    if (!current.canBeUsed()) {
      throw new Error(`Pallet ${current.code} cannot be marked as in use`);
    }
    
    return {
      status: STATUS.PALLET.EM_USO,
    };
  }

  static markAsAvailable(current: PalletEntity): Partial<PalletEntity> {
    return {
      status: STATUS.PALLET.DISPONIVEL,
    };
  }

  static markAsDefective(current: PalletEntity, reason?: string): Partial<PalletEntity> {
    return {
      status: STATUS.PALLET.DEFEITUOSO,
      observations: reason ? `${current.observations || ''} - Marcado como defeituoso: ${reason}`.trim() : current.observations,
    };
  }
}