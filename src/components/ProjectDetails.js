import React from 'react';

function ProjectDetails({ project, serviceDetails }) {
  const formatTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (startTime) => {
    if (!startTime) return 'N/A';
    const duration = Date.now() - startTime;
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const formatMemory = (memory) => {
    if (memory === undefined || memory === null) return 'N/A';
    return `${memory.toFixed(1)} MB`;
  };

  const formatCPU = (cpu) => {
    if (cpu === undefined || cpu === null) return 'N/A';
    return `${cpu.toFixed(1)}%`;
  };

  const getStatusText = () => {
    if (!serviceDetails.status) return 'Not running';
    if (serviceDetails.status === 'starting') return 'Starting...';
    if (serviceDetails.status === 'running' && !serviceDetails.pid) return 'Not running';
    return serviceDetails.status.charAt(0).toUpperCase() + serviceDetails.status.slice(1);
  };

  const getStatusColor = () => {
    switch (serviceDetails.status) {
      case 'running':
        return 'text-green-600';
      case 'starting':
        return 'text-yellow-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="mt-4 bg-white rounded-lg shadow p-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Project Info */}
        <div className="col-span-2">
          <h3 className="text-lg font-semibold mb-2">Project Details</h3>
          <div className="space-y-2">
            <div>
              <span className="text-gray-600">Name:</span>{' '}
              <span className="font-medium">{project.name}</span>
            </div>
            <div>
              <span className="text-gray-600">Directory:</span>{' '}
              <span className="font-mono text-sm">{project.working_directory}</span>
            </div>
            <div>
              <span className="text-gray-600">Command:</span>{' '}
              <span className="font-mono text-sm">{project.start_command}</span>
            </div>
          </div>
        </div>

        {/* Service Status */}
        <div>
          <h3 className="text-lg font-semibold mb-2">Service Status</h3>
          <div className="space-y-2">
            <div>
              <span className="text-gray-600">Status:</span>{' '}
              <span className={`font-medium ${getStatusColor()}`}>
                {getStatusText()}
              </span>
            </div>
            <div>
              <span className="text-gray-600">PID:</span>{' '}
              <span className="font-mono">{serviceDetails.pid || 'N/A'}</span>
            </div>
            <div>
              <span className="text-gray-600">Uptime:</span>{' '}
              <span>{formatDuration(serviceDetails.startTime)}</span>
            </div>
            {serviceDetails.childProcessCount > 0 && (
              <div>
                <span className="text-gray-600">Child Processes:</span>{' '}
                <span>{serviceDetails.childProcessCount}</span>
              </div>
            )}
          </div>
        </div>

        {/* Resource Usage */}
        <div>
          <h3 className="text-lg font-semibold mb-2">Resource Usage</h3>
          <div className="space-y-2">
            <div>
              <span className="text-gray-600">Memory:</span>{' '}
              <span>{formatMemory(serviceDetails.memory)}</span>
            </div>
            <div>
              <span className="text-gray-600">CPU:</span>{' '}
              <span>{formatCPU(serviceDetails.cpu)}</span>
            </div>
            <div>
              <span className="text-gray-600">Active Ports:</span>{' '}
              <span className="font-mono text-sm">
                {serviceDetails.ports?.length > 0
                  ? serviceDetails.ports.join(', ')
                  : 'None'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Additional details or error messages */}
      {serviceDetails.details && (
        <div className="mt-4 text-sm text-gray-600">
          {serviceDetails.details}
        </div>
      )}
    </div>
  );
}

export default ProjectDetails;
