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
      console.log('Process status update received:', data);
      if (!data || data.processId !== processId) {
        console.log('Ignoring status update - process ID mismatch:', { 
          received: data?.processId, 
          current: processId,
          data
        });
        return;
      }

      console.log('Current service details:', serviceDetails);
      console.log('Updating service details with:', {
        status: data.status,
        pid: data.processId,
        memory: data.memory,
        cpu: data.cpu,
        ports: data.ports,
        startTime: data.startTime
      });

      setServiceDetails(prev => {
        const updated = {
          ...prev,
          status: data.status,
          pid: data.processId,
          memory: data.memory,
          cpu: data.cpu,
          ports: data.ports,
          startTime: data.startTime || prev.startTime
        };
        console.log('Updated service details:', updated);
        return updated;
      });

      if (data.status === 'stopped' || data.status === 'error') {
        console.log('Setting process as stopped/error');
        setIsRunning(false);
        setProcessId(null);
      } else if (data.status === 'running' || data.status === 'starting') {
        console.log('Setting process as running');
        setIsRunning(true);
      }
    };

    console.log('Setting up process status listener');
    const cleanup = window.electron.on('process-status', handleProcessStatus);
    return () => {
      console.log('Cleaning up process status listener');
      cleanup();
    };
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
    const unsubscribe = window.electron.on('port-conflicts', handlePortConflict);

    return () => {
      console.log('Removing port conflict listeners');
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
      const result = await window.electron.invoke('start-service', {
        command: project.start_command,
        workingDirectory: project.working_directory
      });

      if (result.error === 'PORT_CONFLICT') {
        console.log('Port conflicts detected:', result.conflicts);
        setPortConflicts(result.conflicts);
        setPortConflictDialogOpen(true);
        return;
      }

      if (result.error) {
        setOutput(prev => prev + `\nError starting service: ${result.error}\n`);
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
    } catch (error) {
      console.error('Error starting service:', error);
      setOutput(prev => prev + `\nError starting service: ${error.message}\n`);
    }
  };

  const handleResolveConflicts = async () => {
    try {
      setOutput(prev => prev + '\nAttempting to kill conflicting processes...\n');
      console.log('Resolving port conflicts:', portConflicts);
      
      const result = await window.electron.invoke('kill-port-processes', {
        conflicts: portConflicts
      });

      if (result.success) {
        setOutput(prev => prev + 'Successfully killed conflicting processes\n');
        setPortConflictDialogOpen(false);
        setPortConflicts([]);
        // Wait a moment before trying to start again
        setTimeout(() => {
          handleStart();
        }, 1000);
      } else {
        setOutput(prev => prev + `Failed to kill all processes: ${result.error}\n`);
        // Keep dialog open if there was an error
        setPortConflicts([]);
        setPortConflictDialogOpen(false);
      }
    } catch (error) {
      console.error('Error resolving conflicts:', error);
      setOutput(prev => prev + `Error resolving conflicts: ${error.message}\n`);
      setPortConflicts([]);
      setPortConflictDialogOpen(false);
    }
  };

  const handleClosePortConflictDialog = () => {
    setPortConflictDialogOpen(false);
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
      <ProjectDetails project={project} serviceDetails={serviceDetails} />
      
      <Terminal output={output} />

      <div className="flex justify-between items-center p-4 bg-gray-100">
        <div className="space-x-2">
          {!isRunning ? (
            <button
              onClick={handleStart}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Start Service
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Stop Service
            </button>
          )}
        </div>
      </div>

      <PortConflictDialog
        isOpen={portConflictDialogOpen}
        onClose={handleClosePortConflictDialog}
        conflicts={portConflicts}
        onResolveConflicts={handleResolveConflicts}
      />
    </div>
  );
}

export default ServiceControl;