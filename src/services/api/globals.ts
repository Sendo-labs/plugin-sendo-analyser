import type { HeliusService } from './helius.js';
import type { BirdeyeService } from './birdeyes.js';

/**
 * Global Helius service instance
 * This is set by the SendoAnalyserService at initialization
 */
let heliusServiceInstance: HeliusService | null = null;

/**
 * Global Birdeye service instance
 * This is set by the SendoAnalyserService at initialization
 */
let birdeyeServiceInstance: BirdeyeService | null = null;

/**
 * Set the global Helius service instance
 */
export function setGlobalHeliusService(service: HeliusService): void {
  heliusServiceInstance = service;
}

/**
 * Get the global Helius service instance
 * Throws an error if not initialized
 */
export function getGlobalHeliusService(): HeliusService {
  if (!heliusServiceInstance) {
    throw new Error('Helius service not initialized. Make sure SendoAnalyserService has been started.');
  }
  return heliusServiceInstance;
}

/**
 * Set the global Birdeye service instance
 */
export function setGlobalBirdeyeService(service: BirdeyeService): void {
  birdeyeServiceInstance = service;
}

/**
 * Get the global Birdeye service instance
 * Throws an error if not initialized
 */
export function getGlobalBirdeyeService(): BirdeyeService {
  if (!birdeyeServiceInstance) {
    throw new Error('Birdeye service not initialized. Make sure SendoAnalyserService has been started.');
  }
  return birdeyeServiceInstance;
}
