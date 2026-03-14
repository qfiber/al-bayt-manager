import cron from 'node-cron';
import { db } from '../config/database.js';
import { logger } from '../config/logger.js';
import { organizations, organizationMembers, users, profiles } from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { getRawSettings } from './settings.service.js';

/**
 * Send monthly reminder to all landlords (org_admins) about their subscription/account status.
 * Runs on the 1st of each month at 08:00.
 */
async function sendLandlordReminders() {
  logger.info('Landlord reminder: Sending monthly subscription reminders');

  try {
    // Get global settings for email
    const config = await getRawSettings();
    if (!config?.resendApiKey) {
      logger.info('Landlord reminder: Email not configured, skipping');
      return;
    }

    // Get all org_admins
    const landlords = await db
      .select({
        email: users.email,
        name: profiles.name,
        orgName: organizations.name,
        orgSubdomain: organizations.subdomain,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(organizationMembers.userId, users.id))
      .leftJoin(profiles, eq(organizationMembers.userId, profiles.id))
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .where(and(
        eq(organizationMembers.role, 'org_admin'),
        eq(organizations.isActive, true),
      ));

    let sent = 0;
    const { Resend } = await import('resend');
    const resend = new Resend(config.resendApiKey);

    for (const landlord of landlords) {
      try {
        await resend.emails.send({
          from: config.smtpFromEmail || 'noreply@example.com',
          to: landlord.email,
          subject: `Monthly Account Summary — ${landlord.orgName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2>Monthly Account Summary</h2>
              <p>Dear ${landlord.name || landlord.email},</p>
              <p>This is your monthly reminder for your organization <strong>${landlord.orgName}</strong>.</p>
              <div style="background: #f4f4f4; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <p><strong>Organization:</strong> ${landlord.orgName}</p>
                ${landlord.orgSubdomain ? `<p><strong>Portal:</strong> ${landlord.orgSubdomain}.yourdomain.com</p>` : ''}
              </div>
              <p>Log in to your dashboard to review your buildings, payments, and tenant status.</p>
              <p style="color: #666; font-size: 12px;">${config.companyName || 'Al-Bayt Manager'}</p>
            </div>
          `,
        });
        sent++;
      } catch (err) {
        logger.error({ err, email: landlord.email }, 'Landlord reminder: Failed to send');
      }
    }

    logger.info({ sent, total: landlords.length }, 'Landlord reminder: Complete');
  } catch (err) {
    logger.error(err, 'Landlord reminder: Error');
  }
}

export function startLandlordReminderCron() {
  // 1st of each month at 08:00
  cron.schedule('0 8 1 * *', () => {
    sendLandlordReminders().catch((err) => logger.error(err, 'Landlord reminder cron failed'));
  });

  logger.info('Landlord reminder cron scheduled: 1st of each month at 08:00');
}

export { sendLandlordReminders };
