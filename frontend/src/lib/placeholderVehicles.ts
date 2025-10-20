/**
 * Utilities for managing placeholder vehicles used in planning phases
 * These vehicles are placeholders used during plan creation and will be
 * replaced by real vehicles during execution
 */

import { apiRequest } from './queryClient';

// Cache for placeholder vehicle IDs to avoid repeated API calls
let placeholderVehicleCache: Record<string, number> = {};

export interface PlaceholderVehicle {
  id: number;
  code: string;
  name: string;
  type: string;
}

/**
 * Get the vehicle ID for a specific placeholder type
 */
export async function getPlaceholderVehicleId(type: 'container' | 'delivery' | 'withdrawal'): Promise<number> {
  const codeMap = {
    container: 'PLACEHOLDER-CONTAINER',
    delivery: 'PLACEHOLDER-DELIVERY',
    withdrawal: 'PLACEHOLDER-WITHDRAWAL'
  };

  const code = codeMap[type];
  
  // Return cached ID if available
  if (placeholderVehicleCache[code]) {
    return placeholderVehicleCache[code];
  }

  // Fetch all vehicles and find the placeholder
  try {
    const response = await apiRequest('GET', '/api/vehicles');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch vehicles: ${response.status}`);
    }

    const vehicles = await response.json();
    const placeholder = vehicles.find((vehicle: any) => vehicle.code === code);

    if (!placeholder) {
      throw new Error(`Placeholder vehicle not found: ${code}`);
    }

    // Cache the ID for future use
    placeholderVehicleCache[code] = placeholder.id;
    
    return placeholder.id;
  } catch (error) {
    console.error(`Error fetching placeholder vehicle ${code}:`, error);
    throw error;
  }
}

/**
 * Get all placeholder vehicle information
 */
export async function getAllPlaceholderVehicles(): Promise<PlaceholderVehicle[]> {
  try {
    const response = await apiRequest('GET', '/api/vehicles');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch vehicles: ${response.status}`);
    }

    const vehicles = await response.json();
    
    return vehicles
      .filter((vehicle: any) => vehicle.code.startsWith('PLACEHOLDER-'))
      .map((vehicle: any) => ({
        id: vehicle.id,
        code: vehicle.code,
        name: vehicle.name,
        type: vehicle.type
      }));
  } catch (error) {
    console.error('Error fetching placeholder vehicles:', error);
    throw error;
  }
}

/**
 * Check if a vehicle is a placeholder vehicle
 */
export function isPlaceholderVehicle(vehicleCode: string): boolean {
  return vehicleCode.startsWith('PLACEHOLDER-');
}

/**
 * Get placeholder vehicle type from code
 */
export function getPlaceholderType(vehicleCode: string): string | null {
  if (!isPlaceholderVehicle(vehicleCode)) {
    return null;
  }

  const typeMap = {
    'PLACEHOLDER-CONTAINER': 'container',
    'PLACEHOLDER-DELIVERY': 'delivery', 
    'PLACEHOLDER-WITHDRAWAL': 'withdrawal'
  };

  return typeMap[vehicleCode as keyof typeof typeMap] || null;
}

/**
 * Clear the placeholder vehicle cache (useful for testing or cache invalidation)
 */
export function clearPlaceholderVehicleCache(): void {
  placeholderVehicleCache = {};
}