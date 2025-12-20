
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable() {
    console.log('Checking "beauticians" table...');
    const { data, error } = await supabase.from('beauticians').select('*').limit(1);

    if (error) {
        console.error('Error querying table:', error);
        if (error.code === '42P01') {
            console.error('TABLE DOES NOT EXIST. Please run the migration script.');
        }
    } else {
        console.log('Table exists. Row count sample:', data.length);
    }
}

checkTable();
