/**
 * Manager Health Check Route
 * This helps debug connection issues
 */
import express from 'express';
import { supabase } from '../lib/supabase';

const router = express.Router();

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    // Test database connection
    const { count: vendorCount, error: vendorError } = await supabase
      .from('vendor')
      .select('*', { count: 'exact', head: true });

    if (vendorError) throw vendorError;

    const { count: userCount, error: userError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (userError) throw userError;

    res.json({
      status: 'OK',
      database: 'connected',
      vendors: vendorCount,
      users: userCount,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('❌ Health check failed:', error);
    res.status(500).json({
      status: 'ERROR',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
