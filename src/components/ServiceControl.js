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

      setServiceDetails(prev => {
        // Maintain existing ports unless process is stopped
        const updatedPorts = data.status === 'stopped' ? [] : (prev.ports || []);
        
        return {
          ...prev,
          status: data.status,
          pid: data.processId,
          memory: data.memory,
          cpu: data.cpu,
          ports: updatedPorts,
          startTime: data.startTime || prev.startTime
        };
      });

      if (data.status === 'stopped' || data.status === 'error') {
        setIsRunning(false);
        setProcessId(null);
      } else if (data.status === 'running' || data.status === 'starting') {
        setIsRunning(true);
      }
    };

    window.electron.on('process-status', handleProcessStatus);
    return () => window.electron.off('process-status', handleProcessStatus);
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

  // Poll for active ports
  useEffect(() => {
    if (isRunning && processId) {
      console.log('Starting port polling for PID:', processId);
      const pollPorts = async () => {
        try {
          console.log('Polling ports for PID:', processId);
          const ports = await window.electron.invoke('get-active-ports', { pid: processId });
          console.log('Got ports from main process:', ports);
          
          setServiceDetails(prev => {
            // Always update if we have ports
            if (Array.isArray(ports)) {
              const newPorts = ports.length > 0 ? ports : prev.ports || [];
              console.log('Setting ports:', newPorts);
              return {
                ...prev,
                ports: newPorts
              };
            }
            return prev;
          });
        } catch (error) {
          console.error('Error polling ports:', error);
        }
      };

      // Initial load
      pollPorts();

      // Set up polling interval - poll more frequently at first
      const fastInterval = setInterval(pollPorts, 1000);
      
      // After 10 seconds, switch to slower polling
      const slowdownTimer = setTimeout(() => {
        clearInterval(fastInterval);
        setInterval(pollPorts, 5000);
      }, 10000);

      return () => {
        console.log('Cleaning up port polling');
        clearInterval(fastInterval);
        clearTimeout(slowdownTimer);
      };
    }
  }, [isRunning, processId]);

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
    <div className="flex flex-col h-full bg-gray-100 p-6 space-y-6">
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">{project.name}</h2>
        <div className="grid grid-cols-4 gap-6">
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Status</h3>
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${
                serviceDetails.status === 'running' ? 'bg-green-500 animate-pulse' :
                serviceDetails.status === 'starting' ? 'bg-yellow-500 animate-pulse' :
                'bg-red-500'
              }`} />
              <span className="text-base font-medium text-gray-700 capitalize">
                {serviceDetails.status}
              </span>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Process</h3>
            <div className="space-y-1">
              <div className="text-base font-medium text-gray-700">
                PID: {serviceDetails.pid || 'N/A'}
              </div>
              {serviceDetails.startTime && (
                <div className="text-sm text-gray-600">
                  Started: {new Date(serviceDetails.startTime).toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Resources</h3>
            <div className="space-y-1">
              <div className="text-base font-medium text-gray-700">
                Memory: {(serviceDetails.memory || 0).toFixed(1)} MB
              </div>
              <div className="text-base font-medium text-gray-700">
                CPU: {(serviceDetails.cpu || 0).toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Actions</h3>
            <div>
              {!isRunning ? (
                <button
                  onClick={handleStart}
                  className="w-full px-4 py-2 bg-green-600 text-white font-medium rounded-lg
                           shadow-md hover:shadow-lg hover:bg-green-700
                           transition-all duration-200"
                >
                  Start Service
                </button>
              ) : (
                <button
                  onClick={handleStop}
                  className="w-full px-4 py-2 bg-red-600 text-white font-medium rounded-lg
                           shadow-md hover:shadow-lg hover:bg-red-700
                           transition-all duration-200"
                >
                  Stop Service
                </button>
              )}
            </div>
          </div>
        </div>

        {serviceDetails.ports && serviceDetails.ports.length > 0 && (
          <div className="mt-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Active Ports</h3>
            <div className="flex flex-wrap gap-3">
              {serviceDetails.ports.map((port, i) => (
                <div key={i} className="px-3 py-1 bg-white rounded border border-gray-200 text-sm font-medium text-gray-700">
                  {port}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-grow bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
        <div className="bg-gray-800 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <span className="text-sm font-medium text-gray-400">Terminal Output</span>
        </div>
        <Terminal output={output} />
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