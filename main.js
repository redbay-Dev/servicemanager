const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { spawn, exec, execSync } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const fs = require('fs');
const path = require('path');
const os = require('os');
const { initializeDatabase, getProjects, saveProject, deleteProject, updateProject } = require('./src/db');
const { killPort, getActivePorts, getPortProcessInfo, CRITICAL_PROCESSES } = require('./src/utils/portUtils');

let mainWindow;
let db;

async function isAdmin() {
  if (process.platform === 'win32') {
    try {
      execSync('net session');
      return true;
    } catch (e) {
      return false;
    }
  }
  return process.getuid && process.getuid() === 0;
}

function showAdminPrompt() {
  dialog.showMessageBox({
    type: 'warning',
    title: 'Admin Rights Required',
    message: 'Some features require administrator privileges.',
    buttons: ['OK']
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: true
    }
  });

  // Set Content Security Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const csp = [
      "default-src 'self';",
      "script-src 'self'" + (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : "") + ";",
      "style-src 'self' 'unsafe-inline';",
      "img-src 'self' data:;",
      "font-src 'self';",
      "connect-src 'self';",
      "frame-src 'none';"
    ].join(' ');

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp]
      }
    });
  });

  const startUrl = `file://${path.join(__dirname, 'build/index.html')}`;

  console.log('Loading URL:', startUrl);
  mainWindow.loadURL(startUrl).catch(err => {
    console.error('Failed to load URL:', err);
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Track all running processes
const processes = new Map();

// Send process status updates to renderer
function sendProcessStatus(processId, status) {
  if (!mainWindow) return;
  
  mainWindow.webContents.send('process-status', {
    processId,
    status,
    timestamp: Date.now()
  });
}

// Monitor process resources
async function monitorProcess(processId) {
  try {
    console.log(`Monitoring process ${processId}...`);
    
    // Get process info using tasklist
    const { stdout: tasklistOutput } = await execAsync(
      `tasklist /FI "PID eq ${processId}" /FO CSV /NH`
    );

    const parts = tasklistOutput.split(',').map(p => p.replace(/"/g, '').trim());
    if (parts.length < 5) {
      throw new Error('Invalid tasklist output format');
    }

    // Parse memory - combine the split parts if necessary
    const memoryString = parts.slice(4).join(',');
    const memoryKB = parseInt(memoryString.replace(/[^0-9]/g, ''));
    const memoryMB = (memoryKB / 1024).toFixed(2);

    // Get process name for CPU monitoring
    const processName = parts[0];
    
    // Get CPU using typeperf
    const typeperfCmd = `typeperf "\\Process(${processName})\\% Processor Time" -sc 1`;
    let cpu = 0;
    
    try {
      const { stdout: cpuOutput } = await execAsync(typeperfCmd);
      const lines = cpuOutput.trim().split('\n');
      if (lines.length >= 2) {
        const values = lines[1].split(',');
        if (values.length >= 2) {
          const rawValue = values[1].replace(/"/g, '').trim();
          cpu = parseFloat(rawValue);
          cpu = Math.min(100, Math.max(0, cpu));
        }
      }
    } catch (error) {
      console.error('Error getting CPU:', error);
    }

    // Get ports using simpler netstat command
    const { stdout: netstatOutput } = await execAsync('netstat -ano -p TCP');
    const ports = [];
    const netstatLines = netstatOutput.split('\n');
    
    for (const line of netstatLines) {
      const parts = line.trim().split(/\s+/);
      // Check if this line has enough parts and matches our PID
      if (parts.length >= 5 && parts[4] === processId.toString()) {
        // Parse the local address part (e.g. "0.0.0.0:3000")
        const addrParts = parts[1].split(':');
        if (addrParts.length === 2) {
          const port = parseInt(addrParts[1]);
          if (!isNaN(port) && !ports.includes(port)) {
            ports.push(port);
          }
        }
      }
    }

    // Send status update
    const status = {
      processId,
      status: 'running',
      memory: parseFloat(memoryMB),
      cpu,
      ports,
      startTime: processes.get(processId)?.startTime || Date.now(),
      timestamp: Date.now()
    };

    mainWindow.webContents.send('process-status', status);

  } catch (error) {
    console.error('Error in monitorProcess:', error);
    if (error.message.includes('not found') || error.message.includes('Cannot find a process')) {
      processes.delete(processId);
      mainWindow.webContents.send('service-stopped', { processId });
    }
  }
}

// Start monitoring loop
let monitoringInterval;
function startMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
  }
  
  monitoringInterval = setInterval(() => {
    for (const [processId] of processes) {
      monitorProcess(processId).catch(error => {
        console.error('Error in monitoring loop:', error);
      });
    }
  }, 1000);
}

// Clean up on app quit
app.on('before-quit', () => {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
  }
});

startMonitoring();

// Database Handlers
ipcMain.handle('get-projects', async () => {
  try {
    const projects = await db.getProjects();
    console.log('Projects loaded:', projects);
    return projects;
  } catch (error) {
    console.error('Error loading projects:', error);
    throw error;
  }
});

ipcMain.handle('save-project', async (event, project) => {
  try {
    const savedProject = await db.saveProject(project);
    console.log('Project saved:', savedProject);
    return savedProject;
  } catch (error) {
    console.error('Error saving project:', error);
    throw error;
  }
});

ipcMain.handle('delete-project', async (event, id) => {
  try {
    await db.deleteProject(id);
    return true;
  } catch (error) {
    console.error('Error deleting project:', error);
    throw error;
  }
});

ipcMain.handle('update-project', async (event, project) => {
  try {
    // Update project in database
    return await db.updateProject(project);
  } catch (error) {
    console.error('Error updating project:', error);
    throw error;
  }
});

// Port Management Handlers
ipcMain.handle('get-active-ports', async () => {
  return await getActivePorts();
});

ipcMain.handle('get-port-process-info', async (event, { ports }) => {
  try {
    if (!Array.isArray(ports)) {
      throw new Error('Ports must be an array');
    }

    const conflicts = [];
    for (const port of ports) {
      try {
        const { stdout } = await execAsync(
          process.platform === 'win32'
            ? `netstat -ano | findstr ":${port}"`
            : `lsof -i :${port}`
        );

        if (stdout.trim()) {
          // Extract process information
          const processes = [];
          const lines = stdout.trim().split('\n');
          
          for (const line of lines) {
            if (process.platform === 'win32') {
              const parts = line.trim().split(/\s+/);
              const pid = parts[parts.length - 1];
              if (pid && !isNaN(parseInt(pid))) {
                try {
                  const { stdout: processInfo } = await execAsync(
                    `tasklist /FI "PID eq ${pid}" /FO CSV /NH`
                  );
                  const [name] = processInfo.split(',').map(p => p.replace(/"/g, '').trim());
                  processes.push({
                    pid: parseInt(pid),
                    command: name
                  });
                } catch (error) {
                  console.error(`Error getting process info for PID ${pid}:`, error);
                }
              }
            } else {
              const match = line.match(/(\S+)\s+(\d+)/);
              if (match) {
                processes.push({
                  pid: parseInt(match[2]),
                  command: match[1]
                });
              }
            }
          }

          if (processes.length > 0) {
            conflicts.push({
              port,
              processes: processes.filter((p, index, self) => 
                index === self.findIndex(t => t.pid === p.pid)
              )
            });
          }
        }
      } catch (error) {
        // Skip if no process is using this port
        continue;
      }
    }
    
    return conflicts;
  } catch (error) {
    console.error('Error getting port process info:', error);
    return [];
  }
});

ipcMain.handle('kill-ports', async (event, { ports }) => {
  try {
    if (!Array.isArray(ports)) {
      throw new Error('Ports must be an array');
    }

    const results = [];
    for (const port of ports) {
      try {
        if (process.platform === 'win32') {
          // First get the PIDs using the port
          const { stdout: netstat } = await execAsync(`netstat -ano | findstr :${port}`);
          const pids = new Set();
          
          netstat.split('\n').forEach(line => {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && !isNaN(parseInt(pid))) {
              pids.add(parseInt(pid));
            }
          });

          // Kill each PID
          for (const pid of pids) {
            try {
              // Get process name before killing
              const { stdout: processInfo } = await execAsync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`);
              const processName = processInfo.split(',')[0].replace(/"/g, '').trim();
              // Skip system processes
              const systemProcesses = ['System', 'Registry', 'smss.exe', 'csrss.exe', 'wininit.exe', 'services.exe', 'lsass.exe'];
              if (systemProcesses.includes(processName)) {
                console.log(`Skipping system process: ${processName} (PID: ${pid})`);
                continue;
              }

              // Kill the process
              await execAsync(`taskkill /F /PID ${pid}`);
              console.log(`Successfully killed process: ${processName} (PID: ${pid})`);
            } catch (killError) {
              console.error(`Error killing PID ${pid}:`, killError);
              throw killError;
            }
          }
          
          // Verify port is free
          try {
            const { stdout: checkPort } = await execAsync(`netstat -ano | findstr :${port}`);
            if (checkPort.trim()) {
              throw new Error(`Port ${port} is still in use`);
            }
          } catch (error) {
            // If findstr fails, it means no process is using the port (good)
            if (!error.message.includes('Port')) {
              results.push({ port, success: true });
              continue;
            }
            throw error;
          }
        } else {
          // Unix systems
          await execAsync(`lsof -ti :${port} | xargs kill -9`);
        }
        
        results.push({ port, success: true });
      } catch (error) {
        console.error(`Failed to kill processes on port ${port}:`, error);
        results.push({ 
          port, 
          success: false, 
          error: error.message 
        });
      }
    }

    const allSucceeded = results.every(r => r.success);
    const failedPorts = results.filter(r => !r.success).map(r => r.port);
    
    return {
      success: allSucceeded,
      results,
      message: allSucceeded 
        ? 'Successfully killed all processes' 
        : `Failed to kill processes on ports: ${failedPorts.join(', ')}`
    };
  } catch (error) {
    console.error('Error killing ports:', error);
    return {
      success: false,
      message: `Error: ${error.message}`
    };
  }
});

// Get port conflicts
async function getPortConflicts() {
  try {
    const { stdout } = await execAsync('netstat -ano');
    const lines = stdout.split('\n');
    const commonPorts = [3000, 3001, 3002, 3003, 3004, 3005, 8000, 8080];
    const conflicts = [];
    const seen = new Set();

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 5) {
        const localAddress = parts[1];
        if (localAddress.includes('[::]') || localAddress.includes('127.0.0.1') || localAddress.includes('0.0.0.0')) {
          const port = parseInt(localAddress.split(':').pop());
          const pid = parseInt(parts[4]);
          
          if (!isNaN(port) && !isNaN(pid) && commonPorts.includes(port)) {
            const key = `${port}-${pid}`;
            if (!seen.has(key)) {
              seen.add(key);
              try {
                const { stdout: processInfo } = await execAsync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`);
                const name = processInfo.split(',')[0].replace(/"/g, '').trim();
                conflicts.push({ pid, port, name });
              } catch (error) {
                console.error(`Error getting process info for PID ${pid}:`, error);
              }
            }
          }
        }
      }
    }
    
    return conflicts;
  } catch (error) {
    console.error('Error checking port conflicts:', error);
    return [];
  }
}

// Start service function
async function startService(event, { command, workingDirectory }) {
  try {
    if (!command) {
      throw new Error('No command specified');
    }

    // Check for port conflicts
    console.log('Checking for port conflicts...');
    const conflicts = await getPortConflicts();
    console.log('Port conflict check result:', conflicts);
    
    if (conflicts && conflicts.length > 0) {
      console.log('Port conflicts found:', conflicts);
      return { error: 'PORT_CONFLICT', conflicts };
    }

    console.log('Starting process...');
    const childProcess = spawn(command, {
      shell: true,
      cwd: workingDirectory,
      env: {
        ...process.env,
        FORCE_COLOR: true
      }
    });

    // Store process info
    const processInfo = {
      process: childProcess,
      startTime: Date.now(),
      status: 'running'
    };
    processes.set(childProcess.pid, processInfo);

    // Handle process output
    childProcess.stdout.on('data', (data) => {
      const output = data.toString();
      event.sender.send('service-output', {
        type: 'stdout',
        data: output,
        timestamp: Date.now()
      });
    });

    childProcess.stderr.on('data', (data) => {
      const output = data.toString();
      event.sender.send('service-output', {
        type: 'stderr',
        data: output,
        timestamp: Date.now()
      });
    });

    childProcess.on('error', (error) => {
      console.error('Process error:', error);
      event.sender.send('service-output', {
        type: 'error',
        data: `Process error: ${error.message}\n`,
        timestamp: Date.now()
      });
    });

    childProcess.on('exit', (code, signal) => {
      console.log(`Process ${childProcess.pid} exited with code ${code} and signal ${signal}`);
      processes.delete(childProcess.pid);
      event.sender.send('service-stopped', { processId: childProcess.pid });
    });

    return {
      processId: childProcess.pid
    };

  } catch (error) {
    console.error('Error starting service:', error);
    return { error: error.message };
  }
}

// IPC Handlers
ipcMain.handle('start-service', startService);

ipcMain.handle('kill-port-processes', async (event, { conflicts }) => {
  console.log('Killing port processes:', conflicts);
  try {
    // Get unique PIDs since one process might use multiple ports
    const uniquePids = [...new Set(conflicts.map(c => c.pid))];
    console.log('Unique PIDs to kill:', uniquePids);

    for (const pid of uniquePids) {
      try {
        await execAsync(`taskkill /F /PID ${pid}`);
        console.log(`Killed process ${pid}`);
      } catch (error) {
        // If process is already gone, that's fine
        if (error.message.includes('not found')) {
          console.log(`Process ${pid} already terminated`);
          continue;
        }
        console.error(`Failed to kill process ${pid}:`, error);
        throw error;
      }
    }

    // Wait a bit for processes to fully terminate
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify ports are free
    const remainingConflicts = await getPortConflicts();
    if (remainingConflicts.length > 0) {
      console.log('Some ports still in use:', remainingConflicts);
      return { success: false, error: 'Some ports are still in use' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error killing processes:', error);
    return { success: false, error: error.message };
  }
});

// Other IPC Handlers
ipcMain.handle('open-directory-dialog', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  return result.filePaths[0];
});

// Check if a port is in use
async function isPortInUse(port) {
  try {
    const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
    return stdout.trim().length > 0;
  } catch (error) {
    // If findstr fails, it means no process was found on that port
    if (error.code === 1) return false;
    throw error;
  }
}

// Get process using a port
async function getProcessOnPort(port) {
  try {
    const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
    const lines = stdout.trim().split('\n');
    if (lines.length === 0) return null;
    
    const pidMatch = lines[0].match(/\s+(\d+)\s*$/);
    if (!pidMatch) return null;
    
    const pid = parseInt(pidMatch[1]);
    if (!pid || pid === 0) return null;

    // Get process name
    const { stdout: processInfo } = await execAsync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`);
    const [processName] = processInfo.split(',');
    
    return {
      pid,
      port,
      name: processName.replace(/"/g, '')
    };
  } catch (error) {
    // If findstr fails, it means no process was found
    if (error.code === 1) return null;
    console.error('Error getting process on port:', error);
    return null;
  }
}

async function checkPortConflicts(ports) {
  if (!ports || !ports.length) return [];
  
  try {
    const { stdout } = await execAsync('netstat -ano');
    const lines = stdout.split('\n');
    const conflicts = [];
    
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 5) {
        const localAddress = parts[1];
        const pid = parseInt(parts[4]);
        if (!isNaN(pid)) {
          const port = parseInt(localAddress.split(':').pop());
          if (!isNaN(port) && ports.includes(port)) {
            try {
              const { stdout: processName } = await execAsync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`);
              const name = processName.split(',')[0].replace(/"/g, '').trim();
              conflicts.push({ pid, port, name });
            } catch (error) {
              console.error(`Error getting process name for PID ${pid}:`, error);
            }
          }
        }
      }
    }
    
    return conflicts;
  } catch (error) {
    console.error('Error checking port conflicts:', error);
    return [];
  }
}

// Add service-stopped event handler
ipcMain.handle('stop-service', async (event, { pid }) => {
  try {
    const processInfo = processes.get(pid);
    if (!processInfo) {
      return { error: 'Process not found' };
    }

    // Kill all child processes first
    for (const childPid of processInfo.children) {
      try {
        await execAsync(`taskkill /F /PID ${childPid}`);
      } catch (error) {
        console.error(`Error killing child process ${childPid}:`, error);
      }
    }

    // Kill the main process
    await execAsync(`taskkill /F /T /PID ${pid}`);
    processes.delete(pid);
    
    return { success: true };
  } catch (error) {
    console.error('Error stopping service:', error);
    return { error: error.message };
  }
});

// Other IPC Handlers
ipcMain.handle('get-process-details', async (event, { pid }) => {
  try {
    if (!pid || pid === 0) {
      throw new Error('Invalid PID');
    }

    // Check if process exists and get basic info
    const processInfo = processes.get(pid);
    if (!processInfo) {
      return { error: 'Process not found' };
    }

    // Check if process is still running
    try {
      const { stdout } = await execAsync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`);
      if (!stdout.includes(pid.toString())) {
        return { error: 'Process not found' };
      }
    } catch (error) {
      return { error: 'Process not found' };
    }

    // Get process stats using tasklist
    const { stdout: processStats } = await execAsync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`);
    const lines = processStats.trim().split('\n');
    let memory = 0;
    let cpu = 0;

    if (lines.length > 1) {
      const [_, values] = lines;
      const [workingSet, cpuTime] = values.split(',').map(v => parseInt(v));
      memory = Math.round(workingSet / (1024 * 1024) * 100) / 100; // Convert to MB
      cpu = cpuTime || 0;
    }

    // Get active ports
    const ports = [];
    try {
      const { stdout: netstat } = await execAsync(`netstat -ano | findstr ${pid}`);
      const portLines = netstat.split('\n').filter(line => line.trim());
      
      for (const line of portLines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 4) {
          const localAddress = parts[1];
          const port = parseInt(localAddress.split(':').pop());
          if (!isNaN(port) && !ports.includes(port)) {
            ports.push(port);
          }
        }
      }
    } catch (error) {
      console.error('Error getting ports:', error);
    }

    return {
      running: true,
      pid,
      memory,
      cpu,
      ports,
      startTime: processInfo.startTime,
      command: processInfo.command,
      workingDirectory: processInfo.workingDirectory,
      children: Array.from(processInfo.children)
    };
  } catch (error) {
    console.error('Error getting process details:', error);
    return { error: error.message };
  }
});

ipcMain.handle('check-port-conflicts', async (event, { ports }) => {
  try {
    const conflicts = [];
    
    for (const port of ports) {
      try {
        const { stdout } = await execAsync(
          process.platform === 'win32'
            ? `netstat -ano | findstr ":${port}"`
            : `lsof -i :${port} -t`
        );

        if (stdout.trim()) {
          const processes = await getPortProcessInfo(port);
          if (processes.length > 0) {
            conflicts.push({
              port,
              processes
            });
          }
        }
      } catch (error) {
        // No conflict if command fails (usually means no process using the port)
        continue;
      }
    }
    
    return conflicts;
  } catch (error) {
    console.error('Error checking port conflicts:', error);
    return [];
  }
});

async function getProcessName(pid) {
  try {
    const { stdout } = await execAsync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`);
    const match = stdout.match(/"([^"]+)"/);
    return match ? match[1] : 'Unknown';
  } catch (error) {
    console.error('Error getting process name:', error);
    return 'Unknown';
  }
}

async function checkProcessRunning(pid) {
  try {
    if (process.platform === 'win32') {
      // Use tasklist on Windows
      const { stdout } = await execAsync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`);
      const lines = stdout.trim().split('\n');
      let memory = 0;
      let cpu = 0;

      if (lines.length > 1) {
        const [_, values] = lines;
        const [workingSet, cpuTime] = values.split(',').map(v => parseInt(v));
        memory = Math.round(workingSet / (1024 * 1024) * 100) / 100; // Convert to MB
        cpu = cpuTime || 0;
      }

      return {
        memory,
        cpu
      };
    } else {
      // Use ps on Unix-like systems
      const { stdout } = await execAsync(`ps -p ${pid} -o %cpu,%mem`);
      const [cpu, mem] = stdout.trim().split('\n')[1].trim().split(/\s+/);
      return {
        cpu: parseFloat(cpu),
        memory: parseFloat(mem)
      };
    }
  } catch (error) {
    console.error('Error getting process stats:', error);
    return { cpu: 0, memory: 0 };
  }
}

app.on('ready', async () => {
  try {
    // Initialize database
    const dbPath = path.join(app.getPath('userData'), 'service-manager.db');
    db = await initializeDatabase(dbPath);
    
    await createWindow();
  } catch (error) {
    console.error('Failed to initialize:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});