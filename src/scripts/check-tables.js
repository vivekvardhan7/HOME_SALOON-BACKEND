
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
    // Try to list tables from information_schema (might fail if RLS/permissions block it even with service key on some setups, but usually works)
    // Note: Supabase JS client might not support querying information_schema directly via .from() easily without some setup, 
    // but let's try. If not, we fall back to checking specific tables.

    console.log('Attempting to list tables...');

    // Method 1: Check known tables one by one and print result immediately
    const tablesToCheck = [
        'User', 'user', 'Users', 'users',
        'Vendor', 'vendor', 'Vendors', 'vendors',
        'Service', 'service', 'Services', 'services',
        'Booking', 'booking', 'Bookings', 'bookings',
        'Product', 'product', 'Products', 'products',
        'ServiceCatalog', 'service_catalog',
        'ProductCatalog', 'product_catalog',
        'Address', 'address', 'Addresses', 'addresses',
        'Review', 'review', 'Reviews', 'reviews',
        'Payment', 'payment', 'Payments', 'payments',
        'BookingItem', 'booking_item', 'BookingItems', 'booking_items',
        'BookingProduct', 'booking_product', 'BookingProducts', 'booking_products',
        'BookingEvent', 'booking_event', 'BookingEvents', 'booking_events',
        'AuditLog', 'audit_log', 'AuditLogs', 'audit_logs',
        'Employee', 'employee', 'Employees', 'employees',
        'Media', 'media',
        'Coupon', 'coupon', 'Coupons', 'coupons',
        'AccessLog', 'access_log', 'AccessLogs', 'access_logs'
    ];

    for (const table of tablesToCheck) {
        const { error } = await supabase.from(table).select('count', { count: 'exact', head: true });
        if (!error) {
            console.log(`✅ Table '${table}' EXISTS`);
        } else {
            // console.log(`❌ Table '${table}' does not exist (or error: ${error.message})`);
        }
    }
}

listTables();
