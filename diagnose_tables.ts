
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
    console.log('--- Diagnostic Start ---');

    const tables = ['beauticians', 'beauticians_availability', 'booking_live_updates', 'beautician_notifications'];

    for (const table of tables) {
        const { error } = await supabase.from(table).select('*').limit(1);
        if (error) {
            console.error(`❌ Table '${table}': ERROR - ${error.message} (${error.code})`);
        } else {
            console.log(`✅ Table '${table}': Exists`);
        }
    }

    // Check columns in beauticians by trying to insert a dummy (and failing intentionally or rolling back? cant rollback via http)
    // We can't easily check columns without sending data.
    // Let's rely on the table check first.

    console.log('--- Diagnostic End ---');
}

checkTables();
