
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSchema() {
    console.log('Inspecting `beauticians` table...');
    const { data: bData, error: bError } = await supabase.from('beauticians').select('*').limit(1);

    if (bError) {
        console.error('Error accessing beauticians:', bError.message);
    } else {
        console.log('Beauticians sample row:', bData && bData.length > 0 ? bData[0] : 'Table empty but accessible');
        if (bData && bData.length === 0) {
            console.log('Attempting to infer columns from error or just try generic insert to fail and list cols? No, better to view metadata if possible, but standard client doesnt expose it easily.');
        }
    }

    console.log('Inspecting `beauticians_availability` table...');
    const { data: baData, error: baError } = await supabase.from('beauticians_availability').select('*').limit(1);
    if (baError) console.error('Error accessing beauticians_availability:', baError.message);
    else console.log('Availability sample:', baData);

    console.log('Inspecting `at_home_services` table...');
    const { data: sData, error: sError } = await supabase.from('at_home_services').select('*').limit(1);
    if (sError) console.error('Error accessing at_home_services:', sError.message);
    else console.log('Services sample:', sData);
}

inspectSchema();
