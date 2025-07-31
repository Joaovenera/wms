/**
 * Repository Implementations Barrel Export
 * 
 * Centralizes all repository implementations for clean imports
 * and dependency injection throughout the application.
 */

// Repository Implementations
import { UserRepositoryImpl } from './user.repository.impl.js';
import { PalletRepositoryImpl } from './pallet.repository.impl.js';
import { ProductRepositoryImpl } from './product.repository.impl.js';
import { UcpRepositoryImpl } from './ucp.repository.impl.js';
import { UcpItemRepositoryImpl } from './ucp-item.repository.impl.js';

export { UserRepositoryImpl, PalletRepositoryImpl, ProductRepositoryImpl, UcpRepositoryImpl, UcpItemRepositoryImpl };

// Repository Instances (Singleton pattern for dependency injection)
const userRepositoryInstance = new UserRepositoryImpl();
const palletRepositoryInstance = new PalletRepositoryImpl(); 
const productRepositoryInstance = new ProductRepositoryImpl();
const ucpRepositoryInstance = new UcpRepositoryImpl();
const ucpItemRepositoryInstance = new UcpItemRepositoryImpl();

export { 
  userRepositoryInstance as userRepository, 
  palletRepositoryInstance as palletRepository, 
  productRepositoryInstance as productRepository, 
  ucpRepositoryInstance as ucpRepository, 
  ucpItemRepositoryInstance as ucpItemRepository 
};

/**
 * Repository container for easy injection
 */
export const repositories = {
  user: userRepositoryInstance,
  pallet: palletRepositoryInstance,
  product: productRepositoryInstance,
  ucp: ucpRepositoryInstance,
  ucpItem: ucpItemRepositoryInstance,
} as const;

export type RepositoryContainer = typeof repositories;