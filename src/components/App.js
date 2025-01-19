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
        console.log('Loaded projects:', loadedProjects);
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
    <div className="h-screen flex flex-col bg-gray-900 text-gray-100">
      {/* Title Bar */}
      <div className="h-8 bg-gray-900 flex items-center px-4 border-b border-gray-800">
        <span className="text-sm font-medium">Service Manager</span>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 flex flex-col bg-gray-800">
          {/* Projects Header */}
          <div className="p-4 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-200">Projects</h2>
            <button
              onClick={() => setShowForm(true)}
              className="p-1.5 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          {/* Projects List */}
          <div className="flex-1 overflow-y-auto">
            {projects.map((project, index) => (
              <div
                key={project.id}
                onClick={() => handleSelectProject(index)}
                className={`px-4 py-3 cursor-pointer transition-colors flex items-center justify-between
                          ${selectedProject === index 
                            ? 'bg-gray-700 hover:bg-gray-700' 
                            : 'hover:bg-gray-700'}`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${selectedProject === index ? 'bg-blue-400' : 'bg-gray-500'}`} />
                  <span className="text-sm font-medium">{project.name}</span>
                </div>
                <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditProject(index);
                    }}
                    className="p-1 rounded hover:bg-gray-600 text-gray-400 hover:text-gray-200"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProject(index);
                    }}
                    className="p-1 rounded hover:bg-gray-600 text-gray-400 hover:text-red-400"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 bg-gray-700 overflow-hidden">
          {selectedProject !== null && projects[selectedProject] ? (
            <ServiceControl 
              project={projects[selectedProject]}
              onStart={() => {}}
              onStop={() => {}}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              <p>Select a project to get started</p>
            </div>
          )}
        </div>
      </div>

      {/* Project Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <ProjectForm 
              initialData={editingProject !== null ? projects[editingProject] : {}}
              onSave={handleSaveProject}
              onCancel={() => {
                setShowForm(false);
                setEditingProject(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;