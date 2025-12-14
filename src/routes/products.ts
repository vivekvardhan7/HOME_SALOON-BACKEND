import { Router } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

// Public: Get products (minimal fields, schema-safe)
router.get('/', async (req, res) => {
  try {
    const page = parseInt(String(req.query.page || 1));
    const limit = parseInt(String(req.query.limit || 100)); // Increased default to show more products
    const skip = (page - 1) * limit;

    const { data: products, count, error } = await supabase
      .from('products')
      .select(`
        id, name, price, stock, category,
        vendor:vendor!inner(status)
      `, { count: 'exact' })
      .eq('isActive', true)
      .eq('vendor.status', 'APPROVED')
      .order('created_at', { ascending: false })
      .range(skip, skip + limit - 1);

    if (error) throw error;

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          page,
          limit,
          total: count || 0,
          pages: Math.ceil((count || 0) / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch products' });
  }
});

// Public: Get single product (minimal fields)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data: product, error } = await supabase
      .from('products')
      .select(`
        id, name, price, stock,
        vendor:vendor!inner(status)
      `)
      .eq('id', id)
      .eq('isActive', true)
      .eq('vendor.status', 'APPROVED')
      .single();

    if (error || !product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, data: product });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch product' });
  }
});

// Public: Product categories (placeholder to avoid schema mismatch)
router.get('/categories/all', async (_req, res) => {
  res.json({ success: true, data: [] });
});

export default router;
