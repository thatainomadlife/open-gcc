/**
 * Shared utilities for MCP operation handlers.
 */

import { join } from 'node:path';

/**
 * Derive the .gcc/ root from the context root (.gcc/context/).
 */
export function getGCCRoot(contextRoot: string): string {
  return join(contextRoot, '..');
}
