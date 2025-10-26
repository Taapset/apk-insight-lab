import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AlertRequest {
  incidentId: string;
  alertType: 'email' | 'webhook' | 'both';
  recipients?: string[];
  webhookUrl?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { incidentId, alertType, recipients, webhookUrl } = await req.json() as AlertRequest;

    if (!incidentId) {
      throw new Error('incidentId is required');
    }

    console.log(`Processing alert for incident: ${incidentId}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch incident details
    const { data: incident, error: incidentError } = await supabase
      .from('security_incidents')
      .select(`
        *,
        analysis_jobs (
          filename,
          file_hash_sha256,
          threat_level,
          user_id
        )
      `)
      .eq('id', incidentId)
      .single();

    if (incidentError || !incident) {
      throw new Error('Incident not found');
    }

    // Fetch uploader tracking data
    const { data: uploaderData } = await supabase
      .from('uploader_tracking')
      .select('*')
      .eq('job_id', incident.job_id)
      .single();

    // Prepare alert message
    const alertMessage = {
      timestamp: new Date().toISOString(),
      severity: incident.severity,
      title: incident.title,
      description: incident.description,
      incident_id: incident.id,
      job_details: incident.analysis_jobs,
      uploader_info: uploaderData ? {
        ip_address: uploaderData.ip_address,
        user_agent: uploaderData.user_agent,
        location: uploaderData.geolocation,
      } : null,
      recommended_actions: [
        'Investigate uploader identity and previous submissions',
        'Review network connections and C&C communications',
        'Check for similar samples in threat intelligence feeds',
        'Consider blocking associated IOCs at network perimeter',
      ],
    };

    let emailSent = false;
    let webhookSent = false;

    // Send email alerts
    if (alertType === 'email' || alertType === 'both') {
      // TODO: Integrate with email service (SendGrid, AWS SES, etc.)
      // For now, just log
      console.log('Email alert would be sent to:', recipients);
      console.log('Alert content:', JSON.stringify(alertMessage, null, 2));
      emailSent = true;
    }

    // Send webhook alerts
    if (alertType === 'webhook' || alertType === 'both') {
      if (webhookUrl) {
        try {
          const webhookResponse = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'APK-Analyzer-Alert-System',
            },
            body: JSON.stringify(alertMessage),
          });

          if (webhookResponse.ok) {
            console.log('Webhook sent successfully');
            webhookSent = true;
          } else {
            console.error('Webhook failed:', await webhookResponse.text());
          }
        } catch (webhookError) {
          console.error('Webhook error:', webhookError);
        }
      }
    }

    // Log the alert in audit logs
    await supabase.from('audit_logs').insert({
      user_id: incident.analysis_jobs?.user_id,
      action: 'alert_sent',
      resource_type: 'security_incident',
      resource_id: incidentId,
      details: {
        alert_type: alertType,
        email_sent: emailSent,
        webhook_sent: webhookSent,
        severity: incident.severity,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        email_sent: emailSent,
        webhook_sent: webhookSent,
        alert_message: alertMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Alert error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to send alert',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
