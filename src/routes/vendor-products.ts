import { Router, Response } from 'express';
import { supabase } from '../lib/supabase';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { checkVendorApproved } from '../middleware/vendorApproval';
import multer from 'multer';

// Use memory storage for Multer
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB to match frontend
  },
});

const router = Router();

// ----------------------------------------------------------------------
// GET ALL PRODUCTS
// ----------------------------------------------------------------------
router.get('/:vendorId/products', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { vendorId: paramId } = req.params;
    // Prefer authenticating user's vendor ID
    const userId = req.user?.id;

    console.log(`📥 GET /api/vendor/${userId || paramId}/products - Fetching products`);

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Find the vendor record for this user
    const { data: vendor, error: vendorError } = await supabase
      .from('vendor')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (vendorError || !vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .eq('vendor_id', vendor.id)
      .order('created_at', { ascending: false });

    if (productsError) throw productsError;

    // Transform to camelCase for frontend where necessary
    const transformedProducts = (products || []).map((p: any) => ({
      ...p,
      vendorId: p.vendor_id,
      createdAt: p.created_at,
      totalSales: p.total_sales || 0,
      isActive: p.is_active,
      // Map DB columns to frontend expected props if needed (or they might match now)
      name: p.product_name,
      category: p.category_id, // Frontend uses 'category' in list view often, but backend is category_id
      price: p.price_cdf,
      stock: p.stock_quantity,
      sku: p.sku_code,
      imageUrl: p.image_url
    }));

    res.json({ products: transformedProducts });
  } catch (error: any) {
    console.error('❌ Error fetching products:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ----------------------------------------------------------------------
// CREATE NEW PRODUCT (FINAL FIX)
// ----------------------------------------------------------------------
router.post(
  '/:id/products',
  authenticate,          // 1. MUST BE FIRST
  checkVendorApproved,   // Optional, but safe if uses req.user.id
  upload.single('image'),// 2. MUST BE SECOND
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // 1. AUTH & VENDOR RESOLUTION
      if (!req.user || !req.user.id) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const userId = req.user.id; // GET AUTHENTICATED USER ID

      // QUERY VENDOR FROM DB
      const { data: vendor, error: vendorError } = await supabase
        .from('vendor')
        .select('id')
        .eq('user_id', userId)
        .limit(1)
        .single();

      if (vendorError || !vendor) {
        return res.status(400).json({ message: 'Vendor profile not found' });
      }

      const vendorId = vendor.id; // USE VENDOR ID FROM DB

      // 2. VALIDATE FILE INPUT
      if (!req.file) {
        return res.status(400).json({ message: 'Product image is required' });
      }

      // 3. PARSE BODY SAFELY & EXPLICITLY
      // Using the EXACT keys sent by frontend
      const price_cdf = Number(req.body.price_cdf);
      const stock_quantity = Number(req.body.stock_quantity);

      if (isNaN(price_cdf) || isNaN(stock_quantity)) {
        return res.status(400).json({ message: 'Invalid price or stock quantity' });
      }

      if (!req.body.product_name || !req.body.category_id) {
        return res.status(400).json({ message: 'Product name and category are required' });
      }

      // 4. UPLOAD IMAGE
      const file = req.file;
      const fileExt = file.originalname.split('.').pop() || 'jpg';
      const filePath = `products/${vendorId}/${Date.now()}-${Math.floor(Math.random() * 1000)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: true
        });

      if (uploadError) {
        console.error('Image upload failed:', uploadError);
        return res.status(400).json({ message: `Image upload failed: ${uploadError.message}` });
      }

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      // 5. INSERT PRODUCT (EXACT SCHEMA MATCH)
      // Columns: vendor_id, product_name, category_id, price_cdf, stock_quantity, sku_code, description, image_url, is_active
      const productData = {
        vendor_id: vendorId,
        product_name: req.body.product_name,
        category_id: req.body.category_id,
        price_cdf: price_cdf,
        stock_quantity: stock_quantity,
        sku_code: req.body.sku_code || null,
        description: req.body.description || null,
        image_url: publicUrl,
        is_active: true,
      };

      console.log('📝 Inserting Product:', productData);

      const { data: product, error: insertError } = await supabase
        .from('products')
        .insert(productData)
        .select()
        .single();

      if (insertError) {
        console.error('Product insert error:', insertError.message);
        return res.status(400).json({ message: insertError.message });
      }

      // 6. SUCCESS RESPONSE
      return res.status(201).json({
        message: 'Product created successfully',
        product
      });

    } catch (error: any) {
      console.error('❌ FATAL ERROR in POST /products:', error);
      return res.status(500).json({
        message: 'Internal server error',
        error: error.message
      });
    }
  });

// ----------------------------------------------------------------------
// UPDATE PRODUCT
// ----------------------------------------------------------------------
router.put('/:vendorId/products/:productId', authenticate, async (req, res) => {
  try {
    const { productId } = req.params;

    // Use schema keys directly
    const updatePayload: any = {};
    if (req.body.product_name) updatePayload.product_name = req.body.product_name;
    if (req.body.category_id) updatePayload.category_id = req.body.category_id;
    if (req.body.price_cdf) updatePayload.price_cdf = Number(req.body.price_cdf);
    if (req.body.stock_quantity) updatePayload.stock_quantity = Number(req.body.stock_quantity);
    if (req.body.sku_code) updatePayload.sku_code = req.body.sku_code;
    if (req.body.description) updatePayload.description = req.body.description;
    if (req.body.isActive !== undefined) updatePayload.is_active = req.body.isActive;

    const { data: product, error: updateError } = await supabase
      .from('products')
      .update(updatePayload)
      .eq('id', productId)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json({ product });
  } catch (error: any) {
    console.error('❌ Error updating product:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ----------------------------------------------------------------------
// DELETE PRODUCT
// ----------------------------------------------------------------------
router.delete('/:vendorId/products/:productId', authenticate, async (req, res) => {
  try {
    const { productId } = req.params;
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (error) throw error;
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ----------------------------------------------------------------------
// TOGGLE STATUS
// ----------------------------------------------------------------------
router.patch('/:vendorId/products/:productId/toggle', authenticate, async (req, res) => {
  try {
    const { productId } = req.params;

    // First get current status
    const { data: current, error: fetchError } = await supabase
      .from('products')
      .select('is_active')
      .eq('id', productId)
      .single();

    if (fetchError || !current) return res.status(404).json({ message: 'Product not found' });

    const { data: updated, error: updateError } = await supabase
      .from('products')
      .update({ is_active: !current.is_active })
      .eq('id', productId)
      .select()
      .single();

    if (updateError) throw updateError;

    const transformed = {
      ...updated,
      vendorId: updated.vendor_id,
      isActive: updated.is_active
    };

    res.json({ product: transformed });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
