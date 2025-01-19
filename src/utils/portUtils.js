const { exec } = require('child_process');
const os = require('os');
const util = require('util');
const execPromise = util.promisify(exec);

async function findProcessesUsingPort(port) {
  if (!port || isNaN(parseInt(port))) {
    console.log(`Invalid port specified: ${port}`);
    return [];
  }

  try {
    const command = os.platform() === 'win32'
      ? `netstat -ano | findstr :${port}`
      : `lsof -i :${port} -t`;

    const { stdout } = await execPromise(command);
    const lines = stdout.split('\n').filter(Boolean);
    
    // For Windows, get unique PIDs from the last column
    if (os.platform() === 'win32') {
      const pids = new Set();
      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && !isNaN(parseInt(pid))) {
          pids.add(pid);
        }
      });
      return Array.from(pids);
    }
    
    // For Unix, lsof returns just PIDs
    return lines.map(line => line.trim());
  } catch (error) {
    // Exit code 1 means no processes found for that port
    if (error.code === 1) {
      return [];
    }
    console.error(`Error finding processes for port ${port}:`, error);
    return [];
  }
}

async function getPortProcessInfo(port) {
  try {
    let command;
    if (process.platform === 'win32') {
      command = `netstat -ano | findstr :${port}`;
      const { stdout } = await execPromise(command);
      
      const lines = stdout.split('\n').filter(line => line.includes(`:${port}`));
      const uniquePids = new Set();
      const results = [];
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        
        if (pid && !isNaN(parseInt(pid)) && !uniquePids.has(pid)) {
          uniquePids.add(pid);
          try {
            const processName = await getProcessName(pid);
            if (processName) {
              results.push({ pid: parseInt(pid), name: processName });
            }
          } catch (err) {
            console.log(`Process ${pid} no longer exists`);
          }
        }
      }
      
      return results.length > 0 ? results[0] : null;
    } else {
      command = `lsof -i :${port} -F pn`;
      const { stdout } = await execPromise(command);
      
      const lines = stdout.split('\n').filter(Boolean);
      if (lines.length >= 2) {
        const pid = lines[0].slice(1); // Remove 'p' prefix
        const name = lines[1].slice(1); // Remove 'n' prefix
        return { pid: parseInt(pid), name };
      }
      return null;
    }
  } catch (error) {
    // Exit code 1 means no processes found for that port
    if (error.code === 1) {
      return null;
    }
    console.error(`Error getting port ${port} process info:`, error);
    return null;
  }
}

async function getProcessName(pid) {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execPromise(`tasklist /FI "PID eq ${pid}" /FO LIST`);
      return stdout.match(/Image Name:\s+(.+)/)?.[1] || 'Unknown';
    } else {
      const { stdout } = await execPromise(`ps -p ${pid} -o comm=`);
      return stdout.trim();
    }
  } catch (error) {
    console.error(`Error getting process name for PID ${pid}:`, error);
    return 'Unknown';
  }
}

async function killPort(port) {
  try {
    const processInfo = await getPortProcessInfo(port);
    if (!processInfo) {
      console.log(`No process found using port ${port}`);
      return true; // Port is already free
    }

    const { pid, name } = processInfo;
    
    // Don't kill critical system processes
    if (CRITICAL_PROCESSES.some(proc => name.toLowerCase().includes(proc.toLowerCase()))) {
      throw new Error(`Cannot kill critical system process: ${name}`);
    }

    if (process.platform === 'win32') {
      await execPromise(`taskkill /F /PID ${pid}`);
    } else {
      await execPromise(`kill -9 ${pid}`);
    }

    console.log(`Successfully killed process: ${name} (PID: ${pid})`);
    return true;
  } catch (error) {
    // If the process is already gone, consider it a success
    if (error.code === 1 && error.stderr.includes('not found')) {
      return true;
    }
    console.error(`Failed to kill processes on port ${port}:`, error);
    return false;
  }
}

async function killProcess(port, pid) {
  try {
    // Validate PID
    if (!pid || isNaN(pid) || pid < 0) {
      throw new Error('Invalid process ID');
    }

    // Get process details before killing
    let processName = '';
    try {
      if (process.platform === 'win32') {
        const { stdout } = await execPromise(`tasklist /FI "PID eq ${pid}" /FO LIST`);
        processName = stdout.match(/Image Name:\s+(.+)/)?.[1] || 'Unknown';
      } else {
        const { stdout } = await execPromise(`ps -p ${pid} -o comm=`);
        processName = stdout.trim();
      }
    } catch (error) {
      console.error(`Error getting process name for PID ${pid}:`, error);
      processName = 'Unknown';
    }

    // Check if process is critical
    if (CRITICAL_PROCESSES.includes(processName.toLowerCase())) {
      throw new Error(`Cannot kill critical system process: ${processName}`);
    }

    // Kill the process
    const command = process.platform === 'win32'
      ? `taskkill /F /PID ${pid}`
      : `kill -9 ${pid}`;

    await execPromise(command);
    
    // Verify process was killed
    try {
      if (process.platform === 'win32') {
        await execPromise(`tasklist /FI "PID eq ${pid}" /NH`);
        throw new Error('Process still running after kill attempt');
      } else {
        await execPromise(`ps -p ${pid}`);
        throw new Error('Process still running after kill attempt');
      }
    } catch (error) {
      if (error.message.includes('Process still running')) {
        throw error;
      }
      // Process is gone, which is what we want
    }

    return {
      success: true,
      port,
      pid,
      processName,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      port,
      pid,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

const CRITICAL_PROCESSES = [
  'system', 'ntoskrnl.exe', 'wininit.exe', 'csrss.exe', 'smss.exe',
  'services.exe', 'lsass.exe', 'svchost.exe', 'explorer.exe'
];

async function getPortProcess(port) {
  try {
    const { stdout } = await execPromise(`netstat -ano | findstr :${port}`);
    const lines = stdout.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 5) {
        const pid = parseInt(parts[4]);
        if (!isNaN(pid) && pid > 0) {
          try {
            const { stdout: processInfo } = await execPromise(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`);
            const [name] = processInfo.trim().split(',').map(s => s.replace(/"/g, ''));
            if (name) {
              return { pid, name, port };
            }
          } catch (error) {
            console.error(`Error getting process info for PID ${pid}:`, error);
          }
        }
      }
    }
    return null;
  } catch (error) {
    console.error(`Error checking port ${port}:`, error);
    return null;
  }
}

async function isPortInUse(port) {
  try {
    const { stdout } = await execPromise(`netstat -ano | findstr :${port}`);
    return stdout.trim().length > 0;
  } catch (error) {
    // If command fails, port is likely not in use
    return false;
  }
}

async function checkPortConflicts(command, workingDirectory) {
  // Common development ports to check
  const portsToCheck = [3000, 3001, 3002, 3003, 3004, 3005, 8000, 8080];
  const conflicts = [];
  const seenPids = new Set();

  for (const port of portsToCheck) {
    const processInfo = await getPortProcess(port);
    if (processInfo && !seenPids.has(processInfo.pid)) {
      conflicts.push(processInfo);
      seenPids.add(processInfo.pid);
    }
  }

  return conflicts;
}

module.exports = {
  killPort,
  getPortProcessInfo,
  findProcessesUsingPort,
  killProcess,
  getPortProcess,
  isPortInUse,
  checkPortConflicts
};