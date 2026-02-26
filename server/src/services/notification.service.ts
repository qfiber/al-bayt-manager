import { db } from '../config/database.js';
import { logger } from '../config/logger.js';
import { settings, buildings, userRoles, moderatorBuildings, profiles, users, apartments, userApartments } from '../db/schema/index.js';
import { eq, inArray } from 'drizzle-orm';
import * as emailService from './email.service.js';
import { resolveNtfyTemplate } from './ntfy-template.service.js';

/**
 * Send a push notification to a building's ntfy topic using a DB template.
 * Fire-and-forget: errors are logged but never thrown.
 */
export async function sendNtfyNotification(
  buildingId: string,
  templateIdentifier: string,
  variables: Record<string, string>,
  preferredLanguage: string = 'ar',
): Promise<void> {
  try {
    const [config] = await db.select().from(settings).limit(1);
    if (!config?.ntfyEnabled) return;

    const [building] = await db.select().from(buildings).where(eq(buildings.id, buildingId)).limit(1);
    if (!building?.ntfyTopicUrl) return;

    const resolved = await resolveNtfyTemplate(templateIdentifier, preferredLanguage, variables);
    if (!resolved) {
      logger.warn(`Ntfy template not found: ${templateIdentifier}, skipping notification`);
      return;
    }

    // Determine full URL: if it looks like a full URL use it, otherwise combine with server URL
    let topicUrl = building.ntfyTopicUrl;
    if (!topicUrl.startsWith('http')) {
      const serverUrl = config.ntfyServerUrl || 'https://ntfy.sh';
      topicUrl = `${serverUrl.replace(/\/$/, '')}/${topicUrl}`;
    }

    await fetch(topicUrl, {
      method: 'POST',
      headers: { Title: resolved.title },
      body: resolved.message,
    });
  } catch (err) {
    logger.error(err, 'Failed to send ntfy notification');
  }
}

/**
 * Notify admins and building moderators about a new issue report.
 */
export async function notifyNewIssue(buildingId: string, issueDetails: {
  category: string;
  description: string;
  reporterName: string;
  floor?: number | null;
}): Promise<void> {
  const variables = {
    category: issueDetails.category,
    description: issueDetails.description.slice(0, 200),
    reporterName: issueDetails.reporterName,
    floor: issueDetails.floor?.toString() || '-',
  };

  // Send ntfy push
  sendNtfyNotification(buildingId, 'ntfy_new_issue', variables).catch(() => {});

  // Send emails to admins + moderators
  try {
    // Get admin user IDs
    const adminRoles = await db
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .where(eq(userRoles.role, 'admin'));

    // Get moderator user IDs for this building
    const modRows = await db
      .select({ userId: moderatorBuildings.userId })
      .from(moderatorBuildings)
      .where(eq(moderatorBuildings.buildingId, buildingId));

    const recipientIds = [...new Set([
      ...adminRoles.map(r => r.userId),
      ...modRows.map(r => r.userId),
    ])];

    if (recipientIds.length === 0) return;

    // Get recipient emails and preferred languages
    const recipientProfiles = await db
      .select({ id: profiles.id, preferredLanguage: profiles.preferredLanguage })
      .from(profiles)
      .where(inArray(profiles.id, recipientIds));

    const recipientUsers = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(inArray(users.id, recipientIds));

    const emailMap = new Map(recipientUsers.map(u => [u.id, u.email]));
    const langMap = new Map(recipientProfiles.map(p => [p.id, p.preferredLanguage]));

    for (const id of recipientIds) {
      const email = emailMap.get(id);
      if (!email) continue;
      emailService.sendEmail({
        templateIdentifier: 'new_issue_report',
        recipientEmail: email,
        userId: id,
        preferredLanguage: langMap.get(id) || 'ar',
        variables: {
          category: issueDetails.category,
          description: issueDetails.description.slice(0, 500),
          reporterName: issueDetails.reporterName,
          floor: issueDetails.floor?.toString() || '-',
        },
      }).catch(err => logger.error(err, 'Failed to send new issue email'));
    }
  } catch (err) {
    logger.error(err, 'Failed to notify about new issue');
  }
}

/**
 * Notify the reporter that their issue has been resolved.
 */
export async function notifyIssueResolved(reporterId: string, issueDetails: {
  category: string;
  description: string;
}): Promise<void> {
  try {
    const [profile] = await db
      .select({ preferredLanguage: profiles.preferredLanguage })
      .from(profiles)
      .where(eq(profiles.id, reporterId))
      .limit(1);

    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, reporterId))
      .limit(1);

    if (!user?.email) return;

    await emailService.sendEmail({
      templateIdentifier: 'issue_resolved',
      recipientEmail: user.email,
      userId: reporterId,
      preferredLanguage: profile?.preferredLanguage || 'ar',
      variables: {
        category: issueDetails.category,
        description: issueDetails.description.slice(0, 500),
      },
    });
  } catch (err) {
    logger.error(err, 'Failed to notify issue resolved');
  }
}

/**
 * Send a payment reminder to the tenant(s) assigned to an apartment.
 */
export async function sendPaymentReminder(apartmentId: string): Promise<void> {
  try {
    const [apt] = await db.select().from(apartments).where(eq(apartments.id, apartmentId)).limit(1);
    if (!apt) return;

    // Find assigned users for this apartment
    const assignments = await db
      .select({ userId: userApartments.userId })
      .from(userApartments)
      .where(eq(userApartments.apartmentId, apartmentId));

    if (assignments.length === 0) return;

    const userIds = assignments.map(a => a.userId);
    const recipientUsers = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(inArray(users.id, userIds));

    const recipientProfiles = await db
      .select({ id: profiles.id, preferredLanguage: profiles.preferredLanguage })
      .from(profiles)
      .where(inArray(profiles.id, userIds));

    const langMap = new Map(recipientProfiles.map(p => [p.id, p.preferredLanguage]));

    const [building] = await db.select({ name: buildings.name }).from(buildings).where(eq(buildings.id, apt.buildingId)).limit(1);

    for (const user of recipientUsers) {
      emailService.sendEmail({
        templateIdentifier: 'payment_reminder',
        recipientEmail: user.email,
        userId: user.id,
        preferredLanguage: langMap.get(user.id) || 'ar',
        variables: {
          apartmentNumber: apt.apartmentNumber,
          buildingName: building?.name || '',
          balance: apt.cachedBalance,
        },
      }).catch(err => logger.error(err, 'Failed to send payment reminder email'));
    }

    // Also send ntfy push
    sendNtfyNotification(apt.buildingId, 'ntfy_payment_reminder', {
      apartmentNumber: apt.apartmentNumber,
      balance: apt.cachedBalance,
    }).catch(() => {});
  } catch (err) {
    logger.error(err, 'Failed to send payment reminder');
  }
}
