const { contextBridge, ipcRenderer } = require('electron');

// Store event listeners
const listeners = new Map();

contextBridge.exposeInMainWorld('electron', {
  invoke: async (channel, data) => {
    return await ipcRenderer.invoke(channel, data);
  },
  on: (channel, callback) => {
    // Remove existing listener if any
    if (listeners.has(channel)) {
      ipcRenderer.removeListener(channel, listeners.get(channel));
    }
    
    // Wrap callback to ensure it's called with the right data format
    const wrappedCallback = (event, ...args) => {
      console.log(`IPC Event ${channel}:`, ...args);
      callback(...args);
    };
    
    // Store and add listener
    listeners.set(channel, wrappedCallback);
    ipcRenderer.on(channel, wrappedCallback);
    
    // Return cleanup function
    return () => {
      if (listeners.has(channel)) {
        ipcRenderer.removeListener(channel, listeners.get(channel));
        listeners.delete(channel);
      }
    };
  },
  off: (channel, callback) => {
    if (listeners.has(channel)) {
      ipcRenderer.removeListener(channel, listeners.get(channel));
      listeners.delete(channel);
    }
  }
});