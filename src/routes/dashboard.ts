import express from 'express';
import { supabase } from '../lib/supabase';

const router = express.Router();

// User Dashboard endpoints
router.get('/user/stats', async (req, res) => {
  try {
    const userId = req.query.userId as string;

    const [
      { count: activeBookings },
      { count: completedBookings },
      { count: pendingPayments },
      { count: totalBookings }
    ] = await Promise.all([
      supabase.from('bookings').select('*', { count: 'exact', head: true })
        .eq('customer_id', userId)
        .in('status', ['PENDING', 'CONFIRMED', 'IN_PROGRESS']),
      supabase.from('bookings').select('*', { count: 'exact', head: true })
        .eq('customer_id', userId)
        .eq('status', 'COMPLETED'),
      supabase.from('payments').select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'PENDING'),
      supabase.from('bookings').select('*', { count: 'exact', head: true })
        .eq('customer_id', userId)
    ]);

    res.json({
      activeBookings: activeBookings || 0,
      completedBookings: completedBookings || 0,
      pendingPayments: pendingPayments || 0,
      totalBookings: totalBookings || 0
    });
  } catch (error) {
    console.error('User stats error:', error);
    res.status(500).json({ error: 'Failed to fetch user stats' });
  }
});

router.get('/user/bookings', async (req, res) => {
  try {
    const userId = req.query.userId as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const { data: bookings, count, error } = await supabase
      .from('bookings')
      .select(`
        *,
        vendor:vendor!bookings_vendor_id_fkey (
          id, shopName,
          user:users!user_id (first_name, last_name)
        ),
        items:booking_items (
          *,
          service:services (*)
        ),
        payments (*)
      `, { count: 'exact' })
      .eq('customer_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const transformedBookings = (bookings || []).map((booking: any) => ({
      ...booking,
      customerId: booking.customer_id,
      vendorId: booking.vendor_id,
      createdAt: booking.created_at,
      vendor: booking.vendor ? {
        ...booking.vendor,
        user: booking.vendor.user ? {
          firstName: booking.vendor.user.first_name,
          lastName: booking.vendor.user.last_name
        } : null
      } : null
    }));

    res.json({
      bookings: transformedBookings,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    console.error('User bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch user bookings' });
  }
});

// Vendor Dashboard endpoints
router.get('/vendor/stats', async (req, res) => {
  try {
    const vendorId = req.query.vendorId as string;

    const [
      { count: newBookings },
      { count: completedServices },
      { count: totalServices }
    ] = await Promise.all([
      supabase.from('bookings').select('*', { count: 'exact', head: true })
        .eq('vendor_id', vendorId)
        .in('status', ['PENDING', 'CONFIRMED']),
      supabase.from('bookings').select('*', { count: 'exact', head: true })
        .eq('vendor_id', vendorId)
        .eq('status', 'COMPLETED'),
      supabase.from('services').select('*', { count: 'exact', head: true })
        .eq('vendor_id', vendorId)
    ]);

    // Calculate revenue manually
    const { data: payments } = await supabase
      .from('payments')
      .select('amount, booking:bookings!inner(vendor_id)')
      .eq('status', 'COMPLETED')
      .eq('booking.vendor_id', vendorId);

    const totalRevenue = (payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    res.json({
      newBookings: newBookings || 0,
      completedServices: completedServices || 0,
      monthlyRevenue: totalRevenue,
      totalServices: totalServices || 0
    });
  } catch (error) {
    console.error('Vendor stats error:', error);
    res.status(500).json({ error: 'Failed to fetch vendor stats' });
  }
});

router.get('/vendor/services', async (req, res) => {
  try {
    const vendorId = req.query.vendorId as string;

    const { data: services, error } = await supabase
      .from('services')
      .select(`
        *,
        categories:service_categories (
          category:categories (*)
        )
      `)
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(services);
  } catch (error) {
    console.error('Vendor services error:', error);
    res.status(500).json({ error: 'Failed to fetch vendor services' });
  }
});

router.get('/vendor/appointments', async (req, res) => {
  try {
    const vendorId = req.query.vendorId as string;

    const { data: appointments, error } = await supabase
      .from('bookings')
      .select(`
        *,
        customer:users!bookings_customer_id_fkey (*),
        items:booking_items (
          *,
          service:services (*)
        )
      `)
      .eq('vendor_id', vendorId)
      .order('scheduled_date', { ascending: true });

    if (error) throw error;

    const transformedAppointments = (appointments || []).map((app: any) => ({
      ...app,
      scheduledDate: app.scheduled_date,
      customerId: app.customer_id,
      vendorId: app.vendor_id
    }));

    res.json(transformedAppointments);
  } catch (error) {
    console.error('Vendor appointments error:', error);
    res.status(500).json({ error: 'Failed to fetch vendor appointments' });
  }
});

// Beautician Dashboard endpoints
router.get('/beautician/stats', async (req, res) => {
  try {
    // const beauticianId = req.query.beauticianId as string;
    // Note: Beautician logic might need adjustment based on how they are linked to bookings
    // Assuming employee_id in bookings table links to employees table, and employees table links to users?
    // Or if beauticianId is directly in bookings?
    // Based on schema, bookings has employee_id.

    // For now, returning mock data or empty stats if schema isn't fully clear on beautician user link
    // Assuming beauticianId passed is actually an employee_id or we need to look it up

    res.json({
      upcomingAppointments: 0,
      completedServices: 0,
      totalEarnings: 0
    });
  } catch (error) {
    console.error('Beautician stats error:', error);
    res.status(500).json({ error: 'Failed to fetch beautician stats' });
  }
});

router.get('/beautician/appointments', async (req, res) => {
  try {
    // const beauticianId = req.query.beauticianId as string;
    res.json([]);
  } catch (error) {
    console.error('Beautician appointments error:', error);
    res.status(500).json({ error: 'Failed to fetch beautician appointments' });
  }
});

// Manager Dashboard endpoints
router.get('/manager/stats', async (req, res) => {
  try {
    const [
      { count: pendingVendorApplications },
      { count: pendingBeauticianApplications },
      { count: totalActiveVendors },
      { count: appointmentsOverview }
    ] = await Promise.all([
      supabase.from('vendor').select('*', { count: 'exact', head: true }).eq('status', 'PENDING_APPROVAL'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'BEAUTICIAN').eq('status', 'PENDING'),
      supabase.from('vendor').select('*', { count: 'exact', head: true }).eq('status', 'APPROVED'),
      supabase.from('bookings').select('*', { count: 'exact', head: true }).in('status', ['PENDING', 'CONFIRMED', 'IN_PROGRESS'])
    ]);

    res.json({
      pendingVendorApplications: pendingVendorApplications || 0,
      pendingBeauticianApplications: pendingBeauticianApplications || 0,
      totalActiveVendors: totalActiveVendors || 0,
      appointmentsOverview: appointmentsOverview || 0
    });
  } catch (error) {
    console.error('Manager stats error:', error);
    res.status(500).json({ error: 'Failed to fetch manager stats' });
  }
});

router.get('/manager/pending-approvals', async (req, res) => {
  try {
    const [
      { data: pendingVendors },
      { data: pendingBeauticians }
    ] = await Promise.all([
      supabase.from('vendor')
        .select('*, user:users!user_id(*)')
        .eq('status', 'PENDING_APPROVAL')
        .order('created_at', { ascending: false }),
      supabase.from('users')
        .select('*')
        .eq('role', 'BEAUTICIAN')
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false })
    ]);

    res.json({
      pendingVendors: pendingVendors || [],
      pendingBeauticians: pendingBeauticians || []
    });
  } catch (error) {
    console.error('Manager pending approvals error:', error);
    res.status(500).json({ error: 'Failed to fetch pending approvals' });
  }
});

router.post('/manager/approve-vendor/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'approve' or 'reject'

    const { data: vendor, error } = await supabase
      .from('vendor')
      .update({
        status: action === 'approve' ? 'APPROVED' : 'REJECTED'
      })
      .eq('id', id)
      .select('*, user:users!user_id(*)')
      .single();

    if (error) throw error;

    res.json(vendor);
  } catch (error) {
    console.error('Approve vendor error:', error);
    res.status(500).json({ error: 'Failed to update vendor status' });
  }
});

router.post('/manager/approve-beautician/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'approve' or 'reject'

    const { data: beautician, error } = await supabase
      .from('users')
      .update({
        status: action === 'approve' ? 'ACTIVE' : 'SUSPENDED'
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json(beautician);
  } catch (error) {
    console.error('Approve beautician error:', error);
    res.status(500).json({ error: 'Failed to update beautician status' });
  }
});

// Admin Dashboard endpoints
router.get('/admin/stats', async (req, res) => {
  try {
    const [
      { count: totalUsers },
      { count: totalVendors },
      { count: totalBeauticians },
      { count: pendingVendors },
      { count: pendingBeauticians }
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('vendor').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'BEAUTICIAN'),
      supabase.from('vendor').select('*', { count: 'exact', head: true }).eq('status', 'PENDING_APPROVAL'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'BEAUTICIAN').eq('status', 'PENDING')
    ]);

    const { data: payments } = await supabase
      .from('payments')
      .select('amount')
      .eq('status', 'COMPLETED');

    const totalRevenue = (payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    res.json({
      totalUsers: totalUsers || 0,
      totalVendors: totalVendors || 0,
      totalBeauticians: totalBeauticians || 0,
      pendingApprovals: (pendingVendors || 0) + (pendingBeauticians || 0),
      totalRevenue
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

router.get('/admin/revenue-chart', async (req, res) => {
  try {
    // const { period = 'monthly' } = req.query;

    // Fetch all completed payments and aggregate in JS
    const { data: payments, error } = await supabase
      .from('payments')
      .select('amount, created_at')
      .eq('status', 'COMPLETED')
      .gte('created_at', new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString()); // Last 12 months

    if (error) throw error;

    const revenueMap = new Map();
    (payments || []).forEach((p: any) => {
      const month = p.created_at.substring(0, 7); // YYYY-MM
      const amount = Number(p.amount) || 0;
      revenueMap.set(month, (revenueMap.get(month) || 0) + amount);
    });

    const revenueData = Array.from(revenueMap.entries())
      .map(([month, revenue]) => ({ month, revenue }))
      .sort((a, b) => a.month.localeCompare(b.month));

    res.json(revenueData);
  } catch (error) {
    console.error('Revenue chart error:', error);
    res.status(500).json({ error: 'Failed to fetch revenue data' });
  }
});

router.get('/admin/bookings-distribution', async (req, res) => {
  try {
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('status');

    if (error) throw error;

    const distributionMap = new Map();
    (bookings || []).forEach((b: any) => {
      distributionMap.set(b.status, (distributionMap.get(b.status) || 0) + 1);
    });

    const distribution = Array.from(distributionMap.entries())
      .map(([status, count]) => ({ status, _count: { id: count } }));

    res.json(distribution);
  } catch (error) {
    console.error('Bookings distribution error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings distribution' });
  }
});

router.get('/admin/vendor-management', async (req, res) => {
  try {
    const { data: vendors, error } = await supabase
      .from('vendor')
      .select('*, user:users!user_id(*)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(vendors);
  } catch (error) {
    console.error('Vendor management error:', error);
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
});

router.get('/admin/beautician-management', async (req, res) => {
  try {
    const { data: beauticians, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'BEAUTICIAN')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(beauticians);
  } catch (error) {
    console.error('Beautician management error:', error);
    res.status(500).json({ error: 'Failed to fetch beauticians' });
  }
});

router.get('/admin/user-overview', async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    res.json(users);
  } catch (error) {
    console.error('User overview error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

export default router;
