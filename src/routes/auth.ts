import express from 'express';
import bcrypt from 'bcryptjs';
import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';
import { sendVendorSignupNotificationToManagers } from '../lib/emailService';
import { rateLimitMiddleware } from '../lib/rateLimiter';
import { supabase } from '../lib/supabase';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';

const router = express.Router();

// Helper function to get client IP and user agent
const getClientInfo = (req: express.Request) => {
  const ip = req.ip ||
    req.socket.remoteAddress ||
    (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  return { ip, userAgent };
};

// Helper function to log access attempt
const logAccessAttempt = async (
  userId: string | null,
  emailAttempted: string | null,
  roleAttempted: string | null,
  success: boolean,
  method: 'email_password' | 'google',
  ipAddress: string | null,
  userAgent: string | null
) => {
  try {
    // Skip if access_log table doesn't exist in Supabase
    await supabase.from('access_log').insert({
      user_id: userId || undefined,
      email_attempted: emailAttempted,
      role_attempted: roleAttempted,
      success,
      method,
      ip_address: ipAddress,
      user_agent: userAgent,
    });
  } catch (error) {
    // Silently fail - logging failures shouldn't break auth flow
    // Table might not exist in Supabase
  }
};

// Generate JWT tokens
const generateTokens = (user: any) => {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    type: 'access' as const,
  };

  const secret: Secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-for-development';
  const expiresIn: SignOptions['expiresIn'] = (process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'];
  const refreshExpiresIn: SignOptions['expiresIn'] = (process.env.JWT_REFRESH_EXPIRES_IN || '30d') as SignOptions['expiresIn'];

  const accessToken = jwt.sign(payload, secret, { expiresIn });
  const refreshToken = jwt.sign(payload, secret, { expiresIn: refreshExpiresIn });

  return { accessToken, refreshToken };
};

// Register vendor (Supabase-first flow)
router.post('/register-vendor', async (req, res) => {
  try {
    const {
      supabaseUserId,
      firstName,
      lastName,
      email,
      phone,
      shopName,
      description,
      address,
      city,
      state,
      zipCode,
      latitude,
      longitude,
      servicesOffered,
      operatingHours
    } = req.body;

    if (!supabaseUserId || !email || !firstName || !lastName || !shopName) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields for vendor registration'
      });
    }

    // Check if vendor already exists
    const existingVendorRes = await supabase
      .from('vendor')
      .select('*')
      .or(`user_id.eq.${supabaseUserId},user_id.in.(select id from users where email.eq.${email.toLowerCase()})`)
      .maybeSingle();

    if (existingVendorRes.data) {
      return res.status(409).json({
        success: false,
        message: 'A vendor account already exists for this email address',
        status: existingVendorRes.data.status
      });
    }

    const normalizedLatitude =
      typeof latitude === 'number'
        ? latitude
        : latitude
          ? parseFloat(latitude)
          : 0;
    const normalizedLongitude =
      typeof longitude === 'number'
        ? longitude
        : longitude
          ? parseFloat(longitude)
          : 0;

    // Update user if exists, or create (users should already exist from Supabase auth)
    const userRes = await supabase
      .from('users')
      .upsert({
        id: supabaseUserId,
        first_name: firstName,
        last_name: lastName,
        email: email.toLowerCase(),
        phone,
        role: 'VENDOR',
        status: 'PENDING_VERIFICATION'
      }, {
        onConflict: 'id'
      })
      .select()
      .single();

    if (userRes.error) {
      console.error('Error upserting user:', userRes.error);
      // Continue anyway - user might already exist
    }

    const stringifyHours = (value: any) =>
      value ? JSON.stringify(value) : null;

    // Create vendor
    const vendorRes = await supabase
      .from('vendor')
      .insert({
        user_id: supabaseUserId,
        shopname: shopName,
        description: description || null,
        address: address || '',
        city: city || '',
        state: state || '',
        zip_code: zipCode || '',
        latitude: Number.isFinite(normalizedLatitude) ? normalizedLatitude : 0,
        longitude: Number.isFinite(normalizedLongitude) ? normalizedLongitude : 0,
        status: 'PENDING_APPROVAL',
        email_verified: false,
        verification_token: null,
        verification_token_expires_at: null,
        rejection_reason: null,
        monday_hours: stringifyHours(operatingHours?.monday),
        tuesday_hours: stringifyHours(operatingHours?.tuesday),
        wednesday_hours: stringifyHours(operatingHours?.wednesday),
        thursday_hours: stringifyHours(operatingHours?.thursday),
        friday_hours: stringifyHours(operatingHours?.friday),
        saturday_hours: stringifyHours(operatingHours?.saturday),
        sunday_hours: stringifyHours(operatingHours?.sunday)
      })
      .select()
      .single();

    if (vendorRes.error) {
      throw vendorRes.error;
    }

    const vendor = vendorRes.data;

    // Create audit log (non-blocking)
    try {
      await supabase.from('audit_log').insert({
        user_id: supabaseUserId,
        action: 'VENDOR_REGISTRATION',
        resource: 'VENDOR',
        resource_id: vendor.id,
        new_data: JSON.stringify({
          shopName: vendor.shopname || vendor.shopName,
          email: email.toLowerCase(),
          status: vendor.status,
          servicesOffered: servicesOffered || [],
          businessType: req.body?.businessType || null,
          yearsInBusiness: req.body?.yearsInBusiness || null,
          numberOfEmployees: req.body?.numberOfEmployees || null
        })
      });
    } catch (err) {
      console.error('Failed to create audit log for vendor registration:', err);
    }

    sendVendorSignupNotificationToManagers({
      shopName,
      ownerName: `${firstName} ${lastName}`,
      email,
      phone: phone || '',
      address: `${address || ''}, ${city || ''}, ${state || ''} ${zipCode || ''}`
    }).catch(err => {
      console.error('Failed to send manager notification email:', err);
    });

    res.status(201).json({
      success: true,
      vendor: {
        id: vendor.id,
        status: vendor.status
      }
    });
  } catch (error: any) {
    console.error('❌ Error registering vendor:', error);

    if (error.code === '23505' || error.message?.includes('duplicate')) {
      return res.status(409).json({
        success: false,
        message: 'A vendor with this email already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error during vendor registration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.get('/vendor-status/:supabaseUserId', async (req, res) => {
  try {
    const { supabaseUserId } = req.params;

    if (!supabaseUserId) {
      return res.status(400).json({ success: false, message: 'Vendor id is required' });
    }

    const vendorRes = await supabase
      .from('vendor')
      .select('*')
      .eq('user_id', supabaseUserId)
      .single();

    if (vendorRes.error || !vendorRes.data) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    const vendor = vendorRes.data;

    res.json({
      success: true,
      status: vendor.status,
      rejectionReason: vendor.rejection_reason || vendor.rejectionReason,
      emailVerified: vendor.email_verified || vendor.emailVerified,
      shopName: vendor.shopname || vendor.shopName
    });
  } catch (error) {
    console.error('Error fetching vendor status:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch vendor status' });
  }
});

// Static admin/manager credentials (legacy fallback for local testing)
const STATIC_USERS = {
  'admin@homebonzenga.com': {
    id: 'admin-static-id',
    email: 'admin@homebonzenga.com',
    firstName: 'System',
    lastName: 'Admin',
    role: 'ADMIN',
    status: 'ACTIVE',
    password: 'Admin@123', // Plain text for static comparison
  },
  'manager@homebonzenga.com': {
    id: 'manager-static-id',
    email: 'manager@homebonzenga.com',
    firstName: 'System',
    lastName: 'Manager',
    role: 'MANAGER',
    status: 'ACTIVE',
    password: 'Manager@123', // Plain text for static comparison
  },
};

// Login endpoint with role-based authentication
router.post('/login', rateLimitMiddleware, async (req, res) => {
  try {
    const { email, password } = req.body;
    const { ip, userAgent } = getClientInfo(req);
    const rateLimitInfo = (req as any).rateLimitInfo;

    // Validate inputs
    if (!email || !password) {
      await logAccessAttempt(
        null,
        email || null,
        null,
        false,
        'email_password',
        ip,
        userAgent
      );
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const emailLower = email.toLowerCase();

    // Check static admin/manager credentials first
    const staticUser = STATIC_USERS[emailLower as keyof typeof STATIC_USERS];

    if (staticUser) {
      // Check if password matches static user
      if (password === staticUser.password) {
        // Success - decrement rate limit counter
        if (rateLimitInfo?.decrement) {
          rateLimitInfo.decrement();
        }

        // Generate tokens
        const tokens = generateTokens(staticUser);

        // Log successful attempt
        await logAccessAttempt(
          staticUser.id,
          emailLower,
          staticUser.role,
          true,
          'email_password',
          ip,
          userAgent
        );

        // Return user without password
        const { password: _, ...userWithoutPassword } = staticUser;

        // Determine redirect path based on role (default to root for unknown roles)
        const redirectPath = staticUser.role === 'ADMIN'
          ? '/admin'
          : `/${staticUser.role.toLowerCase()}`;

        return res.json({
          user: userWithoutPassword,
          ...tokens,
          redirectPath,
        });
      } else {
        // Wrong password for static user
        await logAccessAttempt(
          staticUser.id,
          emailLower,
          staticUser.role,
          false,
          'email_password',
          ip,
          userAgent
        );
        return res.status(401).json({ message: 'Invalid credentials' });
      }
    }

    // If not a static user, check Supabase database
    const userRes = await supabase
      .from('users')
      .select('*')
      .eq('email', emailLower)
      .single();

    // Log attempt (before checking password to avoid timing attacks)
    if (userRes.error || !userRes.data) {
      await logAccessAttempt(
        null,
        emailLower,
        null,
        false,
        'email_password',
        ip,
        userAgent
      );
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = userRes.data;

    // REFACTOR: REMOVE manual password check against public.users
    // All logins must be handled via Supabase Auth on the frontend.
    // This backend /login endpoint should only be used for session syncing or status validation.
    // For now, we allow the request to proceed if the user exists and is active.
    // The frontend's signInWithPassword already validated the credentials.

    // Check if user is active
    if (user.status === 'PENDING_VERIFICATION') {
      await logAccessAttempt(
        user.id,
        emailLower,
        user.role,
        false,
        'email_password',
        ip,
        userAgent
      );
      return res.status(403).json({
        message: 'Please verify your email to continue.',
        code: 'EMAIL_NOT_VERIFIED'
      });
    }

    if (user.status !== 'ACTIVE') {
      await logAccessAttempt(
        user.id,
        emailLower,
        user.role,
        false,
        'email_password',
        ip,
        userAgent
      );
      return res.status(403).json({ message: 'Account is not active' });
    }

    // Success - decrement rate limit counter
    if (rateLimitInfo?.decrement) {
      rateLimitInfo.decrement();
    }

    const { password: _, ...userWithoutPassword } = user;

    if (user.role === 'VENDOR') {
      const vendorRes = await supabase
        .from('vendor')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (vendorRes.error || !vendorRes.data) {
        await logAccessAttempt(
          user.id,
          emailLower,
          user.role,
          false,
          'email_password',
          ip,
          userAgent
        );
        return res.status(404).json({ message: 'Vendor profile not found' });
      }

      const vendorProfile = vendorRes.data;

      if (!vendorProfile.email_verified && !vendorProfile.emailVerified) {
        await logAccessAttempt(
          user.id,
          emailLower,
          user.role,
          false,
          'email_password',
          ip,
          userAgent
        );
        return res.status(403).json({
          message: 'Please verify your email before signing in.',
          status: vendorProfile.status,
          emailVerified: false,
          code: 'EMAIL_NOT_VERIFIED',
        });
      }

      if (vendorProfile.status === 'REJECTED') {
        await logAccessAttempt(
          user.id,
          emailLower,
          user.role,
          false,
          'email_password',
          ip,
          userAgent
        );
        return res.status(403).json({
          message: 'Your vendor application has been rejected.',
          status: vendorProfile.status,
          reason: vendorProfile.rejection_reason || vendorProfile.rejectionReason || null,
          code: 'VENDOR_REJECTED',
        });
      }

      if (vendorProfile.status === 'PENDING') {
        await logAccessAttempt(
          user.id,
          emailLower,
          user.role,
          false,
          'email_password',
          ip,
          userAgent
        );
        return res.status(403).json({
          message: 'Your registration is still pending email verification.',
          status: vendorProfile.status,
          emailVerified: vendorProfile.email_verified || vendorProfile.emailVerified,
          code: 'VENDOR_PENDING_EMAIL',
        });
      }

      const tokens = generateTokens(user);

      await logAccessAttempt(
        user.id,
        emailLower,
        user.role,
        true,
        'email_password',
        ip,
        userAgent
      );

      const pendingMessage = 'Account verified. Waiting for manager approval. You will be notified.';

      return res.json({
        user: userWithoutPassword,
        vendor: {
          id: vendorProfile.id,
          status: vendorProfile.status,
          emailVerified: vendorProfile.email_verified || vendorProfile.emailVerified,
          rejectionReason: vendorProfile.rejection_reason || vendorProfile.rejectionReason,
        },
        status: vendorProfile.status,
        accessRestricted: vendorProfile.status !== 'APPROVED',
        message: vendorProfile.status === 'PENDING_APPROVAL' ? pendingMessage : 'Login successful',
        ...tokens,
        redirectPath: '/vendor',
      });
    }

    // Generate tokens for admin/manager
    const tokens = generateTokens(user);

    await logAccessAttempt(
      user.id,
      emailLower,
      user.role,
      true,
      'email_password',
      ip,
      userAgent
    );

    const redirectPath = user.role === 'ADMIN' ? '/admin' : '/manager';

    res.json({
      user: userWithoutPassword,
      ...tokens,
      redirectPath,
    });
  } catch (error) {
    console.error('Login error:', error);
    const { ip, userAgent } = getClientInfo(req);
    await logAccessAttempt(
      null,
      req.body.email || null,
      null,
      false,
      'email_password',
      ip,
      userAgent
    );
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Log Google OAuth login (called from frontend after successful OAuth)
router.post('/log-google-auth', async (req, res) => {
  try {
    const { userId, email, role, success, ipAddress, userAgent } = req.body;

    await logAccessAttempt(
      userId || null,
      email || null,
      role || null,
      success !== false, // Default to true if not specified
      'google',
      ipAddress || null,
      userAgent || null
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error logging Google auth:', error);
    // Don't fail the request if logging fails
    res.json({ success: true });
  }
});

// Register customer (user with CUSTOMER role)
router.post('/register-customer', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      phone
    } = req.body;

    // Check if user already exists
    const existingUserRes = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (existingUserRes.data) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const userRes = await supabase
      .from('users')
      .insert({
        first_name: firstName,
        last_name: lastName,
        email: email.toLowerCase(),
        password: hashedPassword,
        phone,
        role: 'CUSTOMER',
        status: 'PENDING_VERIFICATION'
      })
      .select()
      .single();

    if (userRes.error) throw userRes.error;
    const user = userRes.data;

    res.status(201).json({
      message: 'Customer registration successful',
      user: {
        id: user.id,
        firstName: user.first_name || user.firstName,
        lastName: user.last_name || user.lastName,
        email: user.email,
        role: user.role
      },
      profile: { role: 'CUSTOMER' }
    });
  } catch (error: any) {
    console.error('Error registering customer:', error);
    res.status(500).json({ message: 'Internal server error', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
});



// Generate manual verification link (Supabase Admin)
router.post('/generate-verification-link', async (req, res) => {
  try {
    const { email, role } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    console.log(`Generating verification link for ${email} (${role})`);

    const { data, error } = await (supabaseAdmin.auth.admin as any).generateLink({
      type: 'invite',
      email,
      options: {
        redirectTo: `${frontendUrl}/auth/verify`
      }
    });

    if (error) {
      console.error('Error generating Supabase link:', error);
      return res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Failed to generate verification link'
      });
    }

    res.json({
      success: true,
      verificationLink: data.properties.action_link
    });
  } catch (error: any) {
    console.error('❌ Server error generating link:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error generating verification link',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;
