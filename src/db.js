const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { promisify } = require('util');
const { app } = require('electron');

const dbPath = path.join(app.getPath('userData'), 'service-manager.db');

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, async (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }
      console.log('Connected to database at:', dbPath);

      try {
        // Promisify database operations
        const dbRun = promisify(db.run.bind(db));
        const dbGet = promisify(db.get.bind(db));
        const dbAll = promisify(db.all.bind(db));

        // Initialize database
        await dbRun(`
          CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            working_directory TEXT,
            start_command TEXT NOT NULL,
            stop_command TEXT,
            ports TEXT,
            environment TEXT
          )
        `);

        // Check if ports column exists, add if it doesn't
        const tableInfo = await dbAll("PRAGMA table_info(projects)");
        const hasPortsColumn = tableInfo.some(row => row.name === 'ports');
        const hasEnvironmentColumn = tableInfo.some(row => row.name === 'environment');

        if (!hasPortsColumn) {
          await dbRun('ALTER TABLE projects ADD COLUMN ports TEXT');
        }
        if (!hasEnvironmentColumn) {
          await dbRun('ALTER TABLE projects ADD COLUMN environment TEXT');
        }

        // Create database interface
        const database = {
          async getProjects() {
            const rows = await dbAll('SELECT * FROM projects');
            return rows.map(row => ({
              ...row,
              ports: row.ports ? JSON.parse(row.ports) : [],
              environment: row.environment ? JSON.parse(row.environment) : {}
            }));
          },

          async saveProject(project) {
            const {
              id,
              name,
              description,
              working_directory,
              start_command,
              stop_command,
              ports = [],
              environment = {}
            } = project;

            const portsJson = JSON.stringify(ports);
            const environmentJson = JSON.stringify(environment);

            if (id) {
              await dbRun(
                `UPDATE projects SET 
                  name = ?, 
                  description = ?, 
                  working_directory = ?, 
                  start_command = ?, 
                  stop_command = ?,
                  ports = ?,
                  environment = ?
                WHERE id = ?`,
                [name, description, working_directory, start_command, stop_command, portsJson, environmentJson, id]
              );
              return {
                ...project,
                id,
                ports: ports || [],
                environment: environment || {}
              };
            } else {
              const result = await dbRun(
                `INSERT INTO projects (
                  name, 
                  description, 
                  working_directory, 
                  start_command, 
                  stop_command,
                  ports,
                  environment
                ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [name, description, working_directory, start_command, stop_command, portsJson, environmentJson]
              );
              return {
                ...project,
                id: result.lastID,
                ports: ports || [],
                environment: environment || {}
              };
            }
          },

          async deleteProject(id) {
            await dbRun('DELETE FROM projects WHERE id = ?', [id]);
          },

          async updateProject(project) {
            return this.saveProject(project);
          }
        };

        // Clean up database connection when app closes
        process.on('exit', () => {
          db.close((err) => {
            if (err) {
              console.error('Error closing database:', err);
            }
          });
        });

        resolve(database);
      } catch (error) {
        console.error('Error initializing database:', error);
        reject(error);
      }
    });
  });
}

module.exports = { initializeDatabase };