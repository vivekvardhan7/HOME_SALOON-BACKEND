import { Server } from 'http';
import { Express } from 'express';
import * as net from 'net';

export interface PortCheckOptions {
    startPort: number;
    maxRetries?: number;
    enableFallback?: boolean;
}

export interface PortCheckResult {
    port: number;
    server: Server;
}

/**
 * Attempts to find an available port and start the Express server
 * @param app - Express application instance
 * @param options - Port checking options
 * @returns Promise resolving to port number and server instance
 */
export async function findAvailablePort(
    app: Express,
    options: PortCheckOptions
): Promise<PortCheckResult> {
    const { startPort, maxRetries = 5, enableFallback = true } = options;

    let currentPort = startPort;
    let retries = 0;

    while (retries <= maxRetries) {
        try {
            const server = await attemptListen(app, currentPort);
            return { port: currentPort, server };
        } catch (err: any) {
            if (err.code === 'EADDRINUSE') {
                if (!enableFallback || retries >= maxRetries) {
                    throw new Error(
                        `Port ${currentPort} is in use and fallback is ${enableFallback ? 'exhausted' : 'disabled'
                        }`
                    );
                }

                console.warn(`⚠️  Port ${currentPort} is busy, trying ${currentPort + 1}...`);
                currentPort++;
                retries++;
            } else {
                throw err;
            }
        }
    }

    throw new Error('Failed to find available port');
}

/**
 * Attempts to start the Express server on a specific port
 * @param app - Express application instance
 * @param port - Port number to listen on
 * @returns Promise resolving to server instance
 */
function attemptListen(app: Express, port: number): Promise<Server> {
    return new Promise((resolve, reject) => {
        const server = app.listen(port, () => {
            resolve(server);
        });

        server.on('error', (err) => {
            server.close();
            reject(err);
        });
    });
}

/**
 * Checks if a port is available without starting a server
 * @param port - Port number to check
 * @returns Promise resolving to true if port is available
 */
export async function isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const server = net.createServer();

        server.once('error', (err: NodeJS.ErrnoException) => {
            if (err.code === 'EADDRINUSE') {
                resolve(false);
            } else {
                resolve(false);
            }
        });

        server.once('listening', () => {
            server.close();
            resolve(true);
        });

        server.listen(port);
    });
}

/**
 * Gets the process ID using a specific port (Windows only)
 * @param port - Port number to check
 * @returns Promise resolving to PID or null
 */
export async function getPortPID(port: number): Promise<number | null> {
    if (process.platform !== 'win32') {
        return null;
    }

    try {
        const { execSync } = require('child_process');
        const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' });
        const lines = output.split('\n');

        for (const line of lines) {
            if (line.includes('LISTENING')) {
                const parts = line.trim().split(/\s+/);
                const pid = parseInt(parts[parts.length - 1], 10);
                if (!isNaN(pid)) {
                    return pid;
                }
            }
        }
    } catch (err) {
        // Command failed, port might be free
    }

    return null;
}
