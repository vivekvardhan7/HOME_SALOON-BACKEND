/**
 * Script to check if port is available and provide instructions to free it
 * Run this before starting the server to avoid EADDRINUSE errors
 */

import { isPortAvailable, getPortPID } from '../src/utils/portChecker';

const PORT = Number(process.env.PORT) || 3001;

async function checkPort() {
    console.log(`🔍 Checking if port ${PORT} is available...`);

    const available = await isPortAvailable(PORT);

    if (!available) {
        console.error(`\n❌ Port ${PORT} is already in use!\n`);

        // Try to get PID on Windows
        const pid = await getPortPID(PORT);
        if (pid) {
            console.log(`📌 Process ID using port ${PORT}: ${pid}\n`);
        }

        console.log(`💡 To fix this, run one of these commands:\n`);
        console.log(`   Windows PowerShell:`);
        console.log(`   → Stop-Process -Name node -Force`);
        if (pid) {
            console.log(`   → Stop-Process -Id ${pid} -Force`);
        }
        console.log(``);
        console.log(`   Windows CMD:`);
        console.log(`   → taskkill /F /IM node.exe`);
        if (pid) {
            console.log(`   → taskkill /PID ${pid} /F`);
        }
        console.log(``);
        console.log(`   macOS/Linux:`);
        console.log(`   → lsof -ti:${PORT} | xargs kill -9`);
        console.log(`   → pkill -9 node`);
        console.log(``);
        console.log(`   Cross-platform (with kill-port installed):`);
        console.log(`   → npx kill-port ${PORT}\n`);

        process.exit(1);
    }

    console.log(`✅ Port ${PORT} is available\n`);
}

checkPort().catch(err => {
    console.error('Error checking port:', err);
    process.exit(1);
});
