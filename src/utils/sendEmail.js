const nodemailer = require('nodemailer');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

/**
 * Create reusable email transporter
 * Supports Gmail (with app password) and other SMTP services
 */
const createTransporter = () => {
  // Use Gmail by default, but support other SMTP services
  const emailUser = process.env.EMAIL_USER || '';
  const emailPass = process.env.EMAIL_PASS || '';
  
  if (!emailUser || !emailPass) {
    console.warn('⚠️  Email credentials not configured. Email notifications will be skipped.');
    return null;
  }

  // Check if using Gmail
  const isGmail = emailUser.includes('@gmail.com');

  const config = isGmail 
    ? {
        service: 'gmail',
        auth: {
          user: emailUser,
          pass: emailPass
        }
      }
    : {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: emailUser,
          pass: emailPass
        }
      };

  return nodemailer.createTransporter(config);
};

/**
 * Send email notification
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - Email HTML content
 * @param {string} options.text - Plain text content (optional)
 * @returns {Promise<boolean>} - Success status
 */
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      console.warn(`⚠️  Skipping email to ${to} - Email not configured`);
      return false;
    }

    const mailOptions = {
      from: `"Home Bonzenga" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML tags for plain text fallback
      html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${to}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error.message);
    return false;
  }
};

/**
 * Send vendor approval email
 * @param {string} email - Vendor email
 * @param {string} vendorName - Vendor shop name
 * @param {string} ownerName - Vendor owner name
 * @returns {Promise<boolean>} - Success status
 */
const sendVendorApprovalEmail = async (email, vendorName, ownerName) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
      <div style="background-color: #4e342e; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0;">🎉 Vendor Account Approved</h1>
      </div>
      
      <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px;">
        <p style="color: #333; font-size: 16px; margin-bottom: 20px;">
          Hello ${ownerName},
        </p>
        
        <p style="color: #333; font-size: 16px; margin-bottom: 20px;">
          Great news! Your vendor account for <strong>${vendorName}</strong> has been approved by our management team.
        </p>
        
        <div style="background-color: #f0f7ff; border-left: 4px solid #4e342e; padding: 15px; margin: 20px 0;">
          <p style="color: #333; margin: 0; font-size: 14px;">
            <strong>What you can do now:</strong>
          </p>
          <ul style="color: #333; margin: 10px 0 0 0; padding-left: 20px;">
            <li>Add your services and pricing</li>
            <li>Manage your products inventory</li>
            <li>Add and manage your employees</li>
            <li>Start accepting customer bookings</li>
          </ul>
        </div>
        
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/vendor" 
           style="display: inline-block; background-color: #4e342e; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold;">
          Access Your Dashboard
        </a>
        
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          If you have any questions, feel free to contact our support team at support@homebonzenga.com
        </p>
        
        <p style="color: #666; font-size: 14px;">
          Welcome to Home Bonzenga!
        </p>
      </div>
      
      <div style="margin-top: 20px; text-align: center; color: #999; font-size: 12px;">
        <p>This is an automated email. Please do not reply to this message.</p>
      </div>
    </div>
  `;

  return await sendEmail({
    to: email,
    subject: 'Your Vendor Account Has Been Approved - Home Bonzenga',
    html
  });
};

/**
 * Send vendor rejection email
 * @param {string} email - Vendor email
 * @param {string} vendorName - Vendor shop name
 * @param {string} ownerName - Vendor owner name
 * @param {string} rejectionReason - Reason for rejection (optional)
 * @returns {Promise<boolean>} - Success status
 */
const sendVendorRejectionEmail = async (email, vendorName, ownerName, rejectionReason = '') => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
      <div style="background-color: #f44336; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0;">Vendor Application Status</h1>
      </div>
      
      <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px;">
        <p style="color: #333; font-size: 16px; margin-bottom: 20px;">
          Hello ${ownerName},
        </p>
        
        <p style="color: #333; font-size: 16px; margin-bottom: 20px;">
          We regret to inform you that your vendor application for <strong>${vendorName}</strong> has been rejected by our management team.
        </p>
        
        ${rejectionReason ? `
        <div style="background-color: #fff3f3; border-left: 4px solid #f44336; padding: 15px; margin: 20px 0;">
          <p style="color: #333; margin: 0; font-size: 14px;">
            <strong>Reason:</strong> ${rejectionReason}
          </p>
        </div>
        ` : ''}
        
        <p style="color: #333; font-size: 16px; margin-bottom: 20px;">
          We understand this may be disappointing. If you believe this decision was made in error, or if you would like more details about why your application was rejected, please contact our support team.
        </p>
        
        <div style="background-color: #f0f7ff; border: 1px solid #4e342e; padding: 15px; margin: 20px 0; border-radius: 6px;">
          <p style="color: #333; margin: 0; font-size: 14px;">
            <strong>📧 Support Email:</strong> support@homebonzenga.com<br/>
            <strong>📱 Support Phone:</strong> +1 (555) 123-4567
          </p>
        </div>
        
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          Thank you for your interest in joining Home Bonzenga.
        </p>
        
        <p style="color: #666; font-size: 14px;">
          Best regards,<br/>
          Home Bonzenga Management Team
        </p>
      </div>
      
      <div style="margin-top: 20px; text-align: center; color: #999; font-size: 12px;">
        <p>This is an automated email. Please do not reply to this message.</p>
      </div>
    </div>
  `;

  return await sendEmail({
    to: email,
    subject: 'Vendor Application Status - Home Bonzenga',
    html
  });
};

module.exports = {
  sendEmail,
  sendVendorApprovalEmail,
  sendVendorRejectionEmail
};


