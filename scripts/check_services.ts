
// @ts-nocheck
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkCounts() {
    console.log('Checking service counts...');

    const { count: servicesCount, error: servicesError } = await supabase
        .from('services')
        .select('*', { count: 'exact', head: true });

    console.log('Table "services" count:', servicesCount, 'Error:', servicesError?.message);

    const { count: vendorServicesCount, error: vendorServicesError } = await supabase
        .from('vendor_services')
        .select('*', { count: 'exact', head: true });

    console.log('Table "vendor_services" count:', vendorServicesCount, 'Error:', vendorServicesError?.message);

    const { count: catalogCount, error: catalogError } = await supabase
        .from('service_catalog')
        .select('*', { count: 'exact', head: true });

    console.log('Table "service_catalog" count:', catalogCount, 'Error:', catalogError?.message);
}

checkCounts().catch(console.error);
