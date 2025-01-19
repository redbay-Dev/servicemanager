import React, { useState, useEffect } from 'react';

function ProjectForm({ onSave, onCancel, initialData = {} }) {
  const [project, setProject] = useState({
    id: initialData.id || null,
    name: initialData.name || '',
    description: initialData.description || '',
    working_directory: initialData.working_directory || '',
    start_command: initialData.start_command || '',
    stop_command: initialData.stop_command || '',
    ports: initialData.ports || [],
    environment: initialData.environment || {},
    portInput: '',
    envKeyInput: '',
    envValueInput: ''
  });

  // Update form when initialData changes
  useEffect(() => {
    setProject(prev => ({
      ...prev,
      id: initialData.id || null,
      name: initialData.name || '',
      description: initialData.description || '',
      working_directory: initialData.working_directory || '',
      start_command: initialData.start_command || '',
      stop_command: initialData.stop_command || '',
      ports: initialData.ports || [],
      environment: initialData.environment || {},
    }));
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProject(prev => ({ ...prev, [name]: value }));
  };

  const handleAddPort = () => {
    const port = parseInt(project.portInput, 10);
    if (port && port > 0 && port < 65536 && !project.ports.includes(port)) {
      setProject(prev => ({
        ...prev,
        ports: [...prev.ports, port],
        portInput: ''
      }));
    }
  };

  const handleRemovePort = (portToRemove) => {
    setProject(prev => ({
      ...prev,
      ports: prev.ports.filter(port => port !== portToRemove)
    }));
  };

  const handleAddEnvVar = () => {
    if (project.envKeyInput && project.envValueInput) {
      setProject(prev => ({
        ...prev,
        environment: {
          ...prev.environment,
          [project.envKeyInput]: project.envValueInput
        },
        envKeyInput: '',
        envValueInput: ''
      }));
    }
  };

  const handleRemoveEnvVar = (key) => {
    setProject(prev => {
      const newEnv = { ...prev.environment };
      delete newEnv[key];
      return {
        ...prev,
        environment: newEnv
      };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!project.name || !project.start_command) {
      alert('Name and Start command are required');
      return;
    }
    onSave({
      id: project.id,
      name: project.name,
      description: project.description,
      working_directory: project.working_directory,
      start_command: project.start_command,
      stop_command: project.stop_command,
      ports: project.ports,
      environment: project.environment
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Name</label>
        <input
          type="text"
          name="name"
          value={project.name}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Description</label>
        <input
          type="text"
          name="description"
          value={project.description}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Working Directory</label>
        <div className="mt-1 flex rounded-md shadow-sm">
          <input
            type="text"
            name="working_directory"
            value={project.working_directory}
            onChange={handleChange}
            className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Start Command</label>
        <input
          type="text"
          name="start_command"
          value={project.start_command}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Stop Command</label>
        <input
          type="text"
          name="stop_command"
          value={project.stop_command}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Ports</label>
        <div className="mt-1 flex rounded-md shadow-sm">
          <input
            type="number"
            name="portInput"
            value={project.portInput}
            onChange={handleChange}
            placeholder="Enter port number"
            className="flex-1 rounded-l-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
          <button
            type="button"
            onClick={handleAddPort}
            className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm"
          >
            Add
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {project.ports.map(port => (
            <span
              key={port}
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
            >
              {port}
              <button
                type="button"
                onClick={() => handleRemovePort(port)}
                className="ml-1 text-blue-400 hover:text-blue-600"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Environment Variables</label>
        <div className="mt-1 grid grid-cols-[1fr,1fr,auto] gap-2">
          <input
            type="text"
            name="envKeyInput"
            value={project.envKeyInput}
            onChange={handleChange}
            placeholder="Key"
            className="rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
          <input
            type="text"
            name="envValueInput"
            value={project.envValueInput}
            onChange={handleChange}
            placeholder="Value"
            className="rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
          <button
            type="button"
            onClick={handleAddEnvVar}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Add
          </button>
        </div>
        <div className="mt-2">
          {Object.entries(project.environment).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between py-1">
              <span className="text-sm">
                <span className="font-medium">{key}</span> = {value}
              </span>
              <button
                type="button"
                onClick={() => handleRemoveEnvVar(key)}
                className="text-red-600 hover:text-red-900"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Save
        </button>
      </div>
    </form>
  );
}

export default ProjectForm;