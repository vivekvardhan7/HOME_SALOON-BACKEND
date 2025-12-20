
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function runMigration() {
    try {
        console.log('Connecting to database via Prisma...');
        await prisma.$connect();

        const sqlPath = path.join(__dirname, 'create_beautician_tables.sql');
        console.log(`Reading SQL from ${sqlPath}`);
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Executing raw SQL...');
        // Split by semicolon to run statements individually if needed, 
        // but $executeRawUnsafe might handle blocks. 
        // For safety, let's run the whole block or split if it fails.
        // Postgres usually handles multiple statements in one query string for DDL.

        await prisma.$executeRawUnsafe(sql);
        console.log('Migration completed successfully.');

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await prisma.$disconnect();
    }
}

runMigration();
