// Authentication and Users
export * from './auth.schema';

// Pallets and Structures
export * from './pallets.schema';

// Positions
export * from './positions.schema';

// Products and Photos
export * from './products.schema';

// UCPs and Operations
export * from './ucps.schema';

// Transfers and Vehicles
export * from './transfers.schema';

// Combined schema object for Drizzle
import { sessions, users, usersRelations } from './auth.schema';
import { 
  pallets, 
  palletStructures, 
  palletsRelations, 
  palletStructuresRelations 
} from './pallets.schema';
import { positions, positionsRelations } from './positions.schema';
import { 
  products, 
  productPhotos, 
  productPhotoHistory, 
  packagingTypes, 
  packagingConversionRules,
  productsRelations,
  productPhotosRelations,
  productPhotoHistoryRelations,
  packagingTypesRelations,
  packagingConversionRulesRelations
} from './products.schema';
import { 
  ucps, 
  ucpItems, 
  ucpHistory, 
  itemTransfers, 
  movements,
  ucpsRelations,
  ucpItemsRelations,
  ucpHistoryRelations,
  itemTransfersRelations,
  movementsRelations
} from './ucps.schema';
import { 
  vehicles, 
  transferRequests, 
  transferRequestItems, 
  loadingExecutions, 
  loadingItems, 
  transferReports,
  vehiclesRelations,
  transferRequestsRelations,
  transferRequestItemsRelations,
  loadingExecutionsRelations,
  loadingItemsRelations,
  transferReportsRelations
} from './transfers.schema';

// Export all tables and relations for Drizzle
export const schema = {
  // Tables
  sessions,
  users,
  pallets,
  palletStructures,
  positions,
  products,
  productPhotos,
  productPhotoHistory,
  packagingTypes,
  packagingConversionRules,
  ucps,
  ucpItems,
  ucpHistory,
  itemTransfers,
  movements,
  vehicles,
  transferRequests,
  transferRequestItems,
  loadingExecutions,
  loadingItems,
  transferReports,
  
  // Relations
  usersRelations,
  palletsRelations,
  palletStructuresRelations,
  positionsRelations,
  productsRelations,
  productPhotosRelations,
  productPhotoHistoryRelations,
  packagingTypesRelations,
  packagingConversionRulesRelations,
  ucpsRelations,
  ucpItemsRelations,
  ucpHistoryRelations,
  itemTransfersRelations,
  movementsRelations,
  vehiclesRelations,
  transferRequestsRelations,
  transferRequestItemsRelations,
  loadingExecutionsRelations,
  loadingItemsRelations,
  transferReportsRelations,
};

export default schema;