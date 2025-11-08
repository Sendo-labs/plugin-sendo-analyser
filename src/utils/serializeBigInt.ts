/**
 * BigInt Serialization Utility
 *
 * Converts BigInt values to strings for JSON serialization.
 * This is necessary because JSON.stringify() cannot handle BigInt values.
 *
 * Usage:
 * ```typescript
 * const data = { amount: 1000000000n, nested: { value: 500n } };
 * const serialized = serializeBigInt(data);
 * await db.insert(table).values({ jsonData: serialized });
 * ```
 */

/**
 * Recursively convert all BigInt values to strings in an object/array
 * @param obj - The object to serialize
 * @returns A new object with all BigInt values converted to strings
 */
export function serializeBigInt(obj: any): any {
  // Handle null/undefined
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle BigInt
  if (typeof obj === 'bigint') {
    return obj.toString();
  }

  // Handle Arrays
  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt);
  }

  // Handle Objects
  if (typeof obj === 'object') {
    const result: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = serializeBigInt(obj[key]);
      }
    }
    return result;
  }

  // Return primitives as-is
  return obj;
}