import React from 'react';

function PortConflictDialog({ isOpen, onClose, conflicts, onResolveConflicts }) {
  if (!isOpen) return null;

  const handleResolve = () => {
    onResolveConflicts(conflicts);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-lg w-full shadow-xl border border-gray-700">
        <h2 className="text-xl font-semibold mb-4 text-gray-100">Port Conflict Detected</h2>
        <div className="mb-4">
          <p className="text-gray-300 mb-2">
            The following ports are already in use:
          </p>
          <div className="space-y-2">
            {conflicts.map((conflict, index) => (
              <div key={index} className="bg-gray-700 p-3 rounded border border-gray-600">
                <span className="font-mono text-blue-300">Port {conflict.port}</span>
                <span className="mx-2 text-gray-300">is used by</span>
                <span className="font-semibold text-gray-100">{conflict.name}</span>
                <span className="text-gray-400 ml-2">(PID: {conflict.pid})</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-300 hover:text-gray-100 transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleResolve}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors duration-200"
          >
            Kill Processes & Retry
          </button>
        </div>
      </div>
    </div>
  );
}

export default PortConflictDialog;
