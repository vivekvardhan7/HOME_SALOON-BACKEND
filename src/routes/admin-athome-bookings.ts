import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// GET /api/admin/athome-bookings
// Fetch all at-home bookings with full details (read-only)
router.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
    // Admin check - either strictly 'admin' role or relying on requireRole middleware if configured
    // For now, we'll check role manually to be safe or assume requireAuth adds user.
    // Admin check - either strictly 'admin' role or relying on requireRole middleware if configured
    // For now, allow admin AND manager just in case, but primary is admin.
    const userRole = req.user?.role?.toUpperCase();
    if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    try {
        console.log('[Admin] Fetching all At-Home Bookings');

        const { data: bookings, error } = await supabase
            .from('athome_bookings')
            .select(`
                *,
                customer:users!athome_bookings_customer_id_fkey(first_name, last_name, email, phone),
                beautician:beauticians!athome_bookings_assigned_beautician_id_fkey(*),
                services:athome_booking_services!fk_abs_booking(
                    *,
                    master:admin_services!fk_abs_service(name, duration_minutes, price)
                ),
                products:athome_booking_products!fk_abp_booking(
                    *,
                    master:admin_products!fk_abp_product(name, price, image_url)
                )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Fetch Live Updates manually (Missing FK workaround)
        const bookingIds = bookings.map((b: any) => b.id);
        let updatesMap: Record<string, any[]> = {};

        if (bookingIds.length > 0) {
            const { data: updates } = await supabase
                .from('booking_live_updates')
                .select('id, status, message, created_at, updated_by, booking_id')
                .in('booking_id', bookingIds)
                .order('created_at', { ascending: false });

            (updates || []).forEach((u: any) => {
                if (!updatesMap[u.booking_id]) updatesMap[u.booking_id] = [];
                updatesMap[u.booking_id].push(u);
            });
        }

        const enrichedBookings = bookings.map((b: any) => ({
            ...b,
            live_updates: updatesMap[b.id] || []
        }));

        res.json({
            success: true,
            data: enrichedBookings
        });

    } catch (error: any) {
        console.error('Error fetching admin at-home bookings:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch bookings', error: error.message });
    }
});

export default router;
