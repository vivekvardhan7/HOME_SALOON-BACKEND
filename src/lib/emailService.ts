/**
 * EMAIL SERVICES DISABLED
 * 
 * As per project requirements, custom backend email sending via Nodemailer/SMTP
 * has been completely disabled. All user verification emails are now handled
 * exclusively by Supabase Auth's native SMTP service.
 * 
 * Do not add code here.
 */
export const sendVendorSignupNotificationToManagers = async () => {
  console.warn('Email service is disabled. No notification sent.');
  return true;
};

export const sendVerificationEmail = async () => {
  console.warn('Email service is disabled. No verification email sent.');
  return true;
};
