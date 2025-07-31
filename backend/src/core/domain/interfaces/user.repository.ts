import { Repository, QueryFilters } from '../../shared/types/index.js';
import { UserEntity, CreateUserData, UpdateUserData, UserProfile } from '../entities/user.entity.js';

export interface UserRepository {
  // Authentication methods
  findByEmail(email: string): Promise<UserEntity | null>;
  
  // User management
  findById(id: number): Promise<UserEntity | null>;
  findAll(filters?: UserQueryFilters): Promise<UserEntity[]>;
  create(data: CreateUserData & { createdBy?: number }): Promise<UserEntity>;
  update(id: number, data: UpdateUserData): Promise<UserEntity | null>;
  delete(id: number): Promise<boolean>;
  
  // Profile methods
  getProfile(id: number): Promise<UserProfile | null>;
  updateProfile(id: number, data: Partial<UserProfile>): Promise<UserProfile | null>;
  
  // Password management
  updatePassword(id: number, hashedPassword: string): Promise<boolean>;
  
  // Role management
  updateRole(id: number, role: string): Promise<UserEntity | null>;
  findByRole(role: string): Promise<UserEntity[]>;
  
  // Utility methods
  existsByEmail(email: string): Promise<boolean>;
  count(filters?: UserQueryFilters): Promise<number>;
  
  // Bulk operations
  createMany(users: (CreateUserData & { createdBy?: number })[]): Promise<UserEntity[]>;
  updateMany(updates: { id: number; data: UpdateUserData }[]): Promise<UserEntity[]>;
  
  // Audit methods
  getCreatedUsers(createdBy: number): Promise<UserEntity[]>;
  getRecentlyCreated(days?: number): Promise<UserEntity[]>;
}

export interface UserQueryFilters extends QueryFilters {
  email?: string;
  role?: string;
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
  createdFrom?: Date;
  createdTo?: Date;
}