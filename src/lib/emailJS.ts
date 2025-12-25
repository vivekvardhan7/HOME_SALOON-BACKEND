/**
 * EMAILJS DISABLED
 * 
 * As per project requirements, EmailJS has been removed.
 * Verification emails are handled by Supabase Auth native SMTP.
 */

export const sendVerificationEmail = async () => {
    console.warn('EmailJS is disabled. No email sent.');
    return { success: true };
};
