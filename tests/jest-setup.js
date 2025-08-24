// tests/jest-setup.js
// Jest setup file to provide Node.js globals

// Define missing globals for Node.js environment
global.File = class File {
  constructor(bits, name, options = {}) {
    this.bits = bits;
    this.name = name;
    this.type = options.type || '';
    this.lastModified = options.lastModified || Date.now();
  }
};

// Define other missing Web APIs if needed
global.FormData = global.FormData || class FormData {
  constructor() {
    this.data = new Map();
  }
  
  append(key, value) {
    this.data.set(key, value);
  }
  
  get(key) {
    return this.data.get(key);
  }
};

// Set test environment flag
process.env.NODE_ENV = 'test';