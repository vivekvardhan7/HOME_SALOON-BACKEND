import nodemailer from 'nodemailer';

// Email service configuration
const isGmail = (process.env.SMTP_HOST || '').includes('gmail');
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;

const transporterConfig: any = {
  service: isGmail ? 'gmail' : undefined,
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: (process.env.SMTP_PORT || '587') === '465',
};

if (smtpUser && smtpPass) {
  transporterConfig.auth = {
    user: smtpUser,
    pass: smtpPass,
  };
}

const transporter = nodemailer.createTransport(transporterConfig);

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send email using configured transporter
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'bookings@homebonzenga.com',
      to: options.to,
      subject: options.subject,
      html: options.html,
      replyTo: process.env.SMTP_USER || undefined,
    });

    console.log('📧 Email sent:', info.messageId);
    return true;
  } catch (error) {
    const err = error as any;
    console.error('❌ Error sending email:', err?.message || err);
    if (err?.response) console.error('SMTP response:', err.response);
    if (err?.code) console.error('SMTP code:', err.code);
    return false;
  }
}

type EmailLocale = 'en' | 'fr';

const FALLBACK_LOCALE: EmailLocale = 'en';

const resolveLocale = (locale?: string | null): EmailLocale => {
  if (!locale) {
    return FALLBACK_LOCALE;
  }
  const normalized = locale.toLowerCase();
  if (normalized.startsWith('fr')) {
    return 'fr';
  }
  return 'en';
};

const DEFAULT_EMAIL_LOCALE = resolveLocale(process.env.DEFAULT_EMAIL_LOCALE || process.env.DEFAULT_LOCALE || undefined);

const interpolate = (template: string, vars: Record<string, string>): string =>
  template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key) => vars[key] ?? '');

const EMAIL_COPY = {
  verification: {
    subject: {
      en: 'Verify your vendor email',
      fr: 'Vérifiez votre e-mail vendeur',
    },
    heading: {
      en: 'Confirm your email address',
      fr: 'Confirmez votre adresse e-mail',
    },
    intro: {
      en: 'Hi {{ownerName}},<br/>Thanks for registering <strong>{{shopName}}</strong> with Home Bonzenga.',
      fr: 'Bonjour {{ownerName}},<br/>Merci d’avoir inscrit <strong>{{shopName}}</strong> sur Home Bonzenga.',
    },
    buttonLabel: {
      en: 'Verify Email',
      fr: 'Vérifier l’e-mail',
    },
    expires: {
      en: 'This verification link expires in 24 hours.',
      fr: 'Ce lien de vérification expire dans 24 heures.',
    },
    altInstructions: {
      en: 'If the button above does not work, copy and paste this URL into your browser:',
      fr: 'Si le bouton ci-dessus ne fonctionne pas, copiez-collez ce lien dans votre navigateur :',
    },
    ignore: {
      en: 'If you did not create this account, you can ignore this message.',
      fr: 'Si vous n’êtes pas à l’origine de cette inscription, vous pouvez ignorer ce message.',
    },
    footer: {
      en: 'Thank you for choosing Home Bonzenga.',
      fr: 'Merci de faire confiance à Home Bonzenga.',
    },
  },
  approval: {
    subject: {
      en: 'Your vendor account has been approved',
      fr: 'Votre compte vendeur a été approuvé',
    },
    heading: {
      en: '🎉 Vendor Account Approved',
      fr: '🎉 Compte vendeur approuvé',
    },
    intro: {
      en: 'Hi {{ownerName}},<br/>Great news! Your vendor account for <strong>{{shopName}}</strong> is now active.',
      fr: 'Bonjour {{ownerName}},<br/>Bonne nouvelle ! Votre compte vendeur pour <strong>{{shopName}}</strong> est maintenant actif.',
    },
    actionsTitle: {
      en: 'You can now:',
      fr: 'Vous pouvez maintenant :',
    },
    actionItems: {
      en: [
        'Access your vendor dashboard',
        'Add services and pricing',
        'Manage products and inventory',
        'Respond to customer bookings',
      ],
      fr: [
        'Accéder à votre tableau de bord vendeur',
        'Ajouter vos services et vos tarifs',
        'Gérer vos produits et votre inventaire',
        'Répondre aux réservations des clientes',
      ],
    },
    buttonLabel: {
      en: 'Open Vendor Dashboard',
      fr: 'Ouvrir le tableau de bord vendeur',
    },
    support: {
      en: 'If you need help, contact support@homebonzenga.com.',
      fr: 'Besoin d’aide ? Contactez support@homebonzenga.com.',
    },
    footer: {
      en: 'We are excited to work with you.',
      fr: 'Nous sommes ravis de collaborer avec vous.',
    },
  },
  rejection: {
    subject: {
      en: 'Vendor application update',
      fr: 'Mise à jour de votre candidature vendeur',
    },
    heading: {
      en: 'Vendor Application Status',
      fr: 'Statut de votre candidature vendeur',
    },
    intro: {
      en: 'Hi {{ownerName}},<br/>We reviewed your application for <strong>{{shopName}}</strong> but cannot approve it right now.',
      fr: 'Bonjour {{ownerName}},<br/>Nous avons étudié votre candidature pour <strong>{{shopName}}</strong> mais ne pouvons pas l’approuver pour le moment.',
    },
    reasonTitle: {
      en: 'Reason provided:',
      fr: 'Raison fournie :',
    },
    nextSteps: {
      en: 'You can reply to this email or reach out to support@homebonzenga.com for more information.',
      fr: 'Vous pouvez répondre à cet e-mail ou contacter support@homebonzenga.com pour obtenir plus d’informations.',
    },
    footer: {
      en: 'Thank you for your interest in Home Bonzenga.',
      fr: 'Merci pour votre intérêt envers Home Bonzenga.',
    },
  },
} as const;

const getSectionCopy = <SectionKey extends keyof typeof EMAIL_COPY>(section: SectionKey, locale: EmailLocale) => {
  const rawSection = EMAIL_COPY[section];
  const resolvedLocale = locale;
  const result: Record<string, any> = {};

  Object.entries(rawSection).forEach(([key, value]) => {
    if (value && typeof value === 'object' && 'en' in value) {
      const localizedValue = (value as Record<EmailLocale, any>)[resolvedLocale];
      result[key] = localizedValue ?? (value as Record<EmailLocale, any>)[FALLBACK_LOCALE];
    } else {
      result[key] = value;
    }
  });

  return result;
};

const renderEmailLayout = ({
  heading,
  headerColor,
  bodyHtml,
  footerText,
}: {
  heading: string;
  headerColor: string;
  bodyHtml: string;
  footerText: string;
}) => `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; margin: 0; padding: 0; }
      .container { max-width: 640px; margin: 0 auto; padding: 20px; }
      .card { background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08); }
      .header { background: ${headerColor}; color: #ffffff; padding: 24px 32px; }
      .header h1 { margin: 0; font-size: 24px; }
      .content { padding: 32px; }
      .content p { margin: 0 0 16px; font-size: 16px; }
      .button { display: inline-block; background: #7c3aed; color: #ffffff !important; padding: 14px 28px; text-decoration: none; border-radius: 999px; font-weight: 600; margin: 24px 0; }
      .notice { background: #f1f5f9; border-left: 4px solid #7c3aed; padding: 16px; border-radius: 8px; margin: 24px 0; }
      .footer { text-align: center; font-size: 13px; color: #64748b; padding: 24px; }
      a { color: #7c3aed; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="card">
        <div class="header">
          <h1>${heading}</h1>
        </div>
        <div class="content">
          ${bodyHtml}
        </div>
        <div class="footer">
          ${footerText}
        </div>
      </div>
    </div>
  </body>
</html>
`;

export async function verifyEmailTransport(): Promise<void> {
  try {
    await transporter.verify();
    console.log('📮 SMTP transport verified and ready');
  } catch (error) {
    const err = error as any;
    console.error('❌ SMTP verify failed:', err?.message || err);
    if (err?.response) console.error('SMTP response:', err.response);
    if (err?.code) console.error('SMTP code:', err.code);
  }
}

/**
 * Send vendor signup notification to managers
 */
export async function sendVendorSignupNotificationToManagers(vendorData: {
  shopName: string;
  ownerName: string;
  email: string;
  phone?: string;
  address?: string;
}): Promise<boolean> {
  const managerEmails = (process.env.MANAGER_EMAILS
    ? process.env.MANAGER_EMAILS.split(',')
    : [process.env.ADMIN_EMAIL || 'admin@homebonzenga.com']
  )
    .map(e => e.trim())
    .filter(e => !!e);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #7c3aed; color: white; padding: 20px; text-align: center; }
        .content { background: #f9f9f9; padding: 20px; }
        .footer { text-align: center; padding: 20px; color: #666; }
        .button { background: #7c3aed; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; }
        .info-row { margin: 10px 0; }
        .label { font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>New Vendor Registration</h1>
        </div>
        <div class="content">
          <p>A new vendor has registered and requires your approval:</p>
          
          <div class="info-row">
            <span class="label">Shop Name:</span> ${vendorData.shopName}
          </div>
          <div class="info-row">
            <span class="label">Owner Name:</span> ${vendorData.ownerName}
          </div>
          <div class="info-row">
            <span class="label">Email:</span> ${vendorData.email}
          </div>
          ${vendorData.phone ? `<div class="info-row"><span class="label">Phone:</span> ${vendorData.phone}</div>` : ''}
          ${vendorData.address ? `<div class="info-row"><span class="label">Address:</span> ${vendorData.address}</div>` : ''}
          
          <p style="margin-top: 30px;">
            Please login to review and approve this vendor application.
          </p>
        </div>
        <div class="footer">
          <p>Home Bonzenga Platform</p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Send to all managers
  for (const email of managerEmails) {
    console.log(`📨 Sending manager signup notification to: ${email}`);
    await sendEmail({
      to: email,
      subject: `New Vendor Registration: ${vendorData.shopName}`,
      html,
    });
  }

  return true;
}

export async function sendVendorVerificationEmail(vendorData: {
  email: string;
  shopName: string;
  ownerName: string;
  verifyUrl: string;
  locale?: string;
}): Promise<boolean> {
  const locale = resolveLocale(vendorData.locale ?? DEFAULT_EMAIL_LOCALE);
  const copy = getSectionCopy('verification', locale);
  const html = renderEmailLayout({
    heading: copy.heading as string,
    headerColor: '#7c3aed',
    bodyHtml: `
      <p>${interpolate(copy.intro as string, {
      ownerName: vendorData.ownerName,
      shopName: vendorData.shopName,
    })}</p>
      <p style="text-align:center;">
        <a href="${vendorData.verifyUrl}" class="button">${copy.buttonLabel}</a>
      </p>
      <p>${copy.expires}</p>
      <p>${copy.altInstructions}</p>
      <p><a href="${vendorData.verifyUrl}">${vendorData.verifyUrl}</a></p>
      <p>${copy.ignore}</p>
    `,
    footerText: copy.footer as string,
  });

  return await sendEmail({
    to: vendorData.email,
    subject: copy.subject as string,
    html,
  });
}

/**
 * Send approval notification to vendor
 */
export async function sendVendorApprovalNotification(vendorData: {
  email: string;
  shopName: string;
  ownerName: string;
  locale?: string;
}): Promise<boolean> {
  const locale = resolveLocale(vendorData.locale ?? DEFAULT_EMAIL_LOCALE);
  const copy = getSectionCopy('approval', locale);
  const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/vendor`;
  const actions = Array.isArray(copy.actionItems) ? copy.actionItems : [];

  const html = renderEmailLayout({
    heading: copy.heading as string,
    headerColor: '#10b981',
    bodyHtml: `
      <p>${interpolate(copy.intro as string, {
      ownerName: vendorData.ownerName,
      shopName: vendorData.shopName,
    })}</p>
      <p><strong>${copy.actionsTitle}</strong></p>
      <ul>
        ${actions.map(item => `<li>${item}</li>`).join('')}
      </ul>
      <p style="text-align:center;">
        <a href="${dashboardUrl}" class="button">${copy.buttonLabel}</a>
      </p>
      <p>${copy.support}</p>
    `,
    footerText: copy.footer as string,
  });

  return await sendEmail({
    to: vendorData.email,
    subject: copy.subject as string,
    html,
  });
}

/**
 * Send rejection notification to vendor
 */
export async function sendVendorRejectionNotification(vendorData: {
  email: string;
  shopName: string;
  ownerName: string;
  reason?: string;
  locale?: string;
}): Promise<boolean> {
  const locale = resolveLocale(vendorData.locale ?? DEFAULT_EMAIL_LOCALE);
  const copy = getSectionCopy('rejection', locale);
  const reasonHtml = vendorData.reason
    ? `
      <div class="notice">
        <strong>${copy.reasonTitle}</strong>
        <p>${vendorData.reason}</p>
      </div>
    `
    : '';

  const html = renderEmailLayout({
    heading: copy.heading as string,
    headerColor: '#ef4444',
    bodyHtml: `
      <p>${interpolate(copy.intro as string, {
      ownerName: vendorData.ownerName,
      shopName: vendorData.shopName,
    })}</p>
      ${reasonHtml}
      <p>${copy.nextSteps}</p>
    `,
    footerText: copy.footer as string,
  });

  return await sendEmail({
    to: vendorData.email,
    subject: copy.subject as string,
    html,
  });
}


/**
 * Send assignment notification to Beautician
 */
export async function sendBeauticianAssignmentEmail(data: {
  email: string;
  beauticianName: string;
  customerName: string;
  customerAddress: string;
  services: string[];
  products: string[];
  slotDate: string;
  slotTime: string;
}): Promise<boolean> {
  const html = renderEmailLayout({
    heading: 'New Service Assignment',
    headerColor: '#7c3aed',
    bodyHtml: `
      <p>Hi ${data.beauticianName},</p>
      <p>You have been assigned a new at-home service request.</p>
      
      <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <h3 style="margin-top:0;">Request Details</h3>
        <p><strong>Date:</strong> ${data.slotDate} at ${data.slotTime}</p>
        <p><strong>Customer:</strong> ${data.customerName}</p>
        <p><strong>Address:</strong> ${data.customerAddress}</p>
      </div>

      <div style="margin: 15px 0;">
        <strong>Services to Provide:</strong>
        <ul>
          ${data.services.map(s => `<li>${s}</li>`).join('')}
        </ul>
      </div>

      ${data.products.length > 0 ? `
      <div style="margin: 15px 0;">
        <strong>Products to Carry:</strong>
        <ul>
          ${data.products.map(p => `<li>${p}</li>`).join('')}
        </ul>
      </div>` : ''}

      <p>Please ensure you arrive on time and update your status in the app.</p>
    `,
    footerText: 'Home Bonzenga Team'
  });

  return await sendEmail({
    to: data.email,
    subject: 'New At-Home Service Assigned',
    html,
  });
}

/**
 * Send assignment notification to Customer
 */
export async function sendCustomerBeauticianAssignedEmail(data: {
  email: string;
  customerName: string;
  beauticianName: string;
  beauticianPhone: string;
  slotDate: string;
  slotTime: string;
  customerAddress: string;
  services: string[];
  products: string[];
  trackingLink?: string;
}): Promise<boolean> {
  const html = renderEmailLayout({
    heading: 'Beautician Assigned!',
    headerColor: '#10b981',
    bodyHtml: `
      <p>Hi ${data.customerName},</p>
      <p>Great news! <strong>${data.beauticianName}</strong> has been assigned to your booking.</p>
      
      <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <p><strong>Beautician:</strong> ${data.beauticianName}</p>
        <p><strong>Phone:</strong> ${data.beauticianPhone}</p>
        <p><strong>Scheduled For:</strong> ${data.slotDate} at ${data.slotTime}</p>
        <p><strong>Location:</strong> ${data.customerAddress}</p>
      </div>

      <div style="margin: 15px 0;">
        <strong>Service Details:</strong>
        <ul>
          ${data.services.map(s => `<li>${s}</li>`).join('')}
        </ul>
      </div>

      ${data.products.length > 0 ? `
      <div style="margin: 15px 0;">
        <strong>Products Included:</strong>
        <ul>
          ${data.products.map(p => `<li>${p}</li>`).join('')}
        </ul>
      </div>` : ''}

      <p>Your beautician will arrive at your location at the scheduled time.</p>
      
      ${data.trackingLink ? `
      <p style="text-align: center;">
        <a href="${data.trackingLink}" class="button">Track Status</a>
      </p>
      ` : ''}
    `,
    footerText: 'Home Bonzenga Team'
  });

  return await sendEmail({
    to: data.email,
    subject: 'Beautician Assigned - Home Bonzenga',
    html,
  });
}
/**
 * Send booking confirmation to Customer
 */
export async function sendBookingConfirmationEmail(data: {
  email: string;
  customerName: string;
  bookingType: string;
  items: string[];
  total: number;
  slotDate: string;
  slotTime: string;
  bookingLink?: string;
}): Promise<boolean> {
  const html = renderEmailLayout({
    heading: 'Booking Confirmed!',
    headerColor: '#7c3aed',
    bodyHtml: `
      <p>Hi ${data.customerName},</p>
      <p>Your <strong>${data.bookingType}</strong> booking has been successfully placed.</p>
      
      <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <h3 style="margin-top:0;">Booking Details</h3>
        <p><strong>Date:</strong> ${data.slotDate} at ${data.slotTime}</p>
        <p><strong>Items:</strong></p>
        <ul>
          ${data.items.map(s => `<li>${s}</li>`).join('')}
        </ul>
        <p><strong>Total Amount:</strong> ${data.total.toLocaleString()} CDF</p>
      </div>

      <p>We will notify you once a beautician/vendor accepts your request.</p>
      
      ${data.bookingLink ? `
      <p style="text-align: center;">
        <a href="${data.bookingLink}" class="button">View Booking</a>
      </p>
      ` : ''}
    `,
    footerText: 'Home Bonzenga Team'
  });

  return await sendEmail({
    to: data.email,
    subject: 'Booking Confirmation - Home Bonzenga',
    html,
  });
}
