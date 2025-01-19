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
    <div className="bg-gray-800 rounded-xl shadow-lg p-8">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="border-b border-gray-700 pb-6">
          <h2 className="text-2xl font-semibold text-gray-100 mb-1">
            {project.id ? 'Edit Project' : 'New Project'}
          </h2>
          <p className="text-sm text-gray-400">Configure your service settings and environment</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-1">Project Name</label>
              <input
                type="text"
                name="name"
                value={project.name}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-100
                         focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                placeholder="My Service"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-200 mb-1">Description</label>
              <textarea
                name="description"
                value={project.description}
                onChange={handleChange}
                rows="2"
                className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-100
                         focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                placeholder="Brief description of your service"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-200 mb-1">Working Directory</label>
              <div className="flex rounded-lg shadow-sm">
                <input
                  type="text"
                  name="working_directory"
                  value={project.working_directory}
                  onChange={handleChange}
                  className="flex-1 px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-100
                           focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  placeholder="/path/to/project"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-1">Start Command</label>
              <input
                type="text"
                name="start_command"
                value={project.start_command}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-100
                         focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                placeholder="npm start"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-200 mb-1">Stop Command</label>
              <input
                type="text"
                name="stop_command"
                value={project.stop_command}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-100
                         focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                placeholder="npm stop"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-700 pt-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-3">Service Ports</label>
            <div className="flex gap-2">
              <input
                type="number"
                name="portInput"
                value={project.portInput}
                onChange={handleChange}
                placeholder="Port number (e.g. 3000)"
                className="flex-1 px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-100
                         focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
              />
              <button
                type="button"
                onClick={handleAddPort}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                         transition-colors duration-200 font-medium"
              >
                Add Port
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {project.ports.map(port => (
                <span
                  key={port}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm 
                           font-medium bg-blue-900 text-blue-200 border border-blue-800"
                >
                  Port {port}
                  <button
                    type="button"
                    onClick={() => handleRemovePort(port)}
                    className="ml-2 text-blue-300 hover:text-blue-100"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-200 mb-3">Environment Variables</label>
            <div className="grid grid-cols-[1fr,1fr,auto] gap-3">
              <input
                type="text"
                name="envKeyInput"
                value={project.envKeyInput}
                onChange={handleChange}
                placeholder="KEY"
                className="px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-100
                         focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
              />
              <input
                type="text"
                name="envValueInput"
                value={project.envValueInput}
                onChange={handleChange}
                placeholder="value"
                className="px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-100
                         focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
              />
              <button
                type="button"
                onClick={handleAddEnvVar}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                         transition-colors duration-200 font-medium"
              >
                Add
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {Object.entries(project.environment).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg border border-gray-600">
                  <div className="flex items-center space-x-3">
                    <span className="font-mono text-sm text-gray-300">{key}</span>
                    <span className="text-gray-500">=</span>
                    <span className="font-mono text-sm text-gray-200">{value}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveEnvVar(key)}
                    className="text-gray-400 hover:text-red-400 transition-colors duration-200"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-4 pt-6 border-t border-gray-700">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700
                     transition-colors duration-200 font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700
                     transition-colors duration-200 font-medium"
          >
            {project.id ? 'Update Project' : 'Create Project'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ProjectForm;