/**
 * Repository Implementations Barrel Export
 * 
 * Centralizes all repository implementations for clean imports
 * and dependency injection throughout the application.
 */

// Repository Implementations
export { UserRepositoryImpl } from './user.repository.impl.js';
export { PalletRepositoryImpl } from './pallet.repository.impl.js';
export { ProductRepositoryImpl } from './product.repository.impl.js';
export { UcpRepositoryImpl } from './ucp.repository.impl.js';
export { UcpItemRepositoryImpl } from './ucp-item.repository.impl.js';

// Repository Instances (Singleton pattern for dependency injection)
export const userRepository = new UserRepositoryImpl();
export const palletRepository = new PalletRepositoryImpl();
export const productRepository = new ProductRepositoryImpl();
export const ucpRepository = new UcpRepositoryImpl();
export const ucpItemRepository = new UcpItemRepositoryImpl();

/**
 * Repository container for easy injection
 */
export const repositories = {
  user: userRepository,
  pallet: palletRepository,
  product: productRepository,
  ucp: ucpRepository,
  ucpItem: ucpItemRepository,
} as const;

export type RepositoryContainer = typeof repositories;