import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// ==================== ORDER MANAGEMENT ====================

// Create new order
router.post('/', requireAuth, requireRole(['CUSTOMER']), async (req: AuthenticatedRequest, res) => {
  try {
    const { items, shippingAddress, paymentMethod, totalAmount } = req.body;

    // Validate items
    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Order must contain at least one item' });
    }

    // Start "transaction" (sequential operations)
    // Create the order
    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_id: req.user!.id,
        total_amount: parseFloat(totalAmount),
        status: 'PENDING',
        shipping_address: JSON.stringify(shippingAddress),
        payment_method: paymentMethod
      })
      .select()
      .single();

    if (orderError) throw orderError;
    if (!newOrder) throw new Error('Failed to create order');

    // Create order items
    const orderItems = items.map((item: any) => ({
      order_id: newOrder.id,
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: parseFloat(item.unitPrice),
      total_price: parseFloat(item.totalPrice)
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      // Rollback order creation if items fail (manual rollback)
      await supabase.from('orders').delete().eq('id', newOrder.id);
      throw itemsError;
    }

    // Create initial delivery event
    await supabase
      .from('delivery_events')
      .insert({
        order_id: newOrder.id,
        status: 'PENDING',
        note: 'Order created and pending payment',
        data: JSON.stringify({
          orderId: newOrder.id,
          customerId: req.user!.id,
          totalAmount: newOrder.total_amount
        })
      });

    // Fetch complete order to return
    const { data: completeOrder, error: fetchError } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items (
          *,
          product:product_catalog (
            *,
            vendor:vendor (
              id, shopName
            )
          )
        )
      `)
      .eq('id', newOrder.id)
      .single();

    if (fetchError) throw fetchError;

    // Transform to camelCase
    const transformedOrder = {
      ...completeOrder,
      customerId: completeOrder.customer_id,
      totalAmount: completeOrder.total_amount,
      shippingAddress: completeOrder.shipping_address,
      paymentMethod: completeOrder.payment_method,
      createdAt: completeOrder.created_at,
      updatedAt: completeOrder.updated_at,
      items: completeOrder.items.map((item: any) => ({
        ...item,
        orderId: item.order_id,
        productId: item.product_id,
        unitPrice: item.unit_price,
        totalPrice: item.total_price,
        product: item.product ? {
          ...item.product,
          vendorPayout: item.product.vendorPayout,
          customerPrice: item.product.customerPrice,
          vendor: item.product.vendor ? {
            id: item.product.vendor.id,
            shopName: item.product.vendor.shopName
          } : null
        } : null
      }))
    };

    res.status(201).json({
      success: true,
      data: transformedOrder
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ success: false, message: 'Failed to create order' });
  }
});

// Get customer orders
router.get('/my-orders', requireAuth, requireRole(['CUSTOMER']), async (req: AuthenticatedRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;
    const skip = (page - 1) * limit;

    let query = supabase
      .from('orders')
      .select(`
        *,
        items:order_items (
          *,
          product:product_catalog (
            *,
            vendor:vendor (
              id, shopName
            )
          )
        ),
        delivery_events (
          *
        )
      `, { count: 'exact' })
      .eq('customer_id', req.user!.id)
      .order('created_at', { ascending: false })
      .range(skip, skip + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: orders, count, error } = await query;

    if (error) throw error;

    const transformedOrders = (orders || []).map((order: any) => ({
      ...order,
      customerId: order.customer_id,
      totalAmount: order.total_amount,
      shippingAddress: order.shipping_address,
      paymentMethod: order.payment_method,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      items: order.items.map((item: any) => ({
        ...item,
        orderId: item.order_id,
        productId: item.product_id,
        unitPrice: item.unit_price,
        totalPrice: item.total_price,
        product: item.product ? {
          ...item.product,
          vendorPayout: item.product.vendorPayout,
          customerPrice: item.product.customerPrice,
          vendor: item.product.vendor ? {
            id: item.product.vendor.id,
            shopName: item.product.vendor.shopName
          } : null
        } : null
      })),
      deliveryEvents: (order.delivery_events || [])
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 1) // Get latest delivery status
        .map((e: any) => ({
          ...e,
          orderId: e.order_id,
          createdAt: e.created_at
        }))
    }));

    res.json({
      success: true,
      data: {
        orders: transformedOrders,
        pagination: {
          page,
          limit,
          total: count || 0,
          pages: Math.ceil((count || 0) / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch orders' });
  }
});

// Get order details
router.get('/:id', requireAuth, requireRole(['CUSTOMER', 'VENDOR', 'ADMIN']), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    // Build query based on user role
    let query = supabase
      .from('orders')
      .select(`
        *,
        customer:users!customer_id (
          id, first_name, last_name, email, phone
        ),
        items:order_items (
          *,
          product:product_catalog (
            *,
            vendor:vendor (
              id, shopName, address, phone
            )
          )
        ),
        delivery_events (*),
        payment:payments (
          id, amount, status, method, created_at
        )
      `)
      .eq('id', id)
      .single();

    // Note: RLS should handle role-based access, but we can add extra checks if needed
    // For VENDOR, we might need to filter items or check if order contains vendor's products
    // But for simplicity in migration, we'll fetch and then check

    const { data: order, error } = await query;

    if (error || !order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Role-based access check
    if (req.user!.role === 'CUSTOMER' && order.customer_id !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    if (req.user!.role === 'VENDOR') {
      // Check if any item belongs to this vendor
      const { data: vendor } = await supabase
        .from('vendor')
        .select('id')
        .eq('user_id', req.user!.id)
        .single();

      if (!vendor) {
        return res.status(403).json({ success: false, message: 'Vendor profile not found' });
      }

      const hasVendorItems = order.items.some((item: any) => item.product?.vendor?.id === vendor.id);

      if (!hasVendorItems) {
        return res.status(403).json({ success: false, message: 'Unauthorized access to this order' });
      }
    }

    const transformedOrder = {
      ...order,
      customerId: order.customer_id,
      totalAmount: order.total_amount,
      shippingAddress: order.shipping_address,
      paymentMethod: order.payment_method,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      customer: order.customer ? {
        id: order.customer.id,
        firstName: order.customer.first_name,
        lastName: order.customer.last_name,
        email: order.customer.email,
        phone: order.customer.phone
      } : null,
      items: order.items.map((item: any) => ({
        ...item,
        orderId: item.order_id,
        productId: item.product_id,
        unitPrice: item.unit_price,
        totalPrice: item.total_price,
        product: item.product ? {
          ...item.product,
          vendorPayout: item.product.vendorPayout,
          customerPrice: item.product.customerPrice,
          vendor: item.product.vendor ? {
            id: item.product.vendor.id,
            shopName: item.product.vendor.shopName,
            address: item.product.vendor.address,
            phone: item.product.vendor.phone
          } : null
        } : null
      })),
      deliveryEvents: (order.delivery_events || [])
        .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map((e: any) => ({
          ...e,
          orderId: e.order_id,
          createdAt: e.created_at,
          data: e.data ? JSON.parse(e.data) : null
        })),
      payment: order.payment ? {
        ...order.payment,
        createdAt: order.payment.created_at
      } : null
    };

    res.json({
      success: true,
      data: transformedOrder
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch order' });
  }
});

// Cancel order
router.patch('/:id/cancel', requireAuth, requireRole(['CUSTOMER', 'ADMIN']), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Fetch order to check status and ownership
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('id, status, customer_id')
      .eq('id', id)
      .single();

    if (fetchError || !order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (req.user!.role === 'CUSTOMER' && order.customer_id !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    if (order.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Order is already cancelled' });
    }

    if (order.status === 'DELIVERED') {
      return res.status(400).json({ success: false, message: 'Cannot cancel delivered order' });
    }

    // Update order status
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({ status: 'CANCELLED' })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Create delivery event
    await supabase
      .from('delivery_events')
      .insert({
        order_id: id,
        status: 'CANCELLED',
        note: `Order cancelled${reason ? `: ${reason}` : ''}`,
        data: JSON.stringify({
          reason,
          cancelledBy: req.user!.role,
          cancelledAt: new Date()
        })
      });

    res.json({
      success: true,
      data: {
        ...updatedOrder,
        customerId: updatedOrder.customer_id,
        totalAmount: updatedOrder.total_amount,
        shippingAddress: updatedOrder.shipping_address,
        paymentMethod: updatedOrder.payment_method,
        createdAt: updatedOrder.created_at,
        updatedAt: updatedOrder.updated_at
      }
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel order' });
  }
});

// ==================== DELIVERY TRACKING ====================

// Update delivery status (Vendor/Admin only)
router.patch('/:id/delivery-status', requireAuth, requireRole(['VENDOR', 'ADMIN']), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;

    // Validate status
    const validStatuses = ['PENDING', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid delivery status' });
    }

    // Verify order exists
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('id, status')
      .eq('id', id)
      .single();

    if (fetchError || !order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Update order status if delivery is completed or failed
    let orderStatus = order.status;
    if (status === 'DELIVERED') {
      orderStatus = 'DELIVERED';
    } else if (status === 'FAILED') {
      orderStatus = 'FAILED';
    }

    // Update order
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({ status: orderStatus })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Create delivery event
    const { data: deliveryEvent, error: eventError } = await supabase
      .from('delivery_events')
      .insert({
        order_id: id,
        status,
        note: note || `Delivery status updated to ${status}`,
        data: JSON.stringify({
          status,
          note,
          updatedBy: req.user!.role,
          updatedAt: new Date()
        })
      })
      .select()
      .single();

    if (eventError) throw eventError;

    res.json({
      success: true,
      data: {
        order: {
          ...updatedOrder,
          customerId: updatedOrder.customer_id,
          totalAmount: updatedOrder.total_amount,
          shippingAddress: updatedOrder.shipping_address,
          paymentMethod: updatedOrder.payment_method,
          createdAt: updatedOrder.created_at,
          updatedAt: updatedOrder.updated_at
        },
        deliveryEvent: {
          ...deliveryEvent,
          orderId: deliveryEvent.order_id,
          createdAt: deliveryEvent.created_at
        }
      }
    });
  } catch (error) {
    console.error('Error updating delivery status:', error);
    res.status(500).json({ success: false, message: 'Failed to update delivery status' });
  }
});

// Get delivery timeline
router.get('/:id/delivery-timeline', requireAuth, requireRole(['CUSTOMER', 'VENDOR', 'ADMIN']), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        status,
        delivery_events (*)
      `)
      .eq('id', id)
      .single();

    if (error || !order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Format timeline events
    const timeline = (order.delivery_events || [])
      .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((event: any) => ({
        id: event.id,
        status: event.status,
        note: event.note,
        timestamp: event.created_at,
        data: event.data ? JSON.parse(event.data) : null
      }));

    res.json({
      success: true,
      data: {
        orderId: id,
        currentStatus: order.status,
        timeline
      }
    });
  } catch (error) {
    console.error('Error fetching delivery timeline:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch delivery timeline' });
  }
});

// ==================== ADMIN ORDER MANAGEMENT ====================

// Get all orders (Admin only)
router.get('/', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const customerId = req.query.customerId as string;
    const vendorId = req.query.vendorId as string;
    const skip = (page - 1) * limit;

    let query = supabase
      .from('orders')
      .select(`
        *,
        customer:users!customer_id (
          id, first_name, last_name, email
        ),
        items:order_items (
          *,
          product:product_catalog (
            *,
            vendor:vendor (
              id, shopName
            )
          )
        ),
        delivery_events (
          *
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(skip, skip + limit - 1);

    if (status) query = query.eq('status', status);
    if (customerId) query = query.eq('customer_id', customerId);

    // Vendor filtering is complex with nested relations in Supabase
    // We might need to filter after fetch or use a different approach
    // For now, let's fetch and filter if vendorId is present (not efficient but functional for migration)

    const { data: orders, count, error } = await query;

    if (error) throw error;

    let filteredOrders = orders || [];
    if (vendorId) {
      filteredOrders = filteredOrders.filter((order: any) =>
        order.items.some((item: any) => item.product?.vendor?.id === vendorId)
      );
    }

    const transformedOrders = filteredOrders.map((order: any) => ({
      ...order,
      customerId: order.customer_id,
      totalAmount: order.total_amount,
      shippingAddress: order.shipping_address,
      paymentMethod: order.payment_method,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      customer: order.customer ? {
        id: order.customer.id,
        firstName: order.customer.first_name,
        lastName: order.customer.last_name,
        email: order.customer.email
      } : null,
      items: order.items.map((item: any) => ({
        ...item,
        orderId: item.order_id,
        productId: item.product_id,
        unitPrice: item.unit_price,
        totalPrice: item.total_price,
        product: item.product ? {
          ...item.product,
          vendorPayout: item.product.vendorPayout,
          customerPrice: item.product.customerPrice,
          vendor: item.product.vendor ? {
            id: item.product.vendor.id,
            shopName: item.product.vendor.shopName
          } : null
        } : null
      })),
      deliveryEvents: (order.delivery_events || [])
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 1)
        .map((e: any) => ({
          ...e,
          orderId: e.order_id,
          createdAt: e.created_at
        }))
    }));

    res.json({
      success: true,
      data: {
        orders: transformedOrders,
        pagination: {
          page,
          limit,
          total: count || 0,
          pages: Math.ceil((count || 0) / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch orders' });
  }
});

// Update order status (Admin only)
router.patch('/:id/status', requireAuth, requireRole(['ADMIN']), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;

    // Validate status
    const validStatuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'FAILED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid order status' });
    }

    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError || !order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Update order status
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Create delivery event if status change affects delivery
    if (['PROCESSING', 'SHIPPED', 'DELIVERED', 'FAILED'].includes(status)) {
      await supabase
        .from('delivery_events')
        .insert({
          order_id: id,
          status: status === 'PROCESSING' ? 'PROCESSING' :
            status === 'SHIPPED' ? 'SHIPPED' :
              status === 'DELIVERED' ? 'DELIVERED' : 'FAILED',
          note: note || `Order status updated to ${status}`,
          data: JSON.stringify({
            status,
            note,
            updatedBy: 'ADMIN',
            updatedAt: new Date()
          })
        });
    }

    res.json({
      success: true,
      data: {
        ...updatedOrder,
        customerId: updatedOrder.customer_id,
        totalAmount: updatedOrder.total_amount,
        shippingAddress: updatedOrder.shipping_address,
        paymentMethod: updatedOrder.payment_method,
        createdAt: updatedOrder.created_at,
        updatedAt: updatedOrder.updated_at
      }
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ success: false, message: 'Failed to update order status' });
  }
});

// ==================== VENDOR ORDER MANAGEMENT ====================

// Get vendor orders
router.get('/vendor/my-orders', requireAuth, requireRole(['VENDOR']), async (req: AuthenticatedRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;
    const skip = (page - 1) * limit;

    // This is tricky because orders are linked to products, and products are linked to vendors.
    // We need to find orders that contain products from this vendor.
    // Supabase filtering on deep relations is limited.
    // Strategy:
    // 1. Get all product IDs for this vendor
    // 2. Get order items with these product IDs
    // 3. Get orders from these order items

    // Step 1: Get products for vendor
    const { data: vendor } = await supabase
      .from('vendor')
      .select('id')
      .eq('user_id', req.user!.id)
      .single();

    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor profile not found' });
    }

    const vendorId = vendor.id;

    // Actually, let's try a direct query if possible, or use the strategy above.
    // Let's fetch orders and filter in memory for now as it's safer given schema uncertainty.
    // But fetching ALL orders is bad.

    // Better strategy:
    // Fetch order_items for this vendor's products, get unique order_ids, then fetch orders.

    const { data: vendorProducts } = await supabase
      .from('product_catalog')
      .select('id')
      .eq('vendor_id', vendorId);

    const productIds = (vendorProducts || []).map((p: any) => p.id);

    if (productIds.length === 0) {
      return res.json({
        success: true,
        data: {
          orders: [],
          pagination: { page, limit, total: 0, pages: 0 }
        }
      });
    }

    const { data: orderItems } = await supabase
      .from('order_items')
      .select('order_id')
      .in('product_id', productIds);

    const orderIds = [...new Set((orderItems || []).map((i: any) => i.order_id))];

    if (orderIds.length === 0) {
      return res.json({
        success: true,
        data: {
          orders: [],
          pagination: { page, limit, total: 0, pages: 0 }
        }
      });
    }

    let query = supabase
      .from('orders')
      .select(`
        *,
        customer:users!customer_id (
          id, first_name, last_name, email, phone
        ),
        items:order_items (
          *,
          product:product_catalog (
            id, name, price
          )
        ),
        delivery_events (
          *
        )
      `, { count: 'exact' })
      .in('id', orderIds)
      .order('created_at', { ascending: false })
      .range(skip, skip + limit - 1);

    if (status) query = query.eq('status', status);

    const { data: orders, count, error } = await query;

    if (error) throw error;

    // Filter items in the order to only show this vendor's products?
    // Usually a vendor wants to see the whole order but maybe only their items.
    // Let's filter items to be safe.

    const transformedOrders = (orders || []).map((order: any) => ({
      ...order,
      customerId: order.customer_id,
      totalAmount: order.total_amount,
      shippingAddress: order.shipping_address,
      paymentMethod: order.payment_method,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      customer: order.customer ? {
        id: order.customer.id,
        firstName: order.customer.first_name,
        lastName: order.customer.last_name,
        email: order.customer.email,
        phone: order.customer.phone
      } : null,
      items: order.items
        .filter((item: any) => productIds.includes(item.product_id)) // Only show vendor's items
        .map((item: any) => ({
          ...item,
          orderId: item.order_id,
          productId: item.product_id,
          unitPrice: item.unit_price,
          totalPrice: item.total_price,
          product: item.product ? {
            id: item.product.id,
            name: item.product.name,
            price: item.product.price
          } : null
        })),
      deliveryEvents: (order.delivery_events || [])
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 1)
        .map((e: any) => ({
          ...e,
          orderId: e.order_id,
          createdAt: e.created_at
        }))
    }));

    res.json({
      success: true,
      data: {
        orders: transformedOrders,
        pagination: {
          page,
          limit,
          total: count || 0,
          pages: Math.ceil((count || 0) / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching vendor orders:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch vendor orders' });
  }
});

export default router;
