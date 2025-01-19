import React, { useState, useEffect } from 'react';
import ProjectForm from './ProjectForm';
import ServiceControl from './ServiceControl';

function App() {
  const [projects, setProjects] = useState([]);
  const [editingProject, setEditingProject] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const loadedProjects = await window.electron.invoke('get-projects');
        console.log('Loaded projects:', loadedProjects); // Debug log
        setProjects(loadedProjects);
      } catch (error) {
        console.error('Failed to load projects:', error);
      }
    };
    loadProjects();
  }, []);

  const handleSaveProject = async (project) => {
    try {
      const savedProject = await window.electron.invoke('save-project', project);
      
      if (editingProject !== null) {
        setProjects(projects.map((p, i) => i === editingProject ? savedProject : p));
      } else {
        setProjects([...projects, savedProject]);
      }
      setEditingProject(null);
      setShowForm(false);
    } catch (error) {
      console.error('Failed to save project:', error);
    }
  };

  const handleEditProject = (index) => {
    setEditingProject(index);
    setShowForm(true);
  };

  const handleDeleteProject = async (index) => {
    try {
      const project = projects[index];
      await window.electron.invoke('delete-project', project.id);
      setProjects(projects.filter((_, i) => i !== index));
      if (selectedProject === index) {
        setSelectedProject(null);
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  const handleSelectProject = (index) => {
    setSelectedProject(index);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-semibold text-gray-900">Service Manager</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            {showForm ? 'Hide Form' : 'Add Project'}
          </button>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-[minmax(300px,25%)_1fr] gap-6 p-6 max-w-7xl mx-auto w-full">
        {/* Projects Panel */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Projects</h2>
          </div>
          
          {showForm && (
            <div className="p-4 border-b border-gray-200">
              <ProjectForm 
                initialData={editingProject !== null ? projects[editingProject] : {}}
                onSave={handleSaveProject}
                onCancel={() => {
                  setShowForm(false);
                  setEditingProject(null);
                }}
              />
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            <div className="divide-y divide-gray-200">
              {projects.map((project, index) => (
                <div
                  key={project.id}
                  onClick={() => handleSelectProject(index)}
                  className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                    selectedProject === index ? 'bg-gray-50' : ''
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">{project.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">{project.description}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditProject(index);
                        }}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProject(index);
                        }}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Service Control Panel */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {selectedProject !== null && projects[selectedProject] && (
            <ServiceControl 
              project={projects[selectedProject]}
              onStart={() => {}}
              onStop={() => {}}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;