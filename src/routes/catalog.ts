import { Router } from 'express';
import { supabase } from '../lib/supabase';
import {
  requireAuth,
  requireRole,
  type AuthenticatedRequest,
} from '../middleware/auth';

const router = Router();

// ==================== PUBLIC GET ENDPOINTS (Customer Access) ====================

// Get all active catalog services (public access)
router.get('/services', async (req, res) => {
  try {
    const { search, includeProducts, showInactive } = req.query;

    let query = supabase
      .from('service_catalog')
      .select(`
        *,
        products:service_catalog_products (
          product_catalog:product_catalog (*)
        )
      `)
      .order('name', { ascending: true });

    if (showInactive !== 'true') {
      query = query.eq('is_active', true);
    }

    if (search && typeof search === 'string') {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data: services, error } = await query;

    if (error) throw error;

    // Transform to match frontend expected format
    const transformed = (services || []).map((service: any) => ({
      id: service.id,
      slug: service.slug,
      name: service.name,
      description: service.description,
      duration: service.duration,
      customerPrice: service.customer_price,
      vendorPayout: service.vendor_payout,
      category: service.category,
      icon: service.icon,
      allowsProducts: service.allows_products,
      isActive: service.is_active,
      products: includeProducts === 'true' && service.products
        ? service.products.map((p: any) => ({
          id: p.product_catalog.id, // Using product catalog ID as ID here for simplicity in frontend
          quantity: 1,
          optional: true,
          productCatalog: {
            id: p.product_catalog.id,
            slug: p.product_catalog.slug,
            name: p.product_catalog.name,
            description: p.product_catalog.description,
            category: p.product_catalog.category,
            image: p.product_catalog.image,
            customerPrice: p.product_catalog.customer_price,
            vendorPayout: p.product_catalog.vendor_payout,
            sku: p.product_catalog.sku,
            isActive: p.product_catalog.is_active,
          },
        }))
        : undefined,
    }));

    res.json({ success: true, data: transformed });
  } catch (error) {
    console.error('Error fetching catalog services:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch services' });
  }
});

// Get all active catalog products (public access)
router.get('/products', async (req, res) => {
  try {
    const { category, search, showInactive } = req.query;

    let query = supabase
      .from('product_catalog')
      .select('*')
      .order('name', { ascending: true });

    if (showInactive !== 'true') {
      query = query.eq('is_active', true);
    }

    if (category && typeof category === 'string') {
      query = query.eq('category', category);
    }

    if (search && typeof search === 'string') {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data: products, error } = await query;

    if (error) throw error;

    // Transform to match frontend expected format
    const transformed = (products || []).map((product: any) => ({
      id: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description,
      category: product.category,
      image: product.image,
      customerPrice: product.customer_price,
      vendorPayout: product.vendor_payout,
      sku: product.sku,
      isActive: product.is_active,
    }));

    res.json({ success: true, data: transformed });
  } catch (error) {
    console.error('Error fetching catalog products:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch products' });
  }
});

// ==================== ADMIN-ONLY ENDPOINTS ====================

// Apply auth middleware only to admin routes
router.use(requireAuth);
router.use(requireRole(['ADMIN']));

const ensureSlug = (value: string | undefined | null) => {
  if (value && value.trim().length > 0) {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
  const randomSuffix = Math.random().toString(36).slice(2, 7);
  return `service-${randomSuffix}`;
};

router.post(
  '/services',
  async (req: AuthenticatedRequest, res) => {
    try {
      const {
        name,
        description,
        duration = 60,
        customerPrice,
        vendorPayout,
        category,
        icon,
        allowsProducts = false,
        productIds = [],
        slug,
      } = req.body || {};

      if (!name || typeof customerPrice !== 'number' || typeof vendorPayout !== 'number') {
        return res.status(400).json({
          success: false,
          message: 'name, customerPrice and vendorPayout are required',
        });
      }

      if (vendorPayout > customerPrice) {
        return res.status(400).json({
          success: false,
          message: 'Vendor payout cannot exceed customer price',
        });
      }

      const { data: service, error: createError } = await supabase
        .from('service_catalog')
        .insert({
          name,
          slug: ensureSlug(slug || name),
          description: description || null,
          duration: Number(duration) || 60,
          customer_price: customerPrice,
          vendor_payout: vendorPayout,
          category: category || null,
          icon: icon || null,
          allows_products: !!allowsProducts,
          is_active: true
        })
        .select()
        .single();

      if (createError) throw createError;

      if (productIds?.length) {
        const productInserts = productIds.map((productId: string) => ({
          service_catalog_id: service.id,
          product_catalog_id: productId,
        }));

        const { error: productsError } = await supabase
          .from('service_catalog_products')
          .insert(productInserts);

        if (productsError) throw productsError;
      }

      // Fetch complete service
      const { data: completeService, error: fetchError } = await supabase
        .from('service_catalog')
        .select(`
          *,
          products:service_catalog_products (
            product_catalog:product_catalog (*)
          )
        `)
        .eq('id', service.id)
        .single();

      if (fetchError) throw fetchError;

      res.status(201).json({ success: true, data: completeService });
    } catch (error) {
      console.error('Error creating service catalog entry:', error);
      res.status(500).json({ success: false, message: 'Failed to create service' });
    }
  }
);

router.put(
  '/services/:id',
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const {
        name,
        description,
        duration,
        customerPrice,
        vendorPayout,
        category,
        icon,
        allowsProducts,
        isActive,
        productIds,
        slug,
      } = req.body || {};

      const { data: service, error: updateError } = await supabase
        .from('service_catalog')
        .update({
          name,
          description,
          duration: duration !== undefined ? Number(duration) : undefined,
          customer_price: customerPrice,
          vendor_payout: vendorPayout,
          category,
          icon,
          allows_products: allowsProducts,
          is_active: isActive,
          slug: slug ? ensureSlug(slug) : undefined,
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      if (Array.isArray(productIds)) {
        // Delete existing relations
        await supabase
          .from('service_catalog_products')
          .delete()
          .eq('service_catalog_id', id);

        if (productIds.length > 0) {
          const productInserts = productIds.map((productId: string) => ({
            service_catalog_id: id,
            product_catalog_id: productId,
          }));

          await supabase
            .from('service_catalog_products')
            .insert(productInserts);
        }
      }

      const { data: refreshed, error: fetchError } = await supabase
        .from('service_catalog')
        .select(`
          *,
          products:service_catalog_products (
            product_catalog:product_catalog (*)
          )
        `)
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      res.json({ success: true, data: refreshed });
    } catch (error) {
      console.error('Error updating service catalog entry:', error);
      res.status(500).json({ success: false, message: 'Failed to update service' });
    }
  }
);

router.delete(
  '/services/:id',
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;

      // Relations cascade delete usually, but let's be safe
      await supabase
        .from('service_catalog_products')
        .delete()
        .eq('service_catalog_id', id);

      const { error } = await supabase
        .from('service_catalog')
        .delete()
        .eq('id', id);

      if (error) throw error;

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting service catalog entry:', error);
      res.status(500).json({ success: false, message: 'Failed to delete service' });
    }
  }
);

router.post(
  '/products',
  async (req: AuthenticatedRequest, res) => {
    try {
      const {
        name,
        description,
        category,
        image,
        customerPrice,
        vendorPayout,
        sku,
        slug,
        isActive = true,
      } = req.body || {};

      if (!name || typeof customerPrice !== 'number' || typeof vendorPayout !== 'number') {
        return res.status(400).json({
          success: false,
          message: 'name, customerPrice and vendorPayout are required',
        });
      }

      const { data: product, error } = await supabase
        .from('product_catalog')
        .insert({
          name,
          slug: ensureSlug(slug || name),
          description: description || null,
          category: category || null,
          image: image || null,
          customer_price: customerPrice,
          vendor_payout: vendorPayout,
          sku: sku || null,
          is_active: !!isActive,
        })
        .select()
        .single();

      if (error) throw error;

      res.status(201).json({ success: true, data: product });
    } catch (error) {
      console.error('Error creating catalog product:', error);
      res.status(500).json({ success: false, message: 'Failed to create product' });
    }
  }
);

router.put(
  '/products/:id',
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const {
        name,
        description,
        category,
        image,
        customerPrice,
        vendorPayout,
        sku,
        isActive,
        slug,
      } = req.body || {};

      const { data: product, error } = await supabase
        .from('product_catalog')
        .update({
          name,
          description,
          category,
          image,
          customer_price: customerPrice,
          vendor_payout: vendorPayout,
          sku,
          is_active: isActive,
          slug: slug ? ensureSlug(slug) : undefined,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      res.json({ success: true, data: product });
    } catch (error) {
      console.error('Error updating catalog product:', error);
      res.status(500).json({ success: false, message: 'Failed to update product' });
    }
  }
);

router.delete(
  '/products/:id',
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;

      // Delete relations first
      await supabase
        .from('service_catalog_products')
        .delete()
        .eq('product_catalog_id', id);

      const { error } = await supabase
        .from('product_catalog')
        .delete()
        .eq('id', id);

      if (error) throw error;

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting catalog product:', error);
      res.status(500).json({ success: false, message: 'Failed to delete product' });
    }
  }
);

export default router;
