const config = {
    environment: 'local', // Change to 'production' for production environment
    
    // API endpoints
    endpoints: {
        local: {
            chat: 'http://localhost/api/chat',
            history: 'http://localhost/api/history',
            clear: 'http://localhost/api/clear'
        },
        production: {
            chat: 'https://uhslc.soest.hawaii.edu/sea-api/chat',
            history: 'https://uhslc.soest.hawaii.edu/sea-api/history',
            clear: 'https://uhslc.soest.hawaii.edu/sea-api/clear',
            upload: 'https://uhslc.soest.hawaii.edu/sea-api/upload',
            files: 'https://uhslc.soest.hawaii.edu/sea-api/files',
        }
    },

    // Get the current environment's endpoints
    getEndpoints() {
        return this.endpoints[this.environment];
    }
};
