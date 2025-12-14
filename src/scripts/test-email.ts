#!/usr/bin/env ts-node

/**
 * Email Configuration Test Script
 * 
 * This script tests your SMTP email configuration.
 * Run it to verify emails can be sent before testing the full workflow.
 * 
 * Usage: npx ts-node src/scripts/test-email.ts
 */

// Load environment variables
require('../../config.js');

import { sendEmail, verifyEmailTransport } from '../lib/emailService';

async function testEmailConfiguration() {
  console.log('\n🧪 Testing Email Configuration...\n');
  
  // Step 1: Check environment variables
  console.log('📋 Step 1: Checking Environment Variables');
  console.log('─────────────────────────────────────────');
  
  const requiredVars = {
    'SMTP_HOST': process.env.SMTP_HOST,
    'SMTP_PORT': process.env.SMTP_PORT,
    'SMTP_USER': process.env.SMTP_USER,
    'SMTP_PASS': process.env.SMTP_PASS ? '***' + process.env.SMTP_PASS.slice(-4) : undefined,
    'SMTP_FROM': process.env.SMTP_FROM,
    'MANAGER_EMAILS': process.env.MANAGER_EMAILS,
    'ADMIN_EMAIL': process.env.ADMIN_EMAIL,
  };
  
  let missingVars = false;
  for (const [key, value] of Object.entries(requiredVars)) {
    if (value) {
      console.log(`✅ ${key}: ${value}`);
    } else {
      console.log(`❌ ${key}: NOT SET`);
      if (key !== 'SMTP_FROM' && key !== 'ADMIN_EMAIL' && key !== 'MANAGER_EMAILS') {
        missingVars = true;
      }
    }
  }
  
  if (missingVars) {
    console.log('\n❌ Missing required environment variables!');
    console.log('Please configure SMTP settings in server/.env file\n');
    process.exit(1);
  }
  
  // Step 2: Verify SMTP connection
  console.log('\n📋 Step 2: Verifying SMTP Connection');
  console.log('─────────────────────────────────────────');
  
  try {
    await verifyEmailTransport();
    console.log('✅ SMTP connection verified successfully!\n');
  } catch (error) {
    console.log('❌ SMTP connection failed!\n');
    console.error(error);
    process.exit(1);
  }
  
  // Step 3: Send test email
  console.log('📋 Step 3: Sending Test Email');
  console.log('─────────────────────────────────────────');
  
  const testRecipient = process.env.SMTP_USER || 'test@example.com';
  console.log(`📧 Sending test email to: ${testRecipient}`);
  
  const success = await sendEmail({
    to: testRecipient,
    subject: 'Test Email - Home Bonzenga',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #7c3aed; color: white; padding: 20px; text-align: center; }
          .content { background: #f9f9f9; padding: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Email Configuration Test</h1>
          </div>
          <div class="content">
            <p>Congratulations! Your email configuration is working correctly.</p>
            <p><strong>Test Details:</strong></p>
            <ul>
              <li>SMTP Host: ${process.env.SMTP_HOST}</li>
              <li>SMTP Port: ${process.env.SMTP_PORT}</li>
              <li>From: ${process.env.SMTP_FROM || process.env.SMTP_USER}</li>
            </ul>
            <p>You can now use the vendor approval email workflow.</p>
          </div>
        </div>
      </body>
      </html>
    `
  });
  
  if (success) {
    console.log('✅ Test email sent successfully!');
    console.log(`📬 Check your inbox at: ${testRecipient}\n`);
  } else {
    console.log('❌ Failed to send test email!');
    console.log('Check the error messages above for details.\n');
    process.exit(1);
  }
  
  // Step 4: Test manager notification
  console.log('📋 Step 4: Testing Manager Notification');
  console.log('─────────────────────────────────────────');
  
  const managerEmails = process.env.MANAGER_EMAILS 
    ? process.env.MANAGER_EMAILS.split(',').map(e => e.trim())
    : [process.env.ADMIN_EMAIL || 'admin@example.com'];
  
  console.log(`📧 Manager emails configured: ${managerEmails.join(', ')}`);
  
  if (managerEmails.length === 0 || managerEmails[0] === 'admin@example.com') {
    console.log('⚠️  Warning: No manager emails configured!');
    console.log('Set MANAGER_EMAILS or ADMIN_EMAIL in .env file\n');
  } else {
    console.log('✅ Manager emails are configured\n');
  }
  
  // Summary
  console.log('═══════════════════════════════════════════');
  console.log('✅ Email Configuration Test Complete!');
  console.log('═══════════════════════════════════════════');
  console.log('\n📝 Next Steps:');
  console.log('1. Check your email inbox for the test email');
  console.log('2. If received, your email configuration is working');
  console.log('3. Try registering a vendor to test the full workflow');
  console.log('4. Manager should receive notification email\n');
  
  process.exit(0);
}

// Run the test
testEmailConfiguration().catch(error => {
  console.error('\n❌ Test failed with error:', error);
  process.exit(1);
});
