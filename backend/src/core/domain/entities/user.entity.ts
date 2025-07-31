import { BaseEntity } from '../../shared/types/index.js';
import { UserRole } from '../../shared/enums/index.js';

export interface UserEntity extends BaseEntity {
  email: string;
  password: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
}

export interface CreateUserData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
}

export interface UpdateUserData {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
}

export interface UserProfile {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  fullName: string;
  initials: string;
  createdAt: Date;
}

export class User implements UserEntity {
  public readonly id: number;
  public readonly email: string;
  public readonly password: string;
  public readonly firstName: string | null;
  public readonly lastName: string | null;
  public readonly role: UserRole;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;
  public readonly createdBy?: number;

  constructor(data: UserEntity) {
    this.id = data.id;
    this.email = data.email;
    this.password = data.password;
    this.firstName = data.firstName;
    this.lastName = data.lastName;
    this.role = data.role;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.createdBy = data.createdBy;
  }

  // Domain methods
  get fullName(): string {
    if (this.firstName && this.lastName) {
      return `${this.firstName} ${this.lastName}`;
    }
    return this.firstName || this.lastName || this.email;
  }

  get initials(): string {
    if (this.firstName && this.lastName) {
      return `${this.firstName.charAt(0)}${this.lastName.charAt(0)}`.toUpperCase();
    }
    if (this.firstName) {
      return this.firstName.substring(0, 2).toUpperCase();
    }
    return this.email.substring(0, 2).toUpperCase();
  }

  isAdmin(): boolean {
    return this.role === UserRole.ADMIN;
  }

  isOperator(): boolean {
    return this.role === UserRole.OPERATOR;
  }

  canManageUsers(): boolean {
    return this.isAdmin();
  }

  canManageSystem(): boolean {
    return this.isAdmin();
  }

  toProfile(): UserProfile {
    return {
      id: this.id,
      email: this.email,
      firstName: this.firstName,
      lastName: this.lastName,
      role: this.role,
      fullName: this.fullName,
      initials: this.initials,
      createdAt: this.createdAt,
    };
  }

  // Factory methods
  static create(data: CreateUserData & { createdBy?: number }): Omit<UserEntity, 'id' | 'createdAt' | 'updatedAt'> {
    return {
      email: data.email.toLowerCase().trim(),
      password: data.password,
      firstName: data.firstName?.trim() || null,
      lastName: data.lastName?.trim() || null,
      role: data.role || UserRole.OPERATOR,
      createdBy: data.createdBy,
    };
  }

  static update(current: UserEntity, updates: UpdateUserData): Partial<UserEntity> {
    const updated: Partial<UserEntity> = {};

    if (updates.email && updates.email !== current.email) {
      updated.email = updates.email.toLowerCase().trim();
    }

    if (updates.password) {
      updated.password = updates.password;
    }

    if (updates.firstName !== undefined && updates.firstName !== current.firstName) {
      updated.firstName = updates.firstName?.trim();
    }

    if (updates.lastName !== undefined && updates.lastName !== current.lastName) {
      updated.lastName = updates.lastName?.trim();
    }

    if (updates.role && updates.role !== current.role) {
      updated.role = updates.role;
    }

    return updated;
  }
}