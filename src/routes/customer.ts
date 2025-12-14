import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// ==================== PROFILE MANAGEMENT ====================

// Get customer profile
router.get('/profile', requireAuth, requireRole(['CUSTOMER']), async (req: AuthenticatedRequest, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        id, first_name, last_name, email, phone, avatar, created_at,
        addresses (*),
        bookings (count),
        payments (count)
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
        bookings: user.bookings?.[0]?.count || 0,
        payments: user.payments?.[0]?.count || 0
      }
    };

    res.json({ success: true, data: transformedUser });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
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

// Get customer bookings
router.get('/bookings', async (req: any, res) => {
  try {
    const { page = 1, limit = 10, status, userId } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const customerId = userId || 'temp-customer-id';

    let query = supabase
      .from('bookings')
      .select(`
        *,
        vendor:vendor!bookings_vendor_id_fkey (
          id, shopName,
          user:users!user_id (first_name, last_name)
        ),
        employee:employees (
          id, name, role, phone
        ),
        items:booking_items (
          *,
          service:services (*)
        ),
        address:addresses (*)
      `, { count: 'exact' })
      .eq('customer_id', customerId)
      .order('scheduled_date', { ascending: false })
      .range(skip, skip + Number(limit) - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: bookings, count, error } = await query;

    if (error) throw error;

    const transformedBookings = (bookings || []).map((b: any) => ({
      ...b,
      customerId: b.customer_id,
      vendorId: b.vendor_id,
      scheduledDate: b.scheduled_date,
      scheduledTime: b.scheduled_time,
      addressId: b.address_id,
      vendor: b.vendor ? {
        ...b.vendor,
        user: b.vendor.user ? {
          firstName: b.vendor.user.first_name,
          lastName: b.vendor.user.last_name
        } : null
      } : null,
      address: b.address ? {
        ...b.address,
        zipCode: b.address.zip_code,
        userId: b.address.user_id
      } : null
    }));

    res.json({
      success: true,
      data: transformedBookings,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        pages: Math.ceil((count || 0) / Number(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch bookings' });
  }
});

// Get booking details
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

export default router;