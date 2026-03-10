import { db } from '../config/database.js';
import { logger } from '../config/logger.js';
import { emailTemplates, emailTemplateTranslations, emailLogs, settings } from '../db/schema/index.js';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { AppError } from '../middleware/error-handler.js';

// ─── Default template definitions (used by ensureDefaultTemplates) ───

const DEFAULT_TEMPLATES = [
  {
    id: 'a0000000-0000-0000-0000-000000000001',
    identifier: 'new_issue_report',
    name: 'New Issue Report',
    description: 'Sent to admins/moderators when a new issue is reported',
    translations: [
      { language: 'ar', subject: 'تقرير عطل جديد', htmlBody: '<h2 style="margin:0 0 16px;color:#92400e;">⚠️ تقرير عطل جديد</h2><p style="margin:0 0 16px;color:#374151;">تم الإبلاغ عن عطل جديد في النظام:</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="padding:12px 16px;background:#fef3c7;border-radius:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:6px 0;color:#92400e;font-weight:600;width:100px;">الفئة:</td><td style="padding:6px 0;color:#1f2937;">{{category}}</td></tr><tr><td style="padding:6px 0;color:#92400e;font-weight:600;">الوصف:</td><td style="padding:6px 0;color:#1f2937;">{{description}}</td></tr><tr><td style="padding:6px 0;color:#92400e;font-weight:600;">المُبلّغ:</td><td style="padding:6px 0;color:#1f2937;">{{reporterName}}</td></tr><tr><td style="padding:6px 0;color:#92400e;font-weight:600;">الطابق:</td><td style="padding:6px 0;color:#1f2937;">{{floor}}</td></tr></table></td></tr></table><p style="margin:0;color:#6b7280;font-size:13px;">يرجى التعامل مع هذا العطل في أقرب وقت ممكن.</p>' },
      { language: 'he', subject: 'דיווח תקלה חדש', htmlBody: '<h2 style="margin:0 0 16px;color:#92400e;">⚠️ דיווח תקלה חדש</h2><p style="margin:0 0 16px;color:#374151;">דווחה תקלה חדשה במערכת:</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="padding:12px 16px;background:#fef3c7;border-radius:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:6px 0;color:#92400e;font-weight:600;width:100px;">קטגוריה:</td><td style="padding:6px 0;color:#1f2937;">{{category}}</td></tr><tr><td style="padding:6px 0;color:#92400e;font-weight:600;">תיאור:</td><td style="padding:6px 0;color:#1f2937;">{{description}}</td></tr><tr><td style="padding:6px 0;color:#92400e;font-weight:600;">מדווח:</td><td style="padding:6px 0;color:#1f2937;">{{reporterName}}</td></tr><tr><td style="padding:6px 0;color:#92400e;font-weight:600;">קומה:</td><td style="padding:6px 0;color:#1f2937;">{{floor}}</td></tr></table></td></tr></table><p style="margin:0;color:#6b7280;font-size:13px;">אנא טפלו בתקלה בהקדם האפשרי.</p>' },
      { language: 'en', subject: 'New Issue Report', htmlBody: '<h2 style="margin:0 0 16px;color:#92400e;">⚠️ New Issue Report</h2><p style="margin:0 0 16px;color:#374151;">A new issue has been reported in the system:</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="padding:12px 16px;background:#fef3c7;border-radius:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:6px 0;color:#92400e;font-weight:600;width:100px;">Category:</td><td style="padding:6px 0;color:#1f2937;">{{category}}</td></tr><tr><td style="padding:6px 0;color:#92400e;font-weight:600;">Description:</td><td style="padding:6px 0;color:#1f2937;">{{description}}</td></tr><tr><td style="padding:6px 0;color:#92400e;font-weight:600;">Reporter:</td><td style="padding:6px 0;color:#1f2937;">{{reporterName}}</td></tr><tr><td style="padding:6px 0;color:#92400e;font-weight:600;">Floor:</td><td style="padding:6px 0;color:#1f2937;">{{floor}}</td></tr></table></td></tr></table><p style="margin:0;color:#6b7280;font-size:13px;">Please address this issue as soon as possible.</p>' },
    ],
  },
  {
    id: 'a0000000-0000-0000-0000-000000000002',
    identifier: 'issue_resolved',
    name: 'Issue Resolved',
    description: 'Sent to the reporter when their issue is resolved',
    translations: [
      { language: 'ar', subject: 'تم حل العطل', htmlBody: '<h2 style="margin:0 0 16px;color:#15803d;">✅ تم حل العطل</h2><p style="margin:0 0 16px;color:#374151;">نود إعلامك بأن العطل التالي قد تم حله بنجاح:</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="padding:12px 16px;background:#dcfce7;border-radius:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:6px 0;color:#15803d;font-weight:600;width:100px;">الفئة:</td><td style="padding:6px 0;color:#1f2937;">{{category}}</td></tr><tr><td style="padding:6px 0;color:#15803d;font-weight:600;">الوصف:</td><td style="padding:6px 0;color:#1f2937;">{{description}}</td></tr></table></td></tr></table><p style="margin:0;color:#374151;">شكراً لتبليغك. نحن نسعى دائماً لتقديم أفضل خدمة.</p>' },
      { language: 'he', subject: 'התקלה טופלה', htmlBody: '<h2 style="margin:0 0 16px;color:#15803d;">✅ התקלה טופלה</h2><p style="margin:0 0 16px;color:#374151;">ברצוננו לעדכן אותך שהתקלה הבאה טופלה בהצלחה:</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="padding:12px 16px;background:#dcfce7;border-radius:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:6px 0;color:#15803d;font-weight:600;width:100px;">קטגוריה:</td><td style="padding:6px 0;color:#1f2937;">{{category}}</td></tr><tr><td style="padding:6px 0;color:#15803d;font-weight:600;">תיאור:</td><td style="padding:6px 0;color:#1f2937;">{{description}}</td></tr></table></td></tr></table><p style="margin:0;color:#374151;">תודה על הדיווח. אנו שואפים תמיד לספק את השירות הטוב ביותר.</p>' },
      { language: 'en', subject: 'Issue Resolved', htmlBody: '<h2 style="margin:0 0 16px;color:#15803d;">✅ Issue Resolved</h2><p style="margin:0 0 16px;color:#374151;">We would like to inform you that the following issue has been resolved successfully:</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="padding:12px 16px;background:#dcfce7;border-radius:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:6px 0;color:#15803d;font-weight:600;width:100px;">Category:</td><td style="padding:6px 0;color:#1f2937;">{{category}}</td></tr><tr><td style="padding:6px 0;color:#15803d;font-weight:600;">Description:</td><td style="padding:6px 0;color:#1f2937;">{{description}}</td></tr></table></td></tr></table><p style="margin:0;color:#374151;">Thank you for reporting. We always strive to provide the best service.</p>' },
    ],
  },
  {
    id: 'a0000000-0000-0000-0000-000000000003',
    identifier: 'payment_reminder',
    name: 'Payment Reminder',
    description: 'Sent to tenants to remind them of outstanding balance',
    translations: [
      { language: 'ar', subject: 'تذكير بالدفع', htmlBody: '<h2 style="margin:0 0 16px;color:#dc2626;">💳 تذكير بالدفع</h2><p style="margin:0 0 16px;color:#374151;">نود تذكيرك بوجود رصيد مستحق على شقتك:</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="padding:12px 16px;background:#fee2e2;border-radius:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:6px 0;color:#991b1b;font-weight:600;width:120px;">المبنى:</td><td style="padding:6px 0;color:#1f2937;">{{buildingName}}</td></tr><tr><td style="padding:6px 0;color:#991b1b;font-weight:600;">شقة:</td><td style="padding:6px 0;color:#1f2937;">{{apartmentNumber}}</td></tr></table></td></tr></table><div style="text-align:center;margin:0 0 20px;"><p style="margin:0 0 4px;color:#6b7280;font-size:13px;">الرصيد المستحق</p><p style="margin:0;font-size:32px;font-weight:700;color:#dc2626;">₪{{balance}}</p></div><p style="margin:0;color:#374151;">يرجى الدفع في أقرب وقت ممكن لتجنب أي رسوم إضافية.</p>' },
      { language: 'he', subject: 'תזכורת תשלום', htmlBody: '<h2 style="margin:0 0 16px;color:#dc2626;">💳 תזכורת תשלום</h2><p style="margin:0 0 16px;color:#374151;">ברצוננו להזכיר לך על יתרת חוב בדירתך:</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="padding:12px 16px;background:#fee2e2;border-radius:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:6px 0;color:#991b1b;font-weight:600;width:120px;">בניין:</td><td style="padding:6px 0;color:#1f2937;">{{buildingName}}</td></tr><tr><td style="padding:6px 0;color:#991b1b;font-weight:600;">דירה:</td><td style="padding:6px 0;color:#1f2937;">{{apartmentNumber}}</td></tr></table></td></tr></table><div style="text-align:center;margin:0 0 20px;"><p style="margin:0 0 4px;color:#6b7280;font-size:13px;">יתרת חוב</p><p style="margin:0;font-size:32px;font-weight:700;color:#dc2626;">₪{{balance}}</p></div><p style="margin:0;color:#374151;">אנא בצע תשלום בהקדם האפשרי כדי למנוע חיובים נוספים.</p>' },
      { language: 'en', subject: 'Payment Reminder', htmlBody: '<h2 style="margin:0 0 16px;color:#dc2626;">💳 Payment Reminder</h2><p style="margin:0 0 16px;color:#374151;">This is a reminder that you have an outstanding balance on your apartment:</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="padding:12px 16px;background:#fee2e2;border-radius:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:6px 0;color:#991b1b;font-weight:600;width:120px;">Building:</td><td style="padding:6px 0;color:#1f2937;">{{buildingName}}</td></tr><tr><td style="padding:6px 0;color:#991b1b;font-weight:600;">Apartment:</td><td style="padding:6px 0;color:#1f2937;">{{apartmentNumber}}</td></tr></table></td></tr></table><div style="text-align:center;margin:0 0 20px;"><p style="margin:0 0 4px;color:#6b7280;font-size:13px;">Balance Due</p><p style="margin:0;font-size:32px;font-weight:700;color:#dc2626;">₪{{balance}}</p></div><p style="margin:0;color:#374151;">Please make a payment at your earliest convenience to avoid any additional charges.</p>' },
    ],
  },
  {
    id: 'a0000000-0000-0000-0000-000000000004',
    identifier: 'otp_email_change',
    name: 'Email Change Verification',
    description: 'Sends OTP code when user requests email change',
    translations: [
      { language: 'ar', subject: 'رمز التحقق لتغيير البريد الإلكتروني', htmlBody: '<h2 style="margin:0 0 16px;color:#1d4ed8;">🔐 رمز التحقق</h2><p style="margin:0 0 20px;color:#374151;">رمز التحقق الخاص بك لتغيير البريد الإلكتروني هو:</p><div style="text-align:center;margin:0 0 20px;"><div style="display:inline-block;padding:16px 32px;background:#dbeafe;border-radius:12px;border:2px dashed #93c5fd;"><span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#1d4ed8;font-family:monospace;">{{otp}}</span></div></div><p style="margin:0 0 8px;color:#374151;">هذا الرمز صالح لمدة <strong>10 دقائق</strong>.</p><p style="margin:0;color:#6b7280;font-size:13px;">إذا لم تطلب تغيير بريدك الإلكتروني، يرجى تجاهل هذه الرسالة.</p>' },
      { language: 'he', subject: 'קוד אימות לשינוי כתובת אימייל', htmlBody: '<h2 style="margin:0 0 16px;color:#1d4ed8;">🔐 קוד אימות</h2><p style="margin:0 0 20px;color:#374151;">קוד האימות שלך לשינוי כתובת אימייל:</p><div style="text-align:center;margin:0 0 20px;"><div style="display:inline-block;padding:16px 32px;background:#dbeafe;border-radius:12px;border:2px dashed #93c5fd;"><span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#1d4ed8;font-family:monospace;">{{otp}}</span></div></div><p style="margin:0 0 8px;color:#374151;">הקוד תקף למשך <strong>10 דקות</strong>.</p><p style="margin:0;color:#6b7280;font-size:13px;">אם לא ביקשת לשנות את כתובת האימייל שלך, התעלם מהודעה זו.</p>' },
      { language: 'en', subject: 'Verification code for email change', htmlBody: '<h2 style="margin:0 0 16px;color:#1d4ed8;">🔐 Verification Code</h2><p style="margin:0 0 20px;color:#374151;">Your verification code for email change is:</p><div style="text-align:center;margin:0 0 20px;"><div style="display:inline-block;padding:16px 32px;background:#dbeafe;border-radius:12px;border:2px dashed #93c5fd;"><span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#1d4ed8;font-family:monospace;">{{otp}}</span></div></div><p style="margin:0 0 8px;color:#374151;">This code is valid for <strong>10 minutes</strong>.</p><p style="margin:0;color:#6b7280;font-size:13px;">If you did not request an email change, please ignore this message.</p>' },
    ],
  },
  {
    id: 'a0000000-0000-0000-0000-000000000005',
    identifier: 'payment_confirmation',
    name: 'Payment Confirmation',
    description: 'Sent to tenants when a payment is recorded on their apartment',
    translations: [
      { language: 'ar', subject: 'تأكيد الدفع', htmlBody: '<h2 style="margin:0 0 16px;color:#15803d;">✅ تأكيد الدفع</h2><p style="margin:0 0 16px;color:#374151;">تم تسجيل دفعة جديدة على شقتك بنجاح:</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="padding:12px 16px;background:#dcfce7;border-radius:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:6px 0;color:#15803d;font-weight:600;width:120px;">المبنى:</td><td style="padding:6px 0;color:#1f2937;">{{buildingName}}</td></tr><tr><td style="padding:6px 0;color:#15803d;font-weight:600;">شقة:</td><td style="padding:6px 0;color:#1f2937;">{{apartmentNumber}}</td></tr><tr><td style="padding:6px 0;color:#15803d;font-weight:600;">الشهر:</td><td style="padding:6px 0;color:#1f2937;">{{month}}</td></tr></table></td></tr></table><div style="text-align:center;margin:0 0 20px;"><p style="margin:0 0 4px;color:#6b7280;font-size:13px;">المبلغ المدفوع</p><p style="margin:0;font-size:32px;font-weight:700;color:#15803d;">{{currencySymbol}}{{amount}}</p></div><p style="margin:0;color:#374151;">شكراً لدفعتك.</p>' },
      { language: 'he', subject: 'אישור תשלום', htmlBody: '<h2 style="margin:0 0 16px;color:#15803d;">✅ אישור תשלום</h2><p style="margin:0 0 16px;color:#374151;">תשלום חדש נרשם בהצלחה על הדירה שלך:</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="padding:12px 16px;background:#dcfce7;border-radius:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:6px 0;color:#15803d;font-weight:600;width:120px;">בניין:</td><td style="padding:6px 0;color:#1f2937;">{{buildingName}}</td></tr><tr><td style="padding:6px 0;color:#15803d;font-weight:600;">דירה:</td><td style="padding:6px 0;color:#1f2937;">{{apartmentNumber}}</td></tr><tr><td style="padding:6px 0;color:#15803d;font-weight:600;">חודש:</td><td style="padding:6px 0;color:#1f2937;">{{month}}</td></tr></table></td></tr></table><div style="text-align:center;margin:0 0 20px;"><p style="margin:0 0 4px;color:#6b7280;font-size:13px;">הסכום ששולם</p><p style="margin:0;font-size:32px;font-weight:700;color:#15803d;">{{currencySymbol}}{{amount}}</p></div><p style="margin:0;color:#374151;">תודה על התשלום.</p>' },
      { language: 'en', subject: 'Payment Confirmation', htmlBody: '<h2 style="margin:0 0 16px;color:#15803d;">✅ Payment Confirmation</h2><p style="margin:0 0 16px;color:#374151;">A new payment has been recorded on your apartment:</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="padding:12px 16px;background:#dcfce7;border-radius:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:6px 0;color:#15803d;font-weight:600;width:120px;">Building:</td><td style="padding:6px 0;color:#1f2937;">{{buildingName}}</td></tr><tr><td style="padding:6px 0;color:#15803d;font-weight:600;">Apartment:</td><td style="padding:6px 0;color:#1f2937;">{{apartmentNumber}}</td></tr><tr><td style="padding:6px 0;color:#15803d;font-weight:600;">Month:</td><td style="padding:6px 0;color:#1f2937;">{{month}}</td></tr></table></td></tr></table><div style="text-align:center;margin:0 0 20px;"><p style="margin:0 0 4px;color:#6b7280;font-size:13px;">Amount Paid</p><p style="margin:0;font-size:32px;font-weight:700;color:#15803d;">{{currencySymbol}}{{amount}}</p></div><p style="margin:0;color:#374151;">Thank you for your payment.</p>' },
    ],
  },
  {
    id: 'a0000000-0000-0000-0000-000000000006',
    identifier: 'payment_canceled',
    name: 'Payment Canceled',
    description: 'Sent to tenants when a payment on their apartment is canceled',
    translations: [
      { language: 'ar', subject: 'إلغاء دفعة', htmlBody: '<h2 style="margin:0 0 16px;color:#dc2626;">❌ إلغاء دفعة</h2><p style="margin:0 0 16px;color:#374151;">نود إعلامك بأن دفعة مسجلة على شقتك تم إلغاؤها:</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="padding:12px 16px;background:#fee2e2;border-radius:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:6px 0;color:#991b1b;font-weight:600;width:120px;">المبنى:</td><td style="padding:6px 0;color:#1f2937;">{{buildingName}}</td></tr><tr><td style="padding:6px 0;color:#991b1b;font-weight:600;">شقة:</td><td style="padding:6px 0;color:#1f2937;">{{apartmentNumber}}</td></tr><tr><td style="padding:6px 0;color:#991b1b;font-weight:600;">الشهر:</td><td style="padding:6px 0;color:#1f2937;">{{month}}</td></tr></table></td></tr></table><div style="text-align:center;margin:0 0 20px;"><p style="margin:0 0 4px;color:#6b7280;font-size:13px;">المبلغ الملغى</p><p style="margin:0;font-size:32px;font-weight:700;color:#dc2626;">{{currencySymbol}}{{amount}}</p></div><p style="margin:0;color:#374151;">إذا كان لديك أي استفسار، يرجى التواصل مع إدارة المبنى.</p>' },
      { language: 'he', subject: 'ביטול תשלום', htmlBody: '<h2 style="margin:0 0 16px;color:#dc2626;">❌ ביטול תשלום</h2><p style="margin:0 0 16px;color:#374151;">ברצוננו לעדכן אותך שתשלום שנרשם על הדירה שלך בוטל:</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="padding:12px 16px;background:#fee2e2;border-radius:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:6px 0;color:#991b1b;font-weight:600;width:120px;">בניין:</td><td style="padding:6px 0;color:#1f2937;">{{buildingName}}</td></tr><tr><td style="padding:6px 0;color:#991b1b;font-weight:600;">דירה:</td><td style="padding:6px 0;color:#1f2937;">{{apartmentNumber}}</td></tr><tr><td style="padding:6px 0;color:#991b1b;font-weight:600;">חודש:</td><td style="padding:6px 0;color:#1f2937;">{{month}}</td></tr></table></td></tr></table><div style="text-align:center;margin:0 0 20px;"><p style="margin:0 0 4px;color:#6b7280;font-size:13px;">הסכום שבוטל</p><p style="margin:0;font-size:32px;font-weight:700;color:#dc2626;">{{currencySymbol}}{{amount}}</p></div><p style="margin:0;color:#374151;">אם יש לך שאלות, אנא פנה להנהלת הבניין.</p>' },
      { language: 'en', subject: 'Payment Canceled', htmlBody: '<h2 style="margin:0 0 16px;color:#dc2626;">❌ Payment Canceled</h2><p style="margin:0 0 16px;color:#374151;">We would like to inform you that a payment recorded on your apartment has been canceled:</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="padding:12px 16px;background:#fee2e2;border-radius:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:6px 0;color:#991b1b;font-weight:600;width:120px;">Building:</td><td style="padding:6px 0;color:#1f2937;">{{buildingName}}</td></tr><tr><td style="padding:6px 0;color:#991b1b;font-weight:600;">Apartment:</td><td style="padding:6px 0;color:#1f2937;">{{apartmentNumber}}</td></tr><tr><td style="padding:6px 0;color:#991b1b;font-weight:600;">Month:</td><td style="padding:6px 0;color:#1f2937;">{{month}}</td></tr></table></td></tr></table><div style="text-align:center;margin:0 0 20px;"><p style="margin:0 0 4px;color:#6b7280;font-size:13px;">Amount Canceled</p><p style="margin:0;font-size:32px;font-weight:700;color:#dc2626;">{{currencySymbol}}{{amount}}</p></div><p style="margin:0;color:#374151;">If you have any questions, please contact building management.</p>' },
    ],
  },
];

// ─── Ensure default templates exist (called on server startup) ───

export async function ensureDefaultTemplates() {
  for (const tmpl of DEFAULT_TEMPLATES) {
    const [existing] = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.identifier, tmpl.identifier))
      .limit(1);

    if (!existing) {
      logger.info(`Seeding default email template: ${tmpl.identifier}`);
      const [created] = await db.insert(emailTemplates).values({
        id: tmpl.id,
        identifier: tmpl.identifier,
        name: tmpl.name,
        description: tmpl.description,
      }).returning();

      await db.insert(emailTemplateTranslations).values(
        tmpl.translations.map((t) => ({
          templateId: created.id,
          language: t.language,
          subject: t.subject,
          htmlBody: t.htmlBody,
        })),
      );
    }
  }
}

// ─── Template CRUD ───

export async function listTemplates() {
  const templates = await db.select().from(emailTemplates).orderBy(emailTemplates.name);

  const translations = await db.select().from(emailTemplateTranslations);

  return templates.map((t) => ({
    ...t,
    translations: translations.filter((tr) => tr.templateId === t.id),
  }));
}

export async function getTemplate(id: string) {
  const [template] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id)).limit(1);
  if (!template) throw new AppError(404, 'Template not found');

  const translations = await db
    .select()
    .from(emailTemplateTranslations)
    .where(eq(emailTemplateTranslations.templateId, id));

  return { ...template, translations };
}

export async function updateTemplate(id: string, data: { name?: string; description?: string }) {
  const [template] = await db
    .update(emailTemplates)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(emailTemplates.id, id))
    .returning();
  if (!template) throw new AppError(404, 'Template not found');
  return template;
}

export async function updateTranslations(templateId: string, translations: {
  language: string;
  subject: string;
  htmlBody: string;
}[]) {
  return await db.transaction(async (tx) => {
    // Delete existing translations for this template
    await tx.delete(emailTemplateTranslations).where(eq(emailTemplateTranslations.templateId, templateId));

    // Insert new translations
    if (translations.length > 0) {
      await tx.insert(emailTemplateTranslations).values(
        translations.map((t) => ({ ...t, templateId })),
      );
    }

    return { success: true };
  });
}

// ─── Email layout wrapper ───

const TEMPLATE_COLORS: Record<string, { accent: string; accentLight: string; icon: string }> = {
  new_issue_report: { accent: '#d97706', accentLight: '#fef3c7', icon: '⚠️' },
  issue_resolved:   { accent: '#16a34a', accentLight: '#dcfce7', icon: '✅' },
  payment_reminder: { accent: '#dc2626', accentLight: '#fee2e2', icon: '💳' },
  otp_email_change: { accent: '#2563eb', accentLight: '#dbeafe', icon: '🔐' },
  payment_confirmation: { accent: '#16a34a', accentLight: '#dcfce7', icon: '✅' },
  payment_canceled:     { accent: '#dc2626', accentLight: '#fee2e2', icon: '❌' },
};

const DEFAULT_COLOR = { accent: '#6366f1', accentLight: '#e0e7ff', icon: '📧' };

function wrapEmailHtml(
  templateIdentifier: string,
  contentHtml: string,
  lang: string,
  companyName?: string | null,
  logoUrl?: string | null,
): string {
  const colors = TEMPLATE_COLORS[templateIdentifier] || DEFAULT_COLOR;
  const isRtl = lang === 'ar' || lang === 'he';
  const dir = isRtl ? 'rtl' : 'ltr';
  const align = isRtl ? 'right' : 'left';
  const year = new Date().getFullYear();
  const brandName = companyName || 'Al-Bayt Manager';

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${brandName}" style="max-height:40px;max-width:160px;display:block;margin:0 auto;" />`
    : `<span style="font-size:20px;font-weight:700;color:#ffffff;text-decoration:none;">${brandName}</span>`;

  return `<!DOCTYPE html>
<html dir="${dir}" lang="${lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;">
    <tr><td style="padding:24px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;">

        <!-- Header -->
        <tr><td style="background-color:${colors.accent};padding:20px 24px;border-radius:12px 12px 0 0;text-align:center;">
          ${logoHtml}
        </td></tr>

        <!-- Accent bar -->
        <tr><td style="height:4px;background:linear-gradient(90deg,${colors.accent},${colors.accentLight});font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- Body -->
        <tr><td style="background-color:#ffffff;padding:32px 28px;text-align:${align};font-size:15px;line-height:1.7;color:#1f2937;">
          ${contentHtml}
        </td></tr>

        <!-- Footer -->
        <tr><td style="background-color:#f9fafb;padding:20px 28px;border-radius:0 0 12px 12px;border-top:1px solid #e5e7eb;text-align:center;">
          <p style="margin:0;font-size:13px;color:#6b7280;">${brandName}</p>
          <p style="margin:4px 0 0;font-size:11px;color:#9ca3af;">&copy; ${year}</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Email sending ───

export async function sendEmail(data: {
  templateIdentifier: string;
  recipientEmail: string;
  userId?: string;
  preferredLanguage?: string;
  variables?: Record<string, string>;
}) {
  // Get settings for SMTP config
  const [config] = await db.select().from(settings).limit(1);
  if (!config?.smtpEnabled || !config?.resendApiKey) {
    await logEmailAttempt(data.templateIdentifier, data.recipientEmail, data.userId, 'skipped', 'SMTP not enabled', data.preferredLanguage);
    throw new AppError(400, 'Email sending is not configured');
  }

  // Find template
  const [template] = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.identifier, data.templateIdentifier))
    .limit(1);
  if (!template) throw new AppError(404, 'Template not found');

  // Find best translation
  const translations = await db
    .select()
    .from(emailTemplateTranslations)
    .where(eq(emailTemplateTranslations.templateId, template.id));

  const lang = data.preferredLanguage || 'ar';
  let translation = translations.find((t) => t.language === lang)
    || translations.find((t) => t.language === 'ar')
    || translations.find((t) => t.language === 'en')
    || translations.find((t) => t.language === 'he')
    || translations[0];

  if (!translation) {
    await logEmailAttempt(data.templateIdentifier, data.recipientEmail, data.userId, 'failed', 'No translation found', data.preferredLanguage);
    throw new AppError(400, 'No translation found for template');
  }

  // Replace variables
  let subject = translation.subject;
  let body = translation.htmlBody;
  if (data.variables) {
    for (const [key, value] of Object.entries(data.variables)) {
      subject = subject.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      body = body.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
  }

  // Wrap body in branded layout
  const html = wrapEmailHtml(
    data.templateIdentifier,
    body,
    translation.language,
    config.companyName,
    config.logoUrl,
  );

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(config.resendApiKey);

    await resend.emails.send({
      from: `${config.smtpFromName || 'Al-Bayt Manager'} <${config.smtpFromEmail || 'noreply@example.com'}>`,
      to: [data.recipientEmail],
      subject,
      html,
    });

    await logEmailAttempt(data.templateIdentifier, data.recipientEmail, data.userId, 'sent', undefined, translation.language, subject);
    return { success: true };
  } catch (err: any) {
    await logEmailAttempt(data.templateIdentifier, data.recipientEmail, data.userId, 'failed', err.message, data.preferredLanguage);
    throw new AppError(500, 'Failed to send email');
  }
}

async function logEmailAttempt(
  templateIdentifier: string,
  recipientEmail: string,
  userId: string | undefined,
  status: string,
  failureReason?: string,
  languageUsed?: string,
  subjectSent?: string,
) {
  await db.insert(emailLogs).values({
    templateIdentifier,
    recipientEmail,
    userId,
    status,
    failureReason,
    languageUsed,
    subjectSent,
  }).catch((err) => logger.error(err, 'Email log error'));
}

export async function sendOtpEmail(recipientEmail: string, otp: string, language: string = 'ar') {
  return sendEmail({
    templateIdentifier: 'otp_email_change',
    recipientEmail,
    preferredLanguage: language,
    variables: { otp },
  });
}

export async function listEmailLogs(filters?: {
  status?: string;
  templateIdentifier?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}) {
  const { limit = 100, offset = 0 } = filters || {};

  let query = db.select().from(emailLogs);

  const conditions: any[] = [];
  if (filters?.status) conditions.push(eq(emailLogs.status, filters.status));
  if (filters?.templateIdentifier) conditions.push(eq(emailLogs.templateIdentifier, filters.templateIdentifier));
  if (filters?.startDate) conditions.push(gte(emailLogs.createdAt, new Date(filters.startDate)));
  if (filters?.endDate) conditions.push(lte(emailLogs.createdAt, new Date(filters.endDate)));

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  return query.orderBy(desc(emailLogs.createdAt)).limit(limit).offset(offset);
}
