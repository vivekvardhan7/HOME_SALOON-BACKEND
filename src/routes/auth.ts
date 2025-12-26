import express from 'express';
import bcrypt from 'bcryptjs';
import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';
import { rateLimitMiddleware } from '../lib/rateLimiter';
import { supabase } from '../lib/supabase';
import crypto from 'crypto';

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

// Register vendor (Backend-controlled profile creation)
router.post('/register-vendor', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      phone,
      shopName,
      description,
      address,
      city,
      state,
      zipCode,
      latitude,
      longitude,
      operatingHours
    } = req.body;

    if (!email || !firstName || !lastName || !shopName || !password) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields (email, password, name, shopName)'
      });
    }

    const emailLower = email.toLowerCase();

    // Check if USER exists
    const userExists = await supabase.from('users').select('id').eq('email', emailLower).maybeSingle();
    if (userExists.data) {
      return res.status(409).json({ success: false, message: 'User with this email already exists' });
    }

    // Hash Password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create User (is_verified = false)
    const userRes = await supabase.from('users').insert({
      first_name: firstName,
      last_name: lastName,
      email: emailLower,
      password: hashedPassword,
      phone: phone ? phone.substring(0, 20) : null,
      role: 'VENDOR',
      status: 'ACTIVE',
      email_verified: false,
      // No custom token needed, Supabase Auth handles this
      // email_verification_token: crypto.randomBytes(32).toString('hex'),
    }).select().single();

    if (userRes.error) throw userRes.error;
    const user = userRes.data;

    // Normalizing Coords
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

    const stringifyHours = (value: any) =>
      value ? JSON.stringify(value) : null;

    // Create vendor profile
    const vendorRes = await supabase
      .from('vendor')
      .insert({
        user_id: user.id,
        shopname: shopName,
        description: description || null,
        address: address || '',
        city: city || '',
        state: state || '',
        zip_code: zipCode || '',
        latitude: Number.isFinite(normalizedLatitude) ? normalizedLatitude : 0,
        longitude: Number.isFinite(normalizedLongitude) ? normalizedLongitude : 0,
        status: 'PENDING_APPROVAL',
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

    if (vendorRes.error) throw vendorRes.error;
    const vendor = vendorRes.data;

    // Create audit log (non-blocking)
    try {
      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'VENDOR_REGISTRATION',
        resource: 'VENDOR',
        resource_id: vendor.id,
        new_data: JSON.stringify({ shopName: vendor.shopname, email: user.email })
      });
    } catch (err) { console.error('Audit log failed', err); }

    // NOTE: Notifications to managers are disabled as per strict requirement (no backend email sending)

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please verify your email via the link sent by Supabase.',
      vendor: { id: vendor.id, status: vendor.status }
    });

  } catch (error: any) {
    console.error('❌ Error registering vendor:', error);
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

    // Join with users explicitly to get is_verified correct
    const vendorRes = await supabase
      .from('vendor')
      .select(`
        *,
        user:users!user_id ( email_verified )
      `)
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
      emailVerified: vendor.user?.email_verified ?? false,
      shopName: vendor.shopname || vendor.shopName
    });
  } catch (error) {
    console.error('Error fetching vendor status:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch vendor status' });
  }
});

// Static admin credentials (legacy fallback for local testing)
// MANAGER is now handled via system_credentials table
const STATIC_USERS = {
  'admin@homebonzenga.com': {
    id: 'admin-static-id',
    email: 'admin@homebonzenga.com',
    firstName: 'System',
    lastName: 'Admin',
    role: 'ADMIN',
    status: 'ACTIVE',
    password: 'Admin@123', // Plain text for static comparison
  }
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

    // ---------------------------------------------------------
    // 1. CHECK SYSTEM CREDENTIALS (MANAGER)
    // ---------------------------------------------------------
    // Check if this is a Manager login via system_credentials table
    // This allows Manager to be a strictly system role without a 'users' table entry
    try {
      const { data: systemUser, error: sysError } = await supabase
        .from('system_credentials')
        .select('*')
        .eq('role', 'MANAGER')
        .eq('email', emailLower)
        .maybeSingle();

      if (systemUser) {
        if (!systemUser.is_active) {
          await logAccessAttempt(systemUser.id, emailLower, 'MANAGER', false, 'email_password', ip, userAgent);
          return res.status(403).json({ message: 'Manager account is inactive' });
        }

        const isMatch = await bcrypt.compare(password, systemUser.password_hash);
        if (isMatch) {
          // Success
          if (rateLimitInfo?.decrement) rateLimitInfo.decrement();

          const tokens = generateTokens({
            id: systemUser.id,
            email: systemUser.email,
            role: 'MANAGER'
          });

          await logAccessAttempt(systemUser.id, emailLower, 'MANAGER', true, 'email_password', ip, userAgent);

          return res.json({
            user: {
              id: systemUser.id,
              email: systemUser.email,
              role: 'MANAGER',
              firstName: 'System',
              lastName: 'Manager'
            },
            ...tokens,
            redirectPath: ('/manager')
          });
        } else {
          await logAccessAttempt(systemUser.id, emailLower, 'MANAGER', false, 'email_password', ip, userAgent);
          return res.status(401).json({ message: 'Invalid credentials' });
        }
      }
    } catch (err) {
      // Table might not exist or other error, proceed to normal flow but log warning
      // Console.warn('System credentials check failed, possibly table missing (expected during migration):', err);
    }

    // ---------------------------------------------------------
    // 2. CHECK STATIC ADMIN
    // ---------------------------------------------------------
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

    // CHECK VERIFICATION (For all users except maybe Admin if checking database?)
    if (user.email_verified === false) {
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
        message: 'Please verify your email to continue',
        code: 'EMAIL_NOT_VERIFIED'
      });
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

      const isVerified = user.email_verified;

      if (!isVerified) {
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
          message: 'Your registration is still pending.',
          status: vendorProfile.status,
          emailVerified: isVerified,
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
          emailVerified: isVerified,
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

// Register customer (Backend-controlled profile creation)
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

    // Create user (is_verified = false)
    const userRes = await supabase
      .from('users')
      .insert({
        first_name: firstName,
        last_name: lastName,
        email: email.toLowerCase(),
        password: hashedPassword,
        phone: phone ? phone.substring(0, 20) : null,
        role: 'CUSTOMER',
        status: 'ACTIVE',
        email_verified: false,
        // No custom token needed, Supabase Auth handles this
        // email_verification_token: crypto.randomBytes(32).toString('hex'),
      })
      .select()
      .single();

    if (userRes.error) throw userRes.error;
    const user = userRes.data;

    res.status(201).json({
      message: 'Registration successful. Please verify your email via the link sent by Supabase.',
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error: any) {
    console.error('Error registering customer:', error);
    res.status(500).json({ message: 'Internal server error', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
});

export default router;
