import React, { useState, useEffect } from 'react';
import Terminal from './Terminal';
import ProjectDetails from './ProjectDetails';
import PortConflictDialog from './PortConflictDialog';

function ServiceControl({ project, onStart, onStop }) {
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState('');
  const [processId, setProcessId] = useState(null);
  const [serviceDetails, setServiceDetails] = useState({
    status: 'stopped',
    pid: null,
    startTime: null,
    memory: 0,
    cpu: 0,
    ports: []
  });
  const [portConflictDialogOpen, setPortConflictDialogOpen] = useState(false);
  const [portConflicts, setPortConflicts] = useState([]);

  // Reset service details when project changes
  useEffect(() => {
    setServiceDetails({
      status: 'stopped',
      pid: null,
      startTime: null,
      memory: 0,
      cpu: 0,
      ports: []
    });
    setIsRunning(false);
    setProcessId(null);
  }, [project.id]);

  // Handle process status updates
  useEffect(() => {
    const handleProcessStatus = (data) => {
      console.log('Process status update:', data);
      if (!data || data.processId !== processId) return;

      setServiceDetails(prev => ({
        ...prev,
        status: data.status,
        pid: data.processId,
        memory: data.memory,
        cpu: data.cpu,
        ports: data.ports,
        startTime: data.startTime || prev.startTime
      }));

      if (data.status === 'stopped' || data.status === 'error') {
        setIsRunning(false);
        setProcessId(null);
      } else if (data.status === 'running' || data.status === 'starting') {
        setIsRunning(true);
      }
    };

    const cleanup = window.electron.on('process-status', handleProcessStatus);
    return () => cleanup();
  }, [processId]);

  // Handle service output
  useEffect(() => {
    const handleServiceOutput = (data) => {
      if (!data || !data.data) return;
      
      const timestamp = new Date(data.timestamp).toLocaleTimeString();
      let outputLine = `[${timestamp}] ${data.data}`;
      
      if (!outputLine.endsWith('\n')) {
        outputLine += '\n';
      }

      setOutput(prev => prev + outputLine);
    };

    const cleanup = window.electron.on('service-output', handleServiceOutput);
    return () => cleanup();
  }, []);

  // Handle service stopped event
  useEffect(() => {
    const handleServiceStopped = ({ processId: stoppedPid }) => {
      console.log('Service stopped:', stoppedPid);
      if (stoppedPid === processId) {
        setIsRunning(false);
        setProcessId(null);
        setServiceDetails(prev => ({
          ...prev,
          status: 'stopped',
          pid: null,
          memory: 0,
          cpu: 0,
          ports: []
        }));
      }
    };

    const cleanup = window.electron.on('service-stopped', handleServiceStopped);
    return () => cleanup();
  }, [processId]);

  useEffect(() => {
    const handlePortConflict = (conflicts) => {
      console.log('Port conflict event received:', conflicts);
      if (conflicts && Array.isArray(conflicts) && conflicts.length > 0) {
        const conflictMessage = conflicts.map(c => 
          `Port ${c.port} is in use by ${c.name} (PID: ${c.pid})`
        ).join('\n');
        
        console.log('Setting port conflicts:', conflicts);
        setOutput(prev => prev + '\nPort conflicts detected:\n' + conflictMessage);
        setPortConflicts(conflicts);
        setPortConflictDialogOpen(true);
        
        setServiceDetails(prev => ({
          ...prev,
          status: 'error',
          details: 'Port conflicts detected'
        }));
      } else {
        console.log('No valid conflicts received:', conflicts);
      }
    };

    console.log('Setting up port conflict listener');
    const unsubscribe = window.electron.on('port-conflict', handlePortConflict);
    return () => {
      console.log('Removing port conflict listener');
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    const matches = output.match(urlPattern) || [];
    
    // Filter unique valid URLs and create link objects
    const uniqueLinks = Array.from(new Set(matches))
      .filter(url => {
        try {
          new URL(url);
          return true;
        } catch {
          return false;
        }
      })
      .map(url => ({
        url: url.replace(/['")}]+$/, ''), // Clean up any trailing characters
        name: url.includes('localhost') ? 'Local App' : 'External Link'
      }));

    setServiceDetails(prev => ({
      ...prev,
      links: uniqueLinks
    }));
  }, [output]);

  const loadActivePorts = async () => {
    try {
      const ports = await window.electron.invoke('get-active-ports');
      setServiceDetails(prev => ({
        ...prev,
        activePorts: ports
      }));
    } catch (error) {
      setOutput(prev => prev + `\nError loading active ports: ${error.message}\n`);
    }
  };

  const getStatusDetails = (status, details) => {
    switch (status) {
      case 'Starting':
        return `Starting service with command: ${details.command || 'N/A'}`;
      case 'Running':
        return `Service running with PID ${details.pid || 'N/A'} since ${new Date(details.startTime).toLocaleTimeString()}`;
      case 'Stopping':
        return 'Stopping service...';
      case 'Stopped':
        return `Service stopped at ${new Date(details.endTime).toLocaleTimeString()} with code ${details.exitCode || 'N/A'}`;
      case 'Error':
        return `Error: ${details.error || 'Unknown error'}`;
      default:
        return 'Service not running';
    }
  };

  const handlePortOverride = (e) => {
    const port = parseInt(e.target.value);
    if (!isNaN(port) && port > 0 && port <= 65535) {
      setServiceDetails(prev => ({
        ...prev,
        portOverride: port
      }));
    }
  };

  const handleManualPort = (e) => {
    const port = parseInt(e.target.value);
    if (!isNaN(port) && port > 0 && port <= 65535) {
      setServiceDetails(prev => ({
        ...prev,
        manualPort: port
      }));
    }
  };

  const toggleAutoResolve = () => {
    setServiceDetails(prev => ({
      ...prev,
      autoResolvePorts: !prev.autoResolvePorts
    }));
  };

  const handleKillPort = async (port, pid) => {
    try {
      const result = await killProcess(port, pid);
      if (result.success) {
        setOutput(prev => prev + `\nKilled process ${pid} using port ${port}\n`);
        
        // Update port details
        setPortDetails(prev => ({
          ...prev,
          [port]: prev[port].filter(p => p.pid !== pid)
        }));
        
        // If no more processes on this port, remove from conflicts
        if (!portDetails[port]?.length) {
          setServiceDetails(prev => ({
            ...prev,
            portConflicts: prev.portConflicts.filter(p => p !== port)
          }));
        }
        
        await loadActivePorts();
      } else {
        throw new Error(result.error || 'Failed to kill process');
      }
    } catch (error) {
      setOutput(prev => prev + `\nError killing process ${pid} on port ${port}: ${error.message}\n`);
    }
  };

  const handleStart = async () => {
    try {
      console.log('Starting service...');
      setOutput('');
      setServiceDetails(prev => ({
        ...prev,
        status: 'starting'
      }));

      const result = await window.electron.invoke('start-service', {
        command: project.start_command,
        workingDirectory: project.working_directory
      });

      console.log('Start service result:', result);

      if (result.error) {
        if (result.error === 'PORT_CONFLICT') {
          console.log('Port conflicts detected:', result.conflicts);
          setServiceDetails(prev => ({
            ...prev,
            status: 'error',
            details: 'Port conflicts detected'
          }));
          return;
        }
        setOutput(`Error: ${result.error}\n`);
        setServiceDetails(prev => ({
          ...prev,
          status: 'error',
          details: result.error
        }));
        return;
      }

      console.log('Service started with PID:', result.processId);
      setProcessId(result.processId);
      setIsRunning(true);
      setServiceDetails(prev => ({
        ...prev,
        status: 'starting',
        pid: result.processId,
        startTime: Date.now()
      }));

      if (onStart) {
        onStart(result.processId);
      }
    } catch (error) {
      console.error('Error starting service:', error);
      setOutput(`Error: ${error.message}\n`);
      setServiceDetails(prev => ({
        ...prev,
        status: 'error',
        details: error.message
      }));
    }
  };

  const handlePortConflictResolution = async () => {
    setPortConflictDialogOpen(false);
    
    if (!portConflicts || portConflicts.length === 0) {
      return;
    }

    try {
      setOutput(prev => prev + '\nKilling conflicting processes...\n');
      
      // Kill each conflicting process
      for (const conflict of portConflicts) {
        try {
          await window.electron.invoke('kill-port-processes', { 
            pid: conflict.pid,
            port: conflict.port 
          });
          setOutput(prev => prev + `Successfully killed process: ${conflict.name} (PID: ${conflict.pid})\n`);
        } catch (error) {
          setOutput(prev => prev + `Failed to kill process: ${conflict.name} (PID: ${conflict.pid}) - ${error.message}\n`);
        }
      }

      // Clear conflicts
      setPortConflicts([]);
      
      // Try starting the service again
      await handleStart();
    } catch (error) {
      console.error('Error resolving port conflicts:', error);
      setOutput(prev => prev + `Error resolving port conflicts: ${error.message}\n`);
    }
  };

  const handleResolveConflicts = async (conflicts) => {
    console.log('Resolving conflicts:', conflicts);
    if (!Array.isArray(conflicts) || conflicts.length === 0) {
      console.log('No conflicts to resolve');
      setPortConflictDialogOpen(false);
      return;
    }

    try {
      setOutput(prev => prev + '\nKilling conflicting processes...\n');
      
      // Track which PIDs we've already killed
      const killedPids = new Set();
      
      // Kill each conflicting process
      for (const conflict of conflicts) {
        console.log('Processing conflict:', conflict);
        
        // Skip if we've already killed this PID
        if (killedPids.has(conflict.pid)) {
          console.log(`Already killed PID ${conflict.pid}, skipping`);
          continue;
        }

        try {
          const result = await window.electron.invoke('kill-port-processes', { 
            pid: conflict.pid,
            port: conflict.port 
          });
          console.log('Kill result:', result);
          
          if (result.success) {
            setOutput(prev => prev + `Successfully killed process: ${conflict.name} (PID: ${conflict.pid})\n`);
            killedPids.add(conflict.pid);
          } else {
            setOutput(prev => prev + `Failed to kill process: ${conflict.name} (PID: ${conflict.pid}) - ${result.error}\n`);
            return;
          }
        } catch (error) {
          console.error('Error killing process:', error);
          setOutput(prev => prev + `Failed to kill process: ${conflict.name} (PID: ${conflict.pid}) - ${error.message}\n`);
          return;
        }
      }

      // Clear conflicts and close dialog
      console.log('All processes killed, clearing conflicts');
      setPortConflicts([]);
      setPortConflictDialogOpen(false);
      
      // Wait a moment for ports to be fully released
      console.log('Waiting before restart...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Start the service
      console.log('Starting service after resolving conflicts');
      const result = await window.electron.invoke('start-service', {
        command: project.start_command,
        workingDirectory: project.working_directory
      });

      console.log('Start service result after conflicts:', result);
      if (result.error) {
        setOutput(prev => prev + `\nError starting service: ${result.error}\n`);
        return;
      }

      // Update state with new process
      setProcessId(result.processId);
      setIsRunning(true);
      setServiceDetails(prev => ({
        ...prev,
        status: 'starting',
        pid: result.processId,
        startTime: Date.now()
      }));

    } catch (error) {
      console.error('Error resolving port conflicts:', error);
      setOutput(prev => prev + `\nError resolving port conflicts: ${error.message}\n`);
    }
  };

  const handleChangePort = async (newPort) => {
    try {
      // Update all conflicting ports in the project's configuration
      const updatedProject = {
        ...project,
        ports: project.ports || {},
      };

      // Map each conflicting port to the new port range
      portConflicts.forEach((conflict, index) => {
        updatedProject.ports[conflict.port] = parseInt(newPort) + index;
      });

      await window.electron.invoke('update-project', updatedProject);
      setPortConflicts([]);
      setPortConflictDialogOpen(false);
      // Retry starting the service with the new ports
      handleStart();
    } catch (error) {
      console.error('Failed to change ports:', error);
      setOutput(prev => prev + '\nFailed to change ports: ' + error.message + '\n');
    }
  };

  const handleStop = async () => {
    try {
      if (!processId) return;

      console.log('Stopping service with PID:', processId);
      setServiceDetails(prev => ({
        ...prev,
        status: 'stopping'
      }));

      const result = await window.electron.invoke('stop-service', { pid: processId });
      console.log('Stop service result:', result);

      if (result.error) {
        console.error('Error stopping service:', result.error);
        setOutput(prev => prev + `\nError stopping service: ${result.error}`);
        return;
      }

      setIsRunning(false);
      setProcessId(null);
      setServiceDetails(prev => ({
        ...prev,
        status: 'stopped',
        pid: null,
        memory: 0,
        cpu: 0,
        ports: []
      }));

      if (onStop) {
        onStop();
      }
    } catch (error) {
      console.error('Error stopping service:', error);
      setOutput(prev => prev + `\nError stopping service: ${error.message}`);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Project Details */}
      <ProjectDetails project={project} serviceDetails={serviceDetails} />

      {/* Controls */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <button
              onClick={handleStart}
              disabled={isRunning}
              className={`px-4 py-2 rounded-md ${
                isRunning
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              Start
            </button>
            <button
              onClick={handleStop}
              disabled={!isRunning}
              className={`px-4 py-2 rounded-md ${
                !isRunning
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              Stop
            </button>
          </div>
        </div>
      </div>

      {/* Terminal Output */}
      <div className="flex-1 overflow-hidden">
        <Terminal output={output} />
      </div>

      {/* Port Conflict Dialog */}
      <PortConflictDialog
        isOpen={portConflictDialogOpen}
        onClose={() => setPortConflictDialogOpen(false)}
        conflicts={portConflicts}
        onResolveConflicts={handleResolveConflicts}
        onChangePort={handleChangePort}
        onPortConflictResolution={handlePortConflictResolution}
      />
    </div>
  );
}

export default ServiceControl;