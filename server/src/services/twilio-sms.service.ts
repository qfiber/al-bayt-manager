import { logger } from '../config/logger.js';
import { getRawSettings } from './settings.service.js';

export async function sendTwilioSms(to: string, body: string, organizationId?: string) {
  const config = await getRawSettings(organizationId);

  if (!config?.twilioEnabled || !config.twilioAccountSid || !config.twilioAuthToken || !config.twilioPhoneNumber) {
    logger.info('Twilio SMS not configured, skipping');
    return;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.twilioAccountSid}/Messages.json`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${config.twilioAccountSid}:${config.twilioAuthToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      To: to,
      From: config.twilioPhoneNumber,
      Body: body,
    }).toString(),
  });

  const data = await res.json() as any;
  if (data.error_code) {
    logger.error({ error: data.error_message, to }, 'Twilio SMS failed');
    throw new Error(data.error_message);
  }

  logger.info({ to, sid: data.sid }, 'Twilio SMS sent');
  return data;
}
