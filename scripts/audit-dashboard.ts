
import { supabase } from '../src/lib/supabase';
import 'dotenv/config';

async function checkDashboardIntegrity() {
    console.log('🔍 Starting Dashboard Integrity Check...');

    // 1. Check raw user counts
    const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, role, status');

    if (usersError) {
        console.error('❌ Error fetching users:', usersError);
    } else {
        console.log('✅ Total Users:', users?.length);
        console.log('📊 Role Breakdown:');
        const roles: Record<string, number> = {};
        const statuses: Record<string, number> = {};

        users?.forEach(u => {
            roles[u.role] = (roles[u.role] || 0) + 1;
            const key = `${u.role}:${u.status}`;
            statuses[key] = (statuses[key] || 0) + 1;
        });
        console.table(roles);
        console.log('📊 Status Breakdown (Role:Status):');
        console.table(statuses);
    }

    // 2. Check bookings
    const { count: bookingsCount, error: bookingsError } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true });

    if (bookingsError) {
        console.error('❌ Error fetching bookings:', bookingsError);
    } else {
        console.log('✅ Total Bookings:', bookingsCount);
    }
}

checkDashboardIntegrity();
