import { BaseEntity } from '../../shared/types/index.js';
import { STATUS } from '../../shared/constants/index.js';
import { UcpHistoryAction, TransferType } from '../../shared/enums/index.js';

export interface UcpEntity extends BaseEntity {
  code: string;
  palletId?: number;
  positionId?: number;
  status: string;
  observations?: string;
}

export interface UcpItemEntity extends BaseEntity {
  ucpId: number;
  productId: number;
  quantity: number;
  lot?: string;
  expiryDate?: Date;
  internalCode?: string;
  packagingTypeId?: number;
  packagingQuantity?: number;
  addedBy: number;
  addedAt: Date;
  removedBy?: number;
  removedAt?: Date;
  removalReason?: string;
  isActive: boolean;
}

export interface CreateUcpData {
  code: string;
  palletId?: number;
  positionId?: number;
  observations?: string;
}

export interface CreateUcpItemData {
  ucpId: number;
  productId: number;
  quantity: number;
  lot?: string;
  expiryDate?: Date;
  internalCode?: string;
  packagingTypeId?: number;
  packagingQuantity?: number;
}

export interface UcpWithItems extends UcpEntity {
  items: UcpItemEntity[];
  totalItems: number;
  totalQuantity: number;
  totalWeight?: number;
}

export interface TransferRequest {
  sourceUcpId: number;
  targetUcpId: number;
  itemId: number;
  quantity: number;
  reason: string;
  type: TransferType;
}

export class Ucp implements UcpEntity {
  public readonly id: number;
  public readonly code: string;
  public readonly palletId?: number;
  public readonly positionId?: number;
  public readonly status: string;
  public readonly observations?: string;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;
  public readonly createdBy?: number;

  constructor(data: UcpEntity) {
    this.id = data.id;
    this.code = data.code;
    this.palletId = data.palletId;
    this.positionId = data.positionId;
    this.status = data.status;
    this.observations = data.observations;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.createdBy = data.createdBy;
  }

  // Domain methods
  isActive(): boolean {
    return this.status === STATUS.UCP.ACTIVE;
  }

  isEmpty(): boolean {
    return this.status === STATUS.UCP.EMPTY;
  }

  isArchived(): boolean {
    return this.status === STATUS.UCP.ARCHIVED;
  }

  canReceiveItems(): boolean {
    return this.isActive();
  }

  canBeMoved(): boolean {
    return this.isActive() || this.isEmpty();
  }

  canBeDismantled(): boolean {
    return this.isActive() || this.isEmpty();
  }

  hasPallet(): boolean {
    return !!this.palletId;
  }

  hasPosition(): boolean {
    return !!this.positionId;
  }

  isPositioned(): boolean {
    return this.hasPallet() && this.hasPosition();
  }

  // Factory methods
  static create(data: CreateUcpData & { createdBy: number }): Omit<UcpEntity, 'id' | 'createdAt' | 'updatedAt'> {
    return {
      code: data.code.toUpperCase().trim(),
      palletId: data.palletId,
      positionId: data.positionId,
      status: STATUS.UCP.ACTIVE,
      observations: data.observations?.trim(),
      createdBy: data.createdBy,
    };
  }

  static markAsEmpty(): Partial<UcpEntity> {
    return {
      status: STATUS.UCP.EMPTY,
    };
  }

  static archive(): Partial<UcpEntity> {
    return {
      status: STATUS.UCP.ARCHIVED,
    };
  }

  static reactivate(): Partial<UcpEntity> {
    return {
      status: STATUS.UCP.ACTIVE,
    };
  }

  static update(current: UcpEntity, updates: Partial<UcpEntity>): Partial<UcpEntity> {
    const updated: Partial<UcpEntity> = {};

    if (updates.code && updates.code !== current.code) {
      updated.code = updates.code.toUpperCase().trim();
    }

    if (updates.palletId !== undefined && updates.palletId !== current.palletId) {
      updated.palletId = updates.palletId;
    }

    if (updates.positionId !== undefined && updates.positionId !== current.positionId) {
      updated.positionId = updates.positionId;
    }

    if (updates.status && updates.status !== current.status) {
      updated.status = updates.status;
    }

    if (updates.observations !== undefined && updates.observations !== current.observations) {
      updated.observations = updates.observations?.trim();
    }

    return updated;
  }
}

export class UcpItem implements UcpItemEntity {
  public readonly id: number;
  public readonly ucpId: number;
  public readonly productId: number;
  public readonly quantity: number;
  public readonly lot?: string;
  public readonly expiryDate?: Date;
  public readonly internalCode?: string;
  public readonly packagingTypeId?: number;
  public readonly packagingQuantity?: number;
  public readonly addedBy: number;
  public readonly addedAt: Date;
  public readonly removedBy?: number;
  public readonly removedAt?: Date;
  public readonly removalReason?: string;
  public readonly isActive: boolean;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;
  public readonly createdBy?: number;

  constructor(data: UcpItemEntity) {
    this.id = data.id;
    this.ucpId = data.ucpId;
    this.productId = data.productId;
    this.quantity = data.quantity;
    this.lot = data.lot;
    this.expiryDate = data.expiryDate;
    this.internalCode = data.internalCode;
    this.packagingTypeId = data.packagingTypeId;
    this.packagingQuantity = data.packagingQuantity;
    this.addedBy = data.addedBy;
    this.addedAt = data.addedAt;
    this.removedBy = data.removedBy;
    this.removedAt = data.removedAt;
    this.removalReason = data.removalReason;
    this.isActive = data.isActive;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.createdBy = data.createdBy;
  }

  // Domain methods
  hasLot(): boolean {
    return !!this.lot;
  }

  hasExpiry(): boolean {
    return !!this.expiryDate;
  }

  isExpired(): boolean {
    if (!this.expiryDate) return false;
    return this.expiryDate < new Date();
  }

  isNearExpiry(daysThreshold: number = 30): boolean {
    if (!this.expiryDate) return false;
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + daysThreshold);
    return this.expiryDate <= threshold;
  }

  canBeTransferred(): boolean {
    return this.isActive && !this.isExpired();
  }

  canBePartiallyTransferred(): boolean {
    return this.canBeTransferred() && this.quantity > 1;
  }

  // Factory methods
  static create(data: CreateUcpItemData & { addedBy: number }): Omit<UcpItemEntity, 'id' | 'createdAt' | 'updatedAt' | 'removedBy' | 'removedAt' | 'removalReason' | 'isActive'> {
    return {
      ucpId: data.ucpId,
      productId: data.productId,
      quantity: data.quantity,
      lot: data.lot?.trim(),
      expiryDate: data.expiryDate,
      internalCode: data.internalCode?.trim(),
      packagingTypeId: data.packagingTypeId,
      packagingQuantity: data.packagingQuantity,
      addedBy: data.addedBy,
      addedAt: new Date(),
    };
  }

  static remove(current: UcpItemEntity, removedBy: number, reason: string): Partial<UcpItemEntity> {
    return {
      isActive: false,
      removedBy,
      removedAt: new Date(),
      removalReason: reason,
    };
  }

  static updateQuantity(current: UcpItemEntity, newQuantity: number): Partial<UcpItemEntity> {
    if (newQuantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }
    
    return {
      quantity: newQuantity,
    };
  }
}

export class UcpTransferService {
  static validateTransfer(request: TransferRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (request.sourceUcpId === request.targetUcpId) {
      errors.push('Source and target UCP cannot be the same');
    }

    if (request.quantity <= 0) {
      errors.push('Transfer quantity must be greater than 0');
    }

    if (!request.reason.trim()) {
      errors.push('Transfer reason is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  static calculateTransferType(currentQuantity: number, transferQuantity: number): TransferType {
    return transferQuantity >= currentQuantity ? TransferType.COMPLETE : TransferType.PARTIAL;
  }

  static createHistoryEntry(
    ucpId: number,
    action: UcpHistoryAction,
    description: string,
    performedBy: number,
    oldValue?: any,
    newValue?: any,
    itemId?: number
  ): {
    ucpId: number;
    action: string;
    description: string;
    oldValue?: any;
    newValue?: any;
    itemId?: number;
    performedBy: number;
  } {
    return {
      ucpId,
      action,
      description,
      oldValue,
      newValue,
      itemId,
      performedBy,
    };
  }
}