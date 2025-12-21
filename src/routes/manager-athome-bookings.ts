
import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { requireAuth, requireRole, AuthenticatedRequest, authenticateManager } from '../middleware/auth';
import { sendBeauticianAssignmentEmail, sendCustomerBeauticianAssignedEmail } from '../lib/emailService';

const router = Router();

// ==================== MANAGER AT-HOME BOOKINGS (PHASE 2) ====================

// 1. Get all At-Home requests (PENDING or ASSIGNED)
router.get('/', authenticateManager, async (req: AuthenticatedRequest, res) => {
    try {
        console.log('Fetching at-home bookings for manager...');

        const { data: bookings, error: bookingsError } = await supabase
            .from('athome_bookings')
            .select(`
        *,
        customer:users!athome_bookings_customer_id_fkey (first_name, last_name, phone, email),
        assigned_beautician:beauticians!athome_bookings_assigned_beautician_id_fkey (*)
      `)
            .order('created_at', { ascending: false });

        if (bookingsError) throw bookingsError;

        const bookingIds = bookings.map((b: any) => b.id);

        let servicesMap: Record<string, any[]> = {};
        let productsMap: Record<string, any[]> = {};

        if (bookingIds.length > 0) {
            console.log(`[Manager] Querying services/products for ${bookingIds.length} bookings...`);

            const { data: services, error: sError } = await supabase
                .from('athome_booking_services')
                .select(`
          *,
          master_service:admin_services!athome_booking_services_admin_service_id_fkey (name, category)
        `)
                .in('booking_id', bookingIds);

            if (sError) console.error('[Manager] Error fetching services:', sError);
            else console.log(`[Manager] Found ${services?.length || 0} services.`);

            const { data: products, error: pError } = await supabase
                .from('athome_booking_products')
                .select(`
           *,
           master_product:admin_products!athome_booking_products_admin_product_id_fkey (name, category)
        `)
                .in('booking_id', bookingIds);

            if (pError) console.error('[Manager] Error fetching products:', pError);
            else console.log(`[Manager] Found ${products?.length || 0} products.`);

            (services || []).forEach((s: any) => {
                if (!servicesMap[s.booking_id]) servicesMap[s.booking_id] = [];
                servicesMap[s.booking_id].push(s);
            });

            (products || []).forEach((p: any) => {
                if (!productsMap[p.booking_id]) productsMap[p.booking_id] = [];
                productsMap[p.booking_id].push(p);
            });
        }

        const transformedBookings = bookings.map((b: any) => ({
            ...b,
            services: servicesMap[b.id] || [],
            products: productsMap[b.id] || []
        }));

        res.json({ success: true, data: transformedBookings });

    } catch (error: any) {
        console.error('Error fetching manager at-home bookings:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch bookings', error: error.message });
    }
});

// 2. Get Eligible Beauticians for a Booking
router.get('/:id/eligible-beauticians', authenticateManager, async (req: AuthenticatedRequest, res) => {
    try {
        const { id } = req.params;

        console.log(`[Manager] Fetching eligible beauticians for booking ${id}`);

        // 1. Fetch Booking Services/Products to determine needs
        const { data: bookingServices } = await supabase
            .from('athome_booking_services')
            .select('*, master:admin_services!athome_booking_services_admin_service_id_fkey(name, category)')
            .eq('booking_id', id);

        const { data: bookingProducts } = await supabase
            .from('athome_booking_products')
            .select('*, master:admin_products!athome_booking_products_admin_product_id_fkey(name, category)')
            .eq('booking_id', id);

        // 2. Determine Required Skills
        // Heuristic: Use service names and categories as keywords
        let keywords = new Set<string>();
        (bookingServices || []).forEach((s: any) => {
            if (s.master?.name) keywords.add(s.master.name.toLowerCase());
            if (s.master?.category) keywords.add(s.master.category.toLowerCase());
        });
        // Products usually don't dictate beautician skills as much as services, but can add context if needed.

        const requiredKeywords = Array.from(keywords);
        console.log('[Manager] Required Keywords for Beautician:', requiredKeywords);

        // 3. Fetch All Active Beauticians
        const { data: beauticians, error: bError } = await supabase
            .from('beauticians')
            .select('*')
            .eq('status', 'ACTIVE');

        if (bError) throw bError;

        // 4. Client-Side filtering for "ILIKE" style skill matching
        // Database allows simple ILIKE, but multiple keywords are easier to handle in JS for this scale
        let eligible = (beauticians || []).map((b: any) => {
            // b.skills is likely an array if coming from text[] column, but robust check is good
            let bSkills: string[] = [];
            if (Array.isArray(b.skills)) {
                bSkills = b.skills.map((s: any) => String(s).toLowerCase());
            } else if (typeof b.skills === 'string') {
                bSkills = b.skills.toLowerCase().split(',').map((s: string) => s.trim());
            }

            // Score the beautician: how many keywords match?
            let score = 0;
            let matchedSkills: string[] = [];

            // Check if any required keyword matches any of the beautician's skills (partial match allowed)
            requiredKeywords.forEach((k: string) => {
                const kLower = k.toLowerCase();
                // Check if keyword is found in ANY of the beautician's skills
                const matchFound = bSkills.some((skill: string) => skill.includes(kLower) || kLower.includes(skill));

                if (matchFound) {
                    score++;
                    matchedSkills.push(k);
                }
            });

            // Special case: "Hair" matches "Hair Cut", etc.
            // If keywords is empty (rare), allow all.
            const isMatch = requiredKeywords.length === 0 || score > 0;

            return {
                ...b,
                matchScore: score,
                matchedSkills: matchedSkills,
                isMatch
            };
        });

        // 5. Sort by best match (highest score)
        eligible.sort((a: any, b: any) => b.matchScore - a.matchScore);

        // Filter out zero matches if we have requirements
        if (requiredKeywords.length > 0) {
            eligible = eligible.filter((b: any) => b.isMatch);
        }

        // 6. Format for Frontend
        // Fallback: If no matches, return ALL active beauticians but marked as "Weak Match"
        if (eligible.length === 0 && requiredKeywords.length > 0) {
            console.log('[Manager] No direct skill matches found. Returning all active beauticians as fallback.');
            eligible = (beauticians || []).map((b: any) => ({ ...b, matchScore: 0, isMatch: false, matchType: 'Fallback' }));
        }

        res.json({
            success: true,
            data: eligible.map((b: any) => ({
                id: b.id,
                name: b.name,
                expert_level: b.expert_level,
                skills: b.skills,
                phone: b.phone,
                matchType: b.matchScore > 0 ? 'Skills Match' : 'Available',
                score: b.matchScore
            }))
        });

    } catch (error: any) {
        console.error('Error fetching eligible beauticians:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch beauticians', error: error.message });
    }
});

// 3. Assign Assgined Beautician to Booking
router.post('/:id/assign', authenticateManager, async (req: AuthenticatedRequest, res) => {
    try {
        const { id } = req.params;
        const { beautician_id } = req.body;

        if (!beautician_id) {
            return res.status(400).json({ success: false, message: 'Beautician ID is required.' });
        }

        console.log(`[Manager] Assigning Beautician ${beautician_id} to Booking ${id}`);

        // 1. Update Booking Master
        const { error: bError } = await supabase
            .from('athome_bookings')
            .update({
                assigned_beautician_id: beautician_id,
                status: 'ASSIGNED'
            })
            .eq('id', id);

        if (bError) throw bError;

        // 2. Update Booking Services
        await supabase
            .from('athome_booking_services')
            .update({ assigned_beautician_id: beautician_id, status: 'ASSIGNED' })
            .eq('booking_id', id);

        // 3. Update Booking Products (if exist)
        await supabase
            .from('athome_booking_products')
            .update({ assigned_beautician_id: beautician_id, status: 'ASSIGNED' })
            .eq('booking_id', id);

        // 4. Create Live Update
        await supabase
            .from('booking_live_updates')
            .insert([{
                booking_id: id,
                beautician_id: beautician_id,
                status: 'Beautician Assigned',
                message: 'Beautician has been assigned',
                updated_by: 'manager',
                customer_visible: true
            }]);

        // --------------- FETCH DETAILS FOR EMAILS ---------------

        // Fetch Booking & Customer
        const { data: booking } = await supabase
            .from('athome_bookings')
            .select(`
                *,
                customer:users!athome_bookings_customer_id_fkey (first_name, last_name, email, phone)
            `)
            .eq('id', id)
            .single();

        // Fetch Beautician
        const { data: beautician } = await supabase
            .from('beauticians')
            .select('*')
            .eq('id', beautician_id)
            .single();

        // Fetch Services
        const { data: services } = await supabase
            .from('athome_booking_services')
            .select('*, master:admin_services!athome_booking_services_admin_service_id_fkey(name)')
            .eq('booking_id', id);

        // Fetch Products
        const { data: products } = await supabase
            .from('athome_booking_products')
            .select('*, master:admin_products!athome_booking_products_admin_product_id_fkey(name)')
            .eq('booking_id', id);

        if (booking && beautician) {
            const customerName = `${booking.customer?.first_name} ${booking.customer?.last_name}`;
            const beauticianName = beautician.name;
            const slotDate = new Date(booking.slot).toLocaleDateString();
            const slotTime = new Date(booking.slot).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            // 5. Send Email to Beautician
            const serviceNames = (services || []).map((s: any) => s.master?.name || 'Service');
            const productNames = (products || []).map((p: any) => p.master?.name || 'Product');

            let addressStr = 'N/A';
            if (typeof booking.address === 'string') addressStr = booking.address;
            else if (booking.address) addressStr = `${booking.address.street || ''}, ${booking.address.city || ''}`;

            console.log('[Manager] Sending Email to Beautician:', beautician.email);
            // Non-blocking email
            sendBeauticianAssignmentEmail({
                email: beautician.email,
                beauticianName,
                customerName,
                customerAddress: addressStr,
                services: serviceNames,
                products: productNames,
                slotDate,
                slotTime
            }).catch(e => console.error('Failed to send beautician email:', e));

            // 6. Send Email to Customer
            console.log('[Manager] Sending Email to Customer:', booking.customer?.email);
            if (booking.customer?.email) {
                // Non-blocking email
                sendCustomerBeauticianAssignedEmail({
                    email: booking.customer.email,
                    customerName,
                    beauticianName,
                    beauticianPhone: beautician.phone,
                    slotDate,
                    slotTime,
                    customerAddress: addressStr,
                    services: serviceNames,
                    products: productNames,
                    trackingLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/customer/bookings`
                }).catch(e => console.error('Failed to send customer email:', e));
            }

            // 7. Insert Notification for Beautician
            await supabase
                .from('beautician_notifications')
                .insert([{
                    beautician_id: beautician_id,
                    booking_id: id,
                    title: 'New Service Assigned',
                    message: `You have been assigned to serve ${customerName} on ${slotDate} at ${slotTime}.`,
                    is_read: false
                }]);
        }

        res.json({ success: true, message: 'Beautician assigned and notifications sent.' });

    } catch (error: any) {
        console.error('Error assigning beautician:', error);
        res.status(500).json({ success: false, message: 'Failed to assign beautician', error: error.message });
    }
});

export default router;
