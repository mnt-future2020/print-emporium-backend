// Phusion Passenger / Hostinger Bridge for ES Modules
// Hostinger's internal Node.js wrapper sometimes uses require() to load the entry file.
// Since package.json has "type": "module", require() crashes instantly without logging.
// This bridge file safely loads the ES module server using dynamic import.

async function start() {
    try {
        await import('./server.js');
    } catch (e) {
        console.error("Failed to start server via Passenger Bridge:", e);
    }
}

start();
