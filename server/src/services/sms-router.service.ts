import { sendSms as send019Sms } from './sms.service.js';
import { sendTwilioSms } from './twilio-sms.service.js';
import { logger } from '../config/logger.js';
import { getRawSettings } from './settings.service.js';

export async function sendSmsByRegion(
  to: string,
  body: string,
  organizationId?: string,
  options?: { templateIdentifier?: string; userId?: string; languageUsed?: string },
) {
  const config = await getRawSettings(organizationId);

  const region = config?.region || 'IL';

  if (region === 'IL') {
    // Israel: use 019 SMS provider
    if (config?.smsEnabled) {
      await send019Sms(to, body, options);
    } else {
      logger.info('019 SMS not enabled for IL region, skipping');
    }
  } else {
    // International: use Twilio
    if (config?.twilioEnabled) {
      await sendTwilioSms(to, body, organizationId);
    } else {
      logger.info('Twilio not enabled for INTL region, skipping');
    }
  }
}
