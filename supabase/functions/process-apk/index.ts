import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createHash } from 'https://deno.land/std@0.177.0/node/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessRequest {
  jobId: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jobId } = await req.json() as ProcessRequest;

    if (!jobId) {
      throw new Error('jobId is required');
    }

    console.log(`Starting APK analysis for job: ${jobId}`);

    // Initialize Supabase client with service role for admin access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('analysis_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      throw new Error('Job not found');
    }

    // Update job status to processing
    await supabase
      .from('analysis_jobs')
      .update({ status: 'processing', progress: 10 })
      .eq('id', jobId);

    console.log('Job status updated to processing');

    // Step 1: Download APK from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('apk-files')
      .download(job.storage_path);

    if (downloadError || !fileData) {
      throw new Error('Failed to download APK file');
    }

    console.log('APK file downloaded');

    // Step 2: Compute file hashes
    const fileBuffer = await fileData.arrayBuffer();
    
    const md5Hash = createHash('md5').update(fileBuffer).digest('hex');
    const sha256Hash = createHash('sha256').update(fileBuffer).digest('hex');

    await supabase
      .from('analysis_jobs')
      .update({ 
        file_hash_md5: md5Hash, 
        file_hash_sha256: sha256Hash,
        progress: 20 
      })
      .eq('id', jobId);

    console.log(`Hashes computed - MD5: ${md5Hash}, SHA256: ${sha256Hash}`);

    // Step 3: Call MobSF API for static analysis
    let mobsfResults = null;
    try {
      const mobsfApiKey = Deno.env.get('MOBSF_API_KEY');
      const mobsfApiUrl = Deno.env.get('MOBSF_API_URL');

      if (mobsfApiKey && mobsfApiUrl) {
        console.log('Calling MobSF API...');
        
        // TODO: Implement actual MobSF API integration
        // This requires uploading the APK to MobSF and polling for results
        // MobSF API docs: https://mobsf.github.io/docs/#/api
        
        // Placeholder for MobSF results
        mobsfResults = {
          status: 'TODO: Implement MobSF integration',
          note: 'MobSF requires: 1) Upload APK, 2) Scan, 3) Get results',
          api_endpoint: mobsfApiUrl,
        };

        await supabase
          .from('analysis_jobs')
          .update({ progress: 40 })
          .eq('id', jobId);
      } else {
        console.log('MobSF credentials not configured, skipping...');
      }
    } catch (error) {
      console.error('MobSF API error:', error);
      mobsfResults = { error: String(error) };
    }

    // Step 4: Call VirusTotal API
    let virusTotalResults = null;
    try {
      const vtApiKey = Deno.env.get('VIRUSTOTAL_API_KEY');

      if (vtApiKey) {
        console.log('Calling VirusTotal API...');

        // Submit file hash to VirusTotal
        const vtResponse = await fetch(
          `https://www.virustotal.com/api/v3/files/${sha256Hash}`,
          {
            headers: {
              'x-apikey': vtApiKey,
            },
          }
        );

        if (vtResponse.ok) {
          virusTotalResults = await vtResponse.json();
          console.log('VirusTotal results received');
        } else if (vtResponse.status === 404) {
          // File not in VT database, would need to upload it
          virusTotalResults = {
            status: 'not_found',
            note: 'File not in VirusTotal database. Implement file upload for new files.',
          };
        } else {
          throw new Error(`VirusTotal API error: ${vtResponse.status}`);
        }

        await supabase
          .from('analysis_jobs')
          .update({ progress: 60 })
          .eq('id', jobId);
      } else {
        console.log('VirusTotal API key not configured, skipping...');
      }
    } catch (error) {
      console.error('VirusTotal API error:', error);
      virusTotalResults = { error: String(error) };
    }

    // Step 5: Extract mock analysis data
    // In production, these would come from MobSF results
    const mockPermissions = [
      { name: 'android.permission.INTERNET', description: 'Full network access' },
      { name: 'android.permission.ACCESS_FINE_LOCATION', description: 'Access precise location' },
      { name: 'android.permission.CAMERA', description: 'Take pictures and videos' },
      { name: 'android.permission.READ_CONTACTS', description: 'Read your contacts' },
    ];

    const mockStrings = [
      'https://api.example.com/collect',
      'https://tracking.ads.com',
      'user_token',
      'device_id',
      'location_data',
    ];

    const mockUrls = [
      'https://api.example.com/collect',
      'https://tracking.ads.com/track',
      'http://malicious-domain.xyz',
    ];

    // Step 6: Generate IOCs
    const iocs = [
      {
        job_id: jobId,
        ioc_type: 'domain',
        value: 'malicious-domain.xyz',
        description: 'Suspicious domain detected in strings',
        severity: 'high',
      },
      {
        job_id: jobId,
        ioc_type: 'url',
        value: 'http://malicious-domain.xyz',
        description: 'Unencrypted HTTP connection to suspicious domain',
        severity: 'high',
      },
      {
        job_id: jobId,
        ioc_type: 'permission',
        value: 'android.permission.READ_CONTACTS',
        description: 'App requests access to contacts',
        severity: 'medium',
      },
    ];

    // Insert IOCs
    await supabase.from('iocs').insert(iocs);

    console.log('IOCs created');

    await supabase
      .from('analysis_jobs')
      .update({ progress: 70 })
      .eq('id', jobId);

    // Step 7: Call OpenAI for report generation (using user's API key)
    console.log('Generating AI report with OpenAI...');

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not found');
    }

    const analysisContext = {
      filename: job.filename,
      file_size: job.file_size,
      md5: md5Hash,
      sha256: sha256Hash,
      permissions: mockPermissions,
      strings: mockStrings,
      urls: mockUrls,
      mobsf_summary: mobsfResults,
      virustotal_summary: virusTotalResults,
      iocs: iocs,
    };

    const aiPrompt = `You are a senior security analyst. Analyze this Android APK and provide:

1. Executive Summary (2-3 sentences for non-technical stakeholders)
2. Technical Findings (detailed security issues found)
3. Triage Recommendations (prioritized action items)

APK Analysis Data:
${JSON.stringify(analysisContext, null, 2)}

Focus on:
- Privacy concerns (permissions, data collection)
- Security vulnerabilities
- Suspicious network activity
- Malicious indicators
- Risk assessment

Provide a comprehensive security assessment.`;

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Cheapest OpenAI model
        max_tokens: 1500,
        temperature: 0.7,
        messages: [
          {
            role: 'system',
            content: 'You are an expert Android security analyst specializing in malware detection and threat assessment.',
          },
          {
            role: 'user',
            content: aiPrompt,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('OpenAI API error:', aiResponse.status, errorText);
      if (aiResponse.status === 429) {
        throw new Error('OpenAI rate limit exceeded. Please try again later.');
      }
      throw new Error(`OpenAI API error: ${aiResponse.status} - ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const aiReport = aiData.choices?.[0]?.message?.content || 'Failed to generate report';

    console.log('AI report generated');

    // Parse AI report into sections
    const executiveSummary = aiReport.split('Technical Findings')[0]
      .replace('Executive Summary', '')
      .replace(/^\W+/, '')
      .trim();

    const technicalFindings = {
      raw_report: aiReport,
      threat_indicators: iocs.length,
      suspicious_permissions: mockPermissions.length,
    };

    const triageRecommendations = aiReport.includes('Triage Recommendations')
      ? aiReport.split('Triage Recommendations')[1].trim()
      : 'Review findings and assess risk level based on your organization\'s security policies.';

    // Determine threat level based on IOCs
    let threatLevel = 'low';
    const highSeverityIocs = iocs.filter(ioc => ioc.severity === 'high' || ioc.severity === 'critical');
    if (highSeverityIocs.length > 2) {
      threatLevel = 'high';
    } else if (highSeverityIocs.length > 0) {
      threatLevel = 'medium';
    }

    await supabase
      .from('analysis_jobs')
      .update({ progress: 90, threat_level: threatLevel })
      .eq('id', jobId);

    // Step 8: Store analysis results
    const { error: resultsError } = await supabase
      .from('analysis_results')
      .insert({
        job_id: jobId,
        executive_summary: executiveSummary,
        technical_findings: technicalFindings,
        triage_recommendations: triageRecommendations,
        markdown_report: aiReport,
        permissions: mockPermissions,
        strings: mockStrings,
        urls: mockUrls,
        mobsf_results: mobsfResults,
        virustotal_results: virusTotalResults,
        network_activity: {
          domains: mockUrls,
          suspicious_connections: iocs.filter(ioc => ioc.ioc_type === 'domain' || ioc.ioc_type === 'url'),
        },
      });

    if (resultsError) {
      throw resultsError;
    }

    console.log('Analysis results stored');

    // Step 9: Mark job as completed
    await supabase
      .from('analysis_jobs')
      .update({ 
        status: 'completed', 
        progress: 100,
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    console.log(`Analysis completed for job: ${jobId}`);

    // Create audit log
    await supabase.from('audit_logs').insert({
      user_id: job.user_id,
      action: 'apk_analysis_completed',
      resource_type: 'analysis_job',
      resource_id: jobId,
      details: {
        filename: job.filename,
        threat_level: threatLevel,
        iocs_found: iocs.length,
      },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        jobId, 
        threat_level: threatLevel,
        message: 'Analysis completed successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('APK processing error:', error);

    // Try to update job status to failed
    try {
      const { jobId } = await req.json() as ProcessRequest;
      if (jobId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        await supabase
          .from('analysis_jobs')
          .update({ 
            status: 'failed', 
            error_message: error.message || String(error),
          })
          .eq('id', jobId);
      }
    } catch (updateError) {
      console.error('Failed to update job status:', updateError);
    }

    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to process APK',
        details: String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});