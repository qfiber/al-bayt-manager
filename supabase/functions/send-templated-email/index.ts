import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FALLBACK_ORDER = ['ar', 'en', 'he'];

interface SendEmailRequest {
  template_identifier: string;
  recipient_user_id?: string;
  recipient_email?: string;
  placeholders?: Record<string, string>;
  metadata?: Record<string, any>;
}

interface Translation {
  language: string;
  subject: string;
  html_body: string;
}

function selectTranslation(preferredLang: string | null, translations: Translation[]): { language: string; translation: Translation } | { status: 'skipped'; reason: string } {
  const available = translations.map(t => t.language);
  
  // If no translations exist, template is disabled
  if (available.length === 0) {
    return { status: 'skipped', reason: 'template_disabled' };
  }
  
  // Try preferred language first
  if (preferredLang && available.includes(preferredLang)) {
    const translation = translations.find(t => t.language === preferredLang);
    if (translation) {
      return { language: preferredLang, translation };
    }
  }
  
  // Fallback in order: ar → en → he
  for (const lang of FALLBACK_ORDER) {
    if (available.includes(lang)) {
      const translation = translations.find(t => t.language === lang);
      if (translation) {
        return { language: lang, translation };
      }
    }
  }
  
  return { status: 'skipped', reason: 'no_valid_translation' };
}

function replacePlaceholders(text: string, placeholders: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(placeholders)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');
  }
  return result;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: SendEmailRequest = await req.json();
    const { template_identifier, recipient_user_id, recipient_email, placeholders = {}, metadata = {} } = body;

    console.log(`Processing email for template: ${template_identifier}`);

    // Validate inputs
    if (!template_identifier) {
      throw new Error("template_identifier is required");
    }
    if (!recipient_user_id && !recipient_email) {
      throw new Error("Either recipient_user_id or recipient_email is required");
    }

    // Get user info if user_id provided
    let userEmail = recipient_email;
    let userPreferredLanguage: string | null = null;
    let userId: string | null = recipient_user_id || null;
    let userName: string | null = null;

    if (recipient_user_id) {
      // Get profile for preferred language and name
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, preferred_language')
        .eq('id', recipient_user_id)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
      }

      if (profile) {
        userPreferredLanguage = profile.preferred_language;
        userName = profile.name;
      }

      // Get email from auth.users via admin API
      const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(recipient_user_id);
      if (authError) {
        console.error('Error fetching auth user:', authError);
      }
      if (authUser?.user?.email) {
        userEmail = authUser.user.email;
      }
    }

    if (!userEmail) {
      // Log as skipped - no email available
      await supabase.from('email_logs').insert({
        user_id: userId,
        recipient_email: 'unknown',
        template_identifier,
        user_preferred_language: userPreferredLanguage,
        language_used: null,
        subject_sent: null,
        status: 'skipped',
        failure_reason: 'no_email_address',
        metadata,
      });

      return new Response(
        JSON.stringify({ success: false, status: 'skipped', reason: 'no_email_address' }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch template with translations
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select(`
        id,
        identifier,
        email_template_translations (
          language,
          subject,
          html_body
        )
      `)
      .eq('identifier', template_identifier)
      .maybeSingle();

    if (templateError) {
      throw new Error(`Failed to fetch template: ${templateError.message}`);
    }

    if (!template) {
      // Log as skipped - template not found
      await supabase.from('email_logs').insert({
        user_id: userId,
        recipient_email: userEmail,
        template_identifier,
        user_preferred_language: userPreferredLanguage,
        language_used: null,
        subject_sent: null,
        status: 'skipped',
        failure_reason: 'template_not_found',
        metadata,
      });

      return new Response(
        JSON.stringify({ success: false, status: 'skipped', reason: 'template_not_found' }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Select translation based on user preference and fallback
    const translations = template.email_template_translations || [];
    const selectionResult = selectTranslation(userPreferredLanguage, translations);

    if ('status' in selectionResult) {
      // Template is disabled or no valid translation
      await supabase.from('email_logs').insert({
        user_id: userId,
        recipient_email: userEmail,
        template_identifier,
        user_preferred_language: userPreferredLanguage,
        language_used: null,
        subject_sent: null,
        status: 'skipped',
        failure_reason: selectionResult.reason,
        metadata,
      });

      return new Response(
        JSON.stringify({ success: false, status: 'skipped', reason: selectionResult.reason }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { language: languageUsed, translation } = selectionResult;

    // Build placeholders with username fallback
    const finalPlaceholders = {
      username: userName || placeholders.username || userEmail.split('@')[0],
      ...placeholders,
    };

    // Replace placeholders in subject and body
    const finalSubject = replacePlaceholders(translation.subject, finalPlaceholders);
    const finalBody = replacePlaceholders(translation.html_body, finalPlaceholders);

    console.log(`Sending email to ${userEmail} using language ${languageUsed}`);
    console.log(`Subject: ${finalSubject}`);

    // TODO: Implement actual email sending here using SMTP/Google/Outlook
    // For now, we'll log as sent for testing purposes
    // In production, this would call the email provider API

    // Log as sent (in production, this would be after successful send)
    await supabase.from('email_logs').insert({
      user_id: userId,
      recipient_email: userEmail,
      template_identifier,
      user_preferred_language: userPreferredLanguage,
      language_used: languageUsed,
      subject_sent: finalSubject,
      status: 'sent',
      failure_reason: null,
      metadata,
    });

    return new Response(
      JSON.stringify({
        success: true,
        status: 'sent',
        language_used: languageUsed,
        recipient: userEmail,
        subject: finalSubject,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in send-templated-email:", error);
    
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
