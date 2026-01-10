import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { requireAuth, requireRole, AuthenticatedRequest, authenticateManager } from '../middleware/auth';


const router = Router();

// ==================== PROFILE MANAGEMENT ====================

// Get customer profile
router.get('/profile', requireAuth, requireRole(['CUSTOMER']), async (req: AuthenticatedRequest, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        id, first_name, last_name, email, phone, avatar, created_at,
        addresses (*)
      `)

      .eq('id', req.user!.id)
      .single();

    if (error) throw error;

    // Transform to match expected format
    const transformedUser = {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      createdAt: user.created_at,
      addresses: user.addresses?.filter((a: any) => a.is_default).slice(0, 1).map((a: any) => ({
        ...a,
        isDefault: a.is_default,
        zipCode: a.zip_code,
        userId: a.user_id
      })) || [],
      _count: {
        bookings: 0,
        payments: 0
      }

    };

    res.json({ success: true, data: transformedUser });
  } catch (error: any) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch profile', error: error.message });
  }
});


// Update customer profile
router.put('/profile', requireAuth, requireRole(['CUSTOMER']), async (req: AuthenticatedRequest, res) => {
  try {
    const { firstName, lastName, phone, avatar } = req.body;

    const { data: user, error } = await supabase
      .from('users')
      .update({
        first_name: firstName,
        last_name: lastName,
        phone,
        ...(avatar && { avatar })
      })
      .eq('id', req.user!.id)
      .select('id, first_name, last_name, email, phone, avatar')
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
});

// ==================== ADDRESS MANAGEMENT ====================

// Get customer addresses
router.get('/addresses', requireAuth, requireRole(['CUSTOMER']), async (req: AuthenticatedRequest, res) => {
  try {
    const { data: addresses, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', req.user!.id)
      .order('is_default', { ascending: false });

    if (error) throw error;

    const transformed = (addresses || []).map((a: any) => ({
      ...a,
      isDefault: a.is_default,
      zipCode: a.zip_code,
      userId: a.user_id
    }));

    res.json({ success: true, data: transformed });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch addresses' });
  }
});

// Add new address
router.post('/addresses', requireAuth, requireRole(['CUSTOMER']), async (req: AuthenticatedRequest, res) => {
  try {
    const {
      type,
      name,
      street,
      city,
      state,
      zipCode,
      latitude,
      longitude,
      isDefault
    } = req.body;

    // If this is the default address, unset other defaults
    if (isDefault) {
      await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', req.user!.id)
        .eq('is_default', true);
    }

    const { data: address, error } = await supabase
      .from('addresses')
      .insert({
        user_id: req.user!.id,
        type,
        name,
        street,
        city,
        state,
        zip_code: zipCode,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        is_default: isDefault || false
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data: {
        ...address,
        isDefault: address.is_default,
        zipCode: address.zip_code,
        userId: address.user_id
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create address' });
  }
});

// Update address
router.put('/addresses/:id', requireAuth, requireRole(['CUSTOMER']), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const {
      type,
      name,
      street,
      city,
      state,
      zipCode,
      latitude,
      longitude,
      isDefault
    } = req.body;

    // Verify address belongs to user
    const { data: existingAddress } = await supabase
      .from('addresses')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.user!.id)
      .single();

    if (!existingAddress) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    // If this is the default address, unset other defaults
    if (isDefault) {
      await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', req.user!.id)
        .eq('is_default', true);
    }

    const { data: address, error } = await supabase
      .from('addresses')
      .update({
        type,
        name,
        street,
        city,
        state,
        zip_code: zipCode,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        is_default: isDefault || false
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data: {
        ...address,
        isDefault: address.is_default,
        zipCode: address.zip_code,
        userId: address.user_id
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update address' });
  }
});

// Delete address
router.delete('/addresses/:id', requireAuth, requireRole(['CUSTOMER']), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('addresses')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user!.id);

    if (error) throw error;

    res.json({ success: true, message: 'Address deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete address' });
  }
});

// ==================== APPOINTMENT BOOKING ====================

// Search available vendors
router.get('/vendors/search', requireAuth, requireRole(['CUSTOMER']), async (req: AuthenticatedRequest, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      location,
      date,
      time,
      search
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from('vendor')
      .select(`
        *,
        user:users!user_id (first_name, last_name),
        services (
          *,
          categories:service_categories (
            category:categories (*)
          )
        ),
        reviews (
          rating,
          customer:users!reviews_customer_id_fkey (first_name, last_name)
        )
      `, { count: 'exact' })
      .eq('status', 'APPROVED')
      .order('created_at', { ascending: false })
      .range(skip, skip + Number(limit) - 1);

    if (search) {
      query = query.or(`shopName.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Note: Complex filtering like category filtering on related tables is hard in one query with Supabase
    // For now, we'll fetch and filter in memory if category is provided, or rely on client side filtering
    // Ideally we'd use a search index or RPC

    const { data: vendors, count, error } = await query;

    if (error) throw error;

    let filteredVendors = vendors || [];

    if (category) {
      filteredVendors = filteredVendors.filter((v: any) =>
        v.services?.some((s: any) =>
          s.categories?.some((c: any) =>
            c.category?.name?.toLowerCase().includes((category as string).toLowerCase())
          )
        )
      );
    }

    // Calculate average ratings
    const vendorsWithRating = filteredVendors.map((vendor: any) => {
      const avgRating = vendor.reviews && vendor.reviews.length > 0
        ? vendor.reviews.reduce((sum: number, review: any) => sum + (review.rating || 0), 0) / vendor.reviews.length
        : 0;

      return {
        ...vendor,
        avgRating,
        reviewCount: vendor.reviews?.length || 0,
        user: vendor.user ? {
          firstName: vendor.user.first_name,
          lastName: vendor.user.last_name
        } : null
      };
    });

    res.json({
      success: true,
      data: vendorsWithRating,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        pages: Math.ceil((count || 0) / Number(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to search vendors' });
  }
});

// Get vendor details
router.get('/vendors/:id', requireAuth, requireRole(['CUSTOMER']), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const { data: vendor, error } = await supabase
      .from('vendor')
      .select(`
        *,
        user:users!user_id (first_name, last_name, phone),
        services (
          *,
          categories:service_categories (
            category:categories (*)
          ),
          addons:service_addons (
            addon:addons (*)
          )
        ),
        reviews (
          rating,
          created_at,
          customer:users!reviews_customer_id_fkey (first_name, last_name, avatar)
        )
      `)
      .eq('id', id)
      .eq('status', 'APPROVED')
      .single();

    if (error || !vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    // Calculate average rating
    const avgRating = vendor.reviews && vendor.reviews.length > 0
      ? vendor.reviews.reduce((sum: number, review: any) => sum + (review.rating || 0), 0) / vendor.reviews.length
      : 0;

    const transformedVendor = {
      ...vendor,
      avgRating,
      reviewCount: vendor.reviews?.length || 0,
      user: vendor.user ? {
        firstName: vendor.user.first_name,
        lastName: vendor.user.last_name,
        phone: vendor.user.phone
      } : null,
      services: (vendor.services || []).map((s: any) => ({
        ...s,
        isActive: s.isActive
      })),
      reviews: (vendor.reviews || []).map((r: any) => ({
        ...r,
        createdAt: r.created_at,
        customer: r.customer ? {
          firstName: r.customer.first_name,
          lastName: r.customer.last_name,
          avatar: r.customer.avatar
        } : null
      }))
    };

    res.json({
      success: true,
      data: transformedVendor
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch vendor details' });
  }
});

// Check vendor availability
router.get('/vendors/:id/availability', requireAuth, requireRole(['CUSTOMER']), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ success: false, message: 'Date is required' });
    }

    const targetDate = new Date(date as string).toISOString().split('T')[0];

    const { data: slots, error } = await supabase
      .from('vendor_slots')
      .select('*')
      .eq('vendor_id', id)
      .eq('date', targetDate)
      .eq('status', 'AVAILABLE')
      .order('start_time', { ascending: true });

    if (error) throw error;

    const transformedSlots = (slots || []).map((s: any) => ({
      ...s,
      vendorId: s.vendor_id,
      startTime: s.start_time,
      endTime: s.end_time,
      bookingId: s.booking_id
    }));

    res.json({ success: true, data: transformedSlots });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch availability' });
  }
});

// Book appointment
router.post('/bookings', requireAuth, requireRole(['CUSTOMER']), async (req: AuthenticatedRequest, res) => {
  try {
    const {
      vendorId,
      scheduledDate,
      scheduledTime,
      addressId,
      services,
      notes
    } = req.body;

    // Validate required fields
    if (!vendorId || !scheduledDate || !scheduledTime || !addressId || !services) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Verify vendor exists and is approved
    const { data: vendor } = await supabase
      .from('vendor')
      .select('id')
      .eq('id', vendorId)
      .eq('status', 'APPROVED')
      .single();

    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    // Verify address belongs to user
    const { data: address } = await supabase
      .from('addresses')
      .select('id')
      .eq('id', addressId)
      .eq('user_id', req.user!.id)
      .single();

    if (!address) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    // Calculate total price
    let subtotal = 0;
    const serviceIds = services.map((s: any) => s.serviceId);
    const { data: serviceDetails } = await supabase
      .from('services')
      .select('id, price')
      .in('id', serviceIds);

    const serviceMap = new Map((serviceDetails || []).map((s: any) => [s.id, s.price]));

    for (const service of services) {
      const price = serviceMap.get(service.serviceId) || 0;
      subtotal += price * service.quantity;
    }

    const tax = subtotal * 0.1; // 10% tax
    const total = subtotal + tax;

    // Create booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        customer_id: req.user!.id,
        vendor_id: vendorId,
        booking_type: 'AT_HOME',
        scheduled_date: new Date(scheduledDate).toISOString(),
        scheduled_time: scheduledTime,
        duration: 60, // Default duration
        subtotal,
        tax,
        total,
        address_id: addressId,
        notes,
        status: 'PENDING'
      })
      .select()
      .single();

    if (bookingError) throw bookingError;

    // Create booking items
    const bookingItems = services.map((service: any) => ({
      booking_id: booking.id,
      service_id: service.serviceId,
      quantity: service.quantity,
      price: serviceMap.get(service.serviceId) || 0
    }));

    const { error: itemsError } = await supabase
      .from('booking_items')
      .insert(bookingItems);

    if (itemsError) throw itemsError;

    // Reserve the time slot
    await supabase
      .from('vendor_slots')
      .update({
        status: 'BOOKED',
        booking_id: booking.id
      })
      .eq('vendor_id', vendorId)
      .eq('date', new Date(scheduledDate).toISOString().split('T')[0])
      .eq('start_time', scheduledTime)
      .eq('status', 'AVAILABLE');

    res.status(201).json({
      success: true,
      data: {
        ...booking,
        customerId: booking.customer_id,
        vendorId: booking.vendor_id,
        bookingType: booking.booking_type,
        scheduledDate: booking.scheduled_date,
        scheduledTime: booking.scheduled_time,
        addressId: booking.address_id
      }
    });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ success: false, message: 'Failed to create booking' });
  }
});

// ==================== BOOKING MANAGEMENT ====================

// Get customer bookings (Updated for At-Home Phase 2 - Separate Queries Strategy)
// Get all customer bookings (Salon + At-Home)
router.get('/bookings', requireAuth, requireRole(['CUSTOMER']), async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const userEmail = req.user!.email;

    // 1. Fetch SALON bookings from vendor_orders (linked by email)
    // Using ilike for robust email matching
    const { data: salonData, error: salonError } = await supabase
      .from('vendor_orders')
      .select(`*, vendor:vendor!vendor_id(*)`)
      .ilike('customer_email', userEmail)
      .order('created_at', { ascending: false });

    if (salonError) {
      console.error('Error fetching salon bookings:', salonError);
    }

    // 2. Fetch AT-HOME bookings
    // Using service role client (supabase) ensures RLS bypass
    // Also ensuring we get related data safely
    const { data: athomeData, error: athomeError } = await supabase
      .from('athome_bookings')
      .select(`
          *,
          beautician:beauticians!athome_bookings_assigned_beautician_id_fkey (*)
      `)
      .eq('customer_id', userId)
      .order('created_at', { ascending: false });

    if (athomeError) {
      console.error('Error fetching athome bookings:', athomeError);
    }

    // Return the raw data arrays - frontend will process them
    res.json({
      success: true,
      data: {
        salonBookings: salonData || [],
        atHomeBookings: athomeData || []
      }
    });

  } catch (error: any) {
    console.error('Error fetching customer bookings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch bookings', error: error.message });
  }
});

// Get At-Home Booking Details
router.get('/athome-bookings/:id', requireAuth, requireRole(['CUSTOMER']), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const customerId = req.user!.id;

    const { data: booking, error } = await supabase
      .from('athome_bookings')
      .select(`
                *,
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
      .eq('id', id)
      .eq('customer_id', customerId)
      .single();

    if (error || !booking) {
      console.error("Error fetching at-home details:", error)
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Manual Fetch Live Updates (workaround for earlier issue)
    const { data: updates } = await supabase
      .from('booking_live_updates')
      .select('*')
      .eq('booking_id', id)
      .order('created_at', { ascending: true });

    const responseData = {
      ...booking,
      live_updates: updates || []
    };

    res.json({ success: true, data: responseData });

  } catch (error: any) {
    console.error('Error fetching at-home booking details:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch details' });
  }
});

// NEW ENDPOINT: Customer marks service as completed
router.post('/athome-bookings/:id/complete', requireAuth, requireRole(['CUSTOMER']), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const customerId = req.user!.id;

    console.log('🏁 Completing At-Home Booking:', id);

    // Call Atomic RPC Transaction
    const { data: rpcResult, error: rpcError } = await supabase.rpc('complete_at_home_service_transaction', {
      p_booking_id: id,
      p_customer_id: customerId
    });

    if (rpcError) {
      console.error('RPC Error details:', rpcError);
      throw new Error(rpcError.message);
    }

    const result = rpcResult as { success: boolean; message?: string };

    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message || 'Failed to complete service' });
    }

    res.json({ success: true, message: 'Service completed successfully' });
    return;











  } catch (error: any) {
    console.error('Error completing booking:', error);
    res.status(500).json({ success: false, message: 'Failed to complete booking' });
  }
});

// Get booking details (Legacy/Salon)
router.get('/bookings/:id', requireAuth, requireRole(['CUSTOMER']), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        *,
        vendor:vendor!bookings_vendor_id_fkey (
          *,
          user:users!user_id (*)
        ),
        employee:employees (
          id, name, role, phone
        ),
        items:booking_items (
          *,
          service:services (*),
          addons:booking_item_addons (
            addon:addons (*)
          )
        ),
        address:addresses (*),
        payments (*),
        events:booking_events (*)
      `)
      .eq('id', id)
      .eq('customer_id', req.user!.id)
      .single();

    if (error || !booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const transformedBooking = {
      ...booking,
      customerId: booking.customer_id,
      vendorId: booking.vendor_id,
      scheduledDate: booking.scheduled_date,
      scheduledTime: booking.scheduled_time,
      addressId: booking.address_id,
      cancellationReason: booking.cancellation_reason,
      vendor: booking.vendor ? {
        ...booking.vendor,
        shopName: booking.vendor.shopName,
        user: booking.vendor.user ? {
          firstName: booking.vendor.user.first_name,
          lastName: booking.vendor.user.last_name,
          phone: booking.vendor.user.phone,
          email: booking.vendor.user.email
        } : null
      } : null,
      address: booking.address ? {
        ...booking.address,
        zipCode: booking.address.zip_code,
        userId: booking.address.user_id
      } : null,
      events: (booking.events || []).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    };

    res.json({ success: true, data: transformedBooking });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch booking details' });
  }
});

// Cancel booking
router.patch('/bookings/:id/cancel', requireAuth, requireRole(['CUSTOMER']), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const { data: booking } = await supabase
      .from('bookings')
      .select('status')
      .eq('id', id)
      .eq('customer_id', req.user!.id)
      .single();

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (['COMPLETED', 'CANCELLED'].includes(booking.status)) {
      return res.status(400).json({ success: false, message: 'Booking cannot be cancelled' });
    }

    const { data: updatedBooking, error } = await supabase
      .from('bookings')
      .update({
        status: 'CANCELLED',
        cancellation_reason: reason || 'Cancelled by customer'
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Free up the time slot
    await supabase
      .from('vendor_slots')
      .update({
        status: 'AVAILABLE',
        booking_id: null
      })
      .eq('booking_id', id);

    // Create booking event
    await supabase
      .from('booking_events')
      .insert({
        booking_id: id,
        type: 'CANCELLED',
        data: JSON.stringify({ reason, cancelledBy: 'CUSTOMER' })
      });

    res.json({
      success: true,
      data: {
        ...updatedBooking,
        cancellationReason: updatedBooking.cancellation_reason
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to cancel booking' });
  }
});

// ==================== PAYMENT HISTORY ====================

// Get payment history
router.get('/payments', requireAuth, requireRole(['CUSTOMER']), async (req: AuthenticatedRequest, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from('payments')
      .select(`
        *,
        booking:bookings (
          vendor:vendor (
            id, shopName
          )
        )
      `, { count: 'exact' })
      .eq('user_id', req.user!.id)
      .order('created_at', { ascending: false })
      .range(skip, skip + Number(limit) - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: payments, count, error } = await query;

    if (error) throw error;

    const transformedPayments = (payments || []).map((p: any) => ({
      ...p,
      userId: p.user_id,
      bookingId: p.booking_id,
      createdAt: p.created_at,
      booking: p.booking ? {
        ...p.booking,
        vendor: p.booking.vendor ? {
          id: p.booking.vendor.id,
          shopName: p.booking.vendor.shopName
        } : null
      } : null
    }));

    res.json({
      success: true,
      data: transformedPayments,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        pages: Math.ceil((count || 0) / Number(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch payments' });
  }
});


// ==================== AT-HOME SERVICES – PHASE 1 (CUSTOMER) ====================

/**
 * @api {get} /api/customer/athome/services Get At-Home Services (Customer)
 * @apiDescription Rules: Fetch ONLY from admin tables, Filter: is_active = true
 */
router.get('/athome/services', requireAuth, requireRole(['CUSTOMER']), async (req, res) => {
  try {
    console.log('🏠 Fetching active At-Home services for customer...');

    // Fetch ONLY from admin tables
    // Filter: is_active = true
    const { data, error } = await supabase
      .from('admin_services')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('❌ Supabase error fetching at-home services:', error);
      throw error;
    }

    res.json({
      success: true,
      data: data || []
    });
  } catch (error: any) {
    console.error('SERVER ERROR (Customer At-Home Services):', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available at-home services',
      error: error.message
    });
  }
});

/**
 * @api {get} /api/customer/athome/products Get At-Home Products (Customer)
 * @apiDescription Rules: Fetch ONLY from admin tables, Filter: is_active = true
 */
router.get('/athome/products', requireAuth, requireRole(['CUSTOMER']), async (req, res) => {
  try {
    console.log('📦 Fetching active At-Home products for customer...');

    // Fetch ONLY from admin tables
    // Filter: is_active = true
    const { data, error } = await supabase
      .from('admin_products')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('❌ Supabase error fetching at-home products:', error);
      throw error;
    }

    res.json({
      success: true,
      data: data || []
    });
  } catch (error: any) {
    console.error('SERVER ERROR (Customer At-Home Products):', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available at-home products',
      error: error.message
    });
  }
});


// ==================== AT-HOME BOOKING (PHASE 2) ====================

// Customer creates a new At-Home Booking (Phase 2 - Updated Transactional with VAT)
router.post('/athome/book', requireAuth, requireRole(['CUSTOMER']), async (req: AuthenticatedRequest, res) => {
  try {
    const { slot, preferences, address, services, products } = req.body;
    const customerId = req.user!.id;

    console.log('📝 Creating new At-Home Booking (VAT ENABLED):', customerId);

    // 1. RE-CALCULATE TOTALS (Backend Verification)
    // Assume input prices are BASE PRICES (from Admin Catalog)
    let baseTotal = 0;

    if (services && services.length > 0) {
      baseTotal += services.reduce((sum: number, s: any) => sum + (Number(s.price) || 0), 0);
    }

    if (products && products.length > 0) {
      baseTotal += products.reduce((sum: number, p: any) => sum + ((Number(p.price) || 0) * (p.quantity || 1)), 0);
    }

    // VAT Logic (16%)
    const vatRate = 0.16;
    const vatAmount = baseTotal * vatRate;
    const totalPaidAmount = baseTotal + vatAmount;

    // Internal Splits (on Base Price)
    const commissionRate = 0.15;
    const platformCommission = baseTotal * commissionRate;
    const vendorPayout = baseTotal - platformCommission; // 85%

    // Start Transaction
    const { error: txError } = await supabase.rpc('begin');
    if (txError) console.warn('⚠️ Transaction BEGIN failed (ignoring):', txError.message);

    try {
      // 2. Create Booking (Master)
      const { data: booking, error: bookingError } = await supabase
        .from('athome_bookings')
        .insert({
          customer_id: customerId,
          total_amount: totalPaidAmount, // Customer pays Base + VAT
          base_amount: baseTotal,
          vat_amount: vatAmount,
          platform_commission: platformCommission,
          vendor_payout_amount: vendorPayout,
          slot,
          preferences: preferences || {},
          address,
          payment_status: 'SUCCESS',
          status: 'PENDING',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (bookingError) throw bookingError;
      const bookingId = booking.id;

      // 3. Insert Products
      if (products && products.length > 0) {
        const productsData = products.map((p: any) => ({
          booking_id: bookingId,
          admin_product_id: p.id,
          quantity: p.quantity || 1,
          product_price: p.price, // Store Base Price
          status: 'PENDING'
        }));

        const { error: productsError } = await supabase
          .from('athome_booking_products')
          .insert(productsData);

        if (productsError) throw productsError;
      }

      // 4. Insert Services
      if (services && services.length > 0) {
        const servicesData = services.map((s: any) => ({
          booking_id: bookingId,
          admin_service_id: s.id,
          service_price: s.price, // Store Base Price
          duration_minutes: s.duration || 60,
          gender_preference: s.genderPreference || 'any',
          status: 'PENDING'
        }));

        const { error: servicesError } = await supabase
          .from('athome_booking_services')
          .insert(servicesData);

        if (servicesError) throw servicesError;
      }

      // 5. Insert Payment
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          booking_id: bookingId,
          customer_id: customerId,
          amount: totalPaidAmount,
          payment_method: 'MOCK_CARD',
          status: 'SUCCESS',
          created_at: new Date().toISOString()
        });

      if (paymentError) throw paymentError;

      // 6. Create Live Update
      await supabase
        .from('booking_live_updates')
        .insert({
          booking_id: booking.id,
          status: 'PAYMENT_SUCCESSFUL',
          message: `Payment of $${totalPaidAmount.toFixed(2)} (inc. $${vatAmount.toFixed(2)} VAT) verified.`,
          updated_by: customerId,
          customer_visible: true
        });

      // --- SEND EMAIL NOTIFICATION (Simplified) ---
      // ... (Email logic omitted for brevity)

      await supabase.rpc('commit');

      res.status(201).json({
        success: true,
        data: {
          bookingId: booking.id,
          financials: {
            base: baseTotal,
            vat: vatAmount,
            total: totalPaidAmount
          }
        }
      });

    } catch (err: any) {
      console.error('Processing error, rolling back:', err);
      await supabase.rpc('rollback');
      throw err;
    }

  } catch (error: any) {
    console.error('SERVER ERROR (Create At-Home Booking):', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create booking',
      error: error.message || 'Unknown error'
    });
  }
});

// Get At-Home booking details
router.get('/athome-bookings/:id', requireAuth, requireRole(['CUSTOMER']), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const customerId = req.user!.id;

    const { data: booking, error } = await supabase
      .from('athome_bookings')
      .select(`
                *,
                beautician:beauticians!athome_bookings_assigned_beautician_id_fkey(*),
                services:athome_booking_services(
                    *,
                    master:admin_services(id, name, duration, price)
                ),
                products:athome_booking_products(
                    *,
                    master:admin_products(id, name, price, image_url)
                ),
                live_updates:booking_live_updates(
                    id, status, message, created_at, updated_by
                )
            `)
      .eq('id', id)
      .eq('customer_id', customerId)
      .single();

    if (error || !booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Sort live updates
    if (booking.live_updates) {
      booking.live_updates.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }

    res.json({
      success: true,
      data: booking
    });

  } catch (error: any) {
    console.error('Error fetching at-home booking details:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch booking details' });
  }
});


// ==================== END OF ROUTES ====================

export default router;
