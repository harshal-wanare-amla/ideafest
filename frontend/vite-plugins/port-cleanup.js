/**
 * Vite Plugin: Port Cleanup
 * Automatically kills processes using the dev server port before starting
 */

import { killProcessOnPort, waitForPortAvailable } from './port-manager.js';

export function portCleanupPlugin(port = 5173) {
  return {
    name: 'port-cleanup',
    apply: 'serve',
    async config() {
      console.log(`\n🔧 Pre-flight: Cleaning up port ${port}...`);
      try {
        await killProcessOnPort(port);
        await waitForPortAvailable(port);
        console.log(`✅ Port ${port} ready\n`);
      } catch (error) {
        console.error(`\n⚠️  Could not clean port ${port}: ${error.message}\n`);
        // Don't stop, let Vite try anyway
      }
    },
  };
}
