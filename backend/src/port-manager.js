import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import net from 'net';

const execAsync = promisify(exec);

/**
 * Check if a port is in use by attempting to connect
 * More reliable than netstat parsing
 */
function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    
    server.listen(port, 'localhost');
  });
}

/**
 * Kill process using a specific port (cross-platform)
 * @param {number} port - Port number to free
 * @returns {Promise<boolean>} - True if process was killed, false if port was already free
 */
export async function killProcessOnPort(port) {
  const isWindows = os.platform() === 'win32';
  
  try {
    // First check if port is actually in use
    const inUse = await isPortInUse(port);
    if (!inUse) {
      console.log(`✓ Port ${port} is not in use`);
      return false;
    }
    
    if (isWindows) {
      // Windows: Use PowerShell to find and kill ALL processes on this port (IPv4 and IPv6)
      try {
        // Get all connections on this port (both IPv4 and IPv6)
        const { stdout } = await execAsync(
          `powershell -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess"`,
          { shell: true, timeout: 5000 }
        );
        
        const pids = stdout
          .trim()
          .split('\n')
          .map(p => p.trim())
          .filter(p => p && /^\d+$/.test(p));
        
        if (pids.length > 0) {
          console.log(`🔍 Found ${pids.length} process(es) on port ${port}. Terminating...`);
          for (const pid of pids) {
            try {
              await execAsync(`taskkill /PID ${pid} /F`, { shell: true, timeout: 5000 });
              console.log(`✅ Killed process ${pid}`);
            } catch (err) {
              // Process might already be dead
            }
          }
          return true;
        }
      } catch (error) {
        console.log(`⚠️  Could not kill process on port ${port}: ${error.message}`);
      }
    } else {
      // Unix/Linux/Mac: Use lsof and kill
      try {
        const { stdout } = await execAsync(`lsof -ti:${port}`, { timeout: 5000 });
        if (stdout.trim()) {
          const pids = stdout.trim().split('\n').filter(p => p);
          if (pids.length > 0) {
            console.log(`🔍 Found ${pids.length} process(es) on port ${port}. Terminating...`);
            for (const pid of pids) {
              console.log(`Killing process ${pid}...`);
              await execAsync(`kill -9 ${pid}`, { timeout: 5000 });
            }
            console.log(`✅ Killed process(es) on port ${port}`);
            return true;
          }
        }
      } catch (error) {
        console.log(`⚠️  Could not kill process on port ${port}`);
      }
    }
    
    return false;
  } catch (error) {
    console.log(`⚠️  Error checking port ${port}: ${error.message}`);
    return false;
  }
}

/**
 * Wait for port to become available
 * @param {number} port - Port to check
 * @param {number} maxRetries - Maximum retry attempts
 * @param {number} delay - Initial delay between retries in ms
 */
export async function waitForPortAvailable(port, maxRetries = 15, delay = 200) {
  let lastError = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const inUse = await isPortInUse(port);
      if (!inUse) {
        console.log(`✓ Port ${port} is now available`);
        return true;
      }
      
      if (i < maxRetries - 1) {
        const waitTime = delay * Math.pow(1.3, i); // Exponential backoff
        console.log(`⏳ Waiting for port ${port}... (${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        const waitTime = delay * Math.pow(1.3, i);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  throw new Error(`Port ${port} did not become available after ${maxRetries} attempts${lastError ? ': ' + lastError.message : ''}`);
}
