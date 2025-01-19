# Service Manager

 Redbay Digital. This work is licensed under a Creative Commons Attribution-NonCommercial 4.0 International License.

A modern desktop application for managing multiple development services and projects. Built with Electron and React, it provides an intuitive interface for starting, stopping, and monitoring local development services.

## Features

- **Project Management**: Easily manage multiple development projects and their services
- **Port Conflict Detection**: Automatically detect and resolve port conflicts
- **Resource Monitoring**: Track CPU, memory usage, and active ports for each service
- **Interactive Terminal**: Real-time output display with automatic scrolling
- **Modern UI**: Clean, responsive interface built with React and Tailwind CSS
- **Persistent Storage**: Local SQLite database for storing project configurations

## Installation

```bash
# Clone the repository
git clone https://github.com/redbay-Dev/servicemanager.git

# Navigate to the project directory
cd servicemanager

# Install dependencies
npm install

# Start the application
npm start
```

## Development

```bash
# Run in development mode
set NODE_ENV=development && npm start

# Build the application
npm run build
```

## Project Structure

```
servicemanager/
├── src/                    # Source files
│   ├── components/        # React components
│   ├── utils/            # Utility functions
│   └── db.js             # Database management
├── main.js               # Electron main process
├── preload.js           # Electron preload script
└── package.json         # Project configuration
```

## Key Features

### Project Management
- Add, edit, and remove development projects
- Configure start commands and working directories
- Save and load project configurations

### Service Control
- Start and stop services with a single click
- View real-time service output
- Monitor resource usage and active ports

### Port Conflict Resolution
- Automatic detection of port conflicts
- Easy resolution with kill and restart options
- Tracking of process IDs and port usage

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- UI powered by [React](https://reactjs.org/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
