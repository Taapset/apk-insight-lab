# APK Analyzer - Backend Integration Guide

This document provides detailed instructions for integrating external security analysis services with the APK Analyzer platform.

## Architecture Overview

The analysis pipeline is orchestrated by the `process-apk` edge function, which:
1. Downloads the uploaded APK from storage
2. Computes file hashes (MD5, SHA256)
3. Calls MobSF API for static analysis
4. Calls VirusTotal API for threat intelligence
5. Optionally calls Cuckoo Sandbox for dynamic analysis
6. Generates AI-powered reports using Lovable AI
7. Stores normalized results in the database

## Required Secrets

The following secrets are configured in Lovable Cloud:

- `MOBSF_API_KEY` - API key for MobSF instance
- `MOBSF_API_URL` - Base URL of your MobSF deployment (e.g., `https://mobsf.example.com`)
- `VIRUSTOTAL_API_KEY` - VirusTotal API key
- `LOVABLE_API_KEY` - Auto-provisioned for AI report generation

## Integration Details

### 1. MobSF Integration

**API Documentation**: https://mobsf.github.io/docs/#/api

**Implementation Location**: `supabase/functions/process-apk/index.ts` (Line ~95)

**Integration Steps**:

```typescript
// 1. Upload APK to MobSF
const formData = new FormData();
formData.append('file', fileData, job.filename);

const uploadResponse = await fetch(`${mobsfApiUrl}/api/v1/upload`, {
  method: 'POST',
  headers: {
    'Authorization': mobsfApiKey,
  },
  body: formData,
});

const uploadData = await uploadResponse.json();
const fileHash = uploadData.hash;

// 2. Start Scan
const scanResponse = await fetch(`${mobsfApiUrl}/api/v1/scan`, {
  method: 'POST',
  headers: {
    'Authorization': mobsfApiKey,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    hash: fileHash,
    scan_type: 'apk',
  }),
});

// 3. Get Results
const reportResponse = await fetch(
  `${mobsfApiUrl}/api/v1/report_json?hash=${fileHash}`,
  {
    headers: {
      'Authorization': mobsfApiKey,
    },
  }
);

const mobsfResults = await reportResponse.json();
```

**Key Data to Extract**:
- Permissions (`manifest.permissions`)
- Activities, Services, Receivers
- Exported components
- Strings and URLs
- Cryptographic usage
- Security issues and vulnerabilities

### 2. VirusTotal Integration

**API Documentation**: https://docs.virustotal.com/reference/overview

**Implementation Location**: `supabase/functions/process-apk/index.ts` (Line ~115)

**Current Implementation**: Basic hash lookup (already implemented)

**Enhancement - File Upload**:

```typescript
// If file not found in VT database, upload it
if (vtResponse.status === 404) {
  const formData = new FormData();
  formData.append('file', fileData, job.filename);

  const uploadResponse = await fetch(
    'https://www.virustotal.com/api/v3/files',
    {
      method: 'POST',
      headers: {
        'x-apikey': vtApiKey,
      },
      body: formData,
    }
  );

  const uploadData = await uploadResponse.json();
  const analysisId = uploadData.data.id;

  // Poll for analysis completion
  let analysisComplete = false;
  let attempts = 0;
  const maxAttempts = 10;

  while (!analysisComplete && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

    const analysisResponse = await fetch(
      `https://www.virustotal.com/api/v3/analyses/${analysisId}`,
      {
        headers: {
          'x-apikey': vtApiKey,
        },
      }
    );

    const analysisData = await analysisResponse.json();
    if (analysisData.data.attributes.status === 'completed') {
      analysisComplete = true;
      virusTotalResults = analysisData.data;
    }

    attempts++;
  }
}
```

**Key Data to Extract**:
- Detection ratio (`last_analysis_stats`)
- Engine-specific detections
- Reputation score
- Behavioral indicators
- Network communications

### 3. Cuckoo Sandbox Integration (Optional)

**API Documentation**: https://cuckoo.readthedocs.io/en/latest/usage/api/

**Implementation Location**: Add new section in `supabase/functions/process-apk/index.ts`

**Integration Steps**:

```typescript
// 1. Submit APK for Analysis
const formData = new FormData();
formData.append('file', fileData, job.filename);

const submitResponse = await fetch(`${cuckooUrl}/tasks/create/file`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${cuckooApiKey}`,
  },
  body: formData,
});

const taskData = await submitResponse.json();
const taskId = taskData.task_id;

// 2. Poll for Task Completion
let taskComplete = false;
let attempts = 0;
const maxAttempts = 30; // 5 minutes max

while (!taskComplete && attempts < maxAttempts) {
  await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds

  const statusResponse = await fetch(`${cuckooUrl}/tasks/view/${taskId}`, {
    headers: {
      'Authorization': `Bearer ${cuckooApiKey}`,
    },
  });

  const statusData = await statusResponse.json();
  if (statusData.task.status === 'reported') {
    taskComplete = true;
  }

  attempts++;
}

// 3. Get Analysis Report
const reportResponse = await fetch(`${cuckooUrl}/tasks/report/${taskId}`, {
  headers: {
    'Authorization': `Bearer ${cuckooApiKey}`,
  },
});

const sandboxResults = await reportResponse.json();
```

**Key Data to Extract**:
- Network traffic
- API calls
- File system operations
- Registry modifications
- Process behavior

### 4. AI Report Generation

**Current Implementation**: Using Lovable AI with Google Gemini 2.5 Flash

**Model**: `google/gemini-2.5-flash` (balanced performance and cost)

**Prompt Template** (Location: `supabase/functions/process-apk/index.ts`, Line ~170):

The prompt provides:
- File metadata (hashes, size)
- Extracted permissions
- Suspicious strings and URLs
- MobSF summary
- VirusTotal summary
- IOCs

**AI Output Structure**:
1. **Executive Summary**: 2-3 sentence overview for stakeholders
2. **Technical Findings**: Detailed security issues
3. **Triage Recommendations**: Prioritized action items

**Rate Limits**:
- 429 error: Too many requests, implement backoff
- 402 error: Credits exhausted, notify user

## Database Schema

### IOC Types

Store indicators of compromise in the `iocs` table:

```typescript
{
  job_id: string;
  ioc_type: 'domain' | 'url' | 'ip' | 'hash' | 'permission' | 'certificate' | 'string';
  value: string;
  description: string;
  severity: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  metadata: Record<string, any>; // Additional context
}
```

### Analysis Results

Store in `analysis_results` table:

```typescript
{
  job_id: string;
  executive_summary: string;
  technical_findings: Record<string, any>;
  triage_recommendations: string;
  markdown_report: string;
  permissions: Array<{name: string; description: string}>;
  strings: string[];
  urls: string[];
  network_activity: Record<string, any>;
  mobsf_results: Record<string, any>;
  virustotal_results: Record<string, any>;
  sandbox_results: Record<string, any>;
}
```

## Security Considerations

1. **File Storage**: APK files stored in private S3 bucket
2. **RLS Policies**: Users can only access their own analysis results
3. **Rate Limiting**: Implement rate limiting at edge function level
4. **API Key Security**: Store all API keys as encrypted secrets
5. **File Validation**: Validate APK file signatures before processing
6. **Sandbox Isolation**: Use containerized environments for analysis

## Testing

### Local Testing

```bash
# Deploy edge function
supabase functions deploy process-apk

# Test with curl
curl -X POST https://your-project.supabase.co/functions/v1/process-apk \
  -H "Content-Type: application/json" \
  -d '{"jobId": "your-job-id"}'
```

### Mock Data

The current implementation uses mock data for permissions, strings, and URLs. Replace these with actual MobSF results:

```typescript
// Replace mock data with MobSF results
const permissions = mobsfResults.manifest?.permissions || [];
const strings = mobsfResults.strings?.slice(0, 100) || [];
const urls = mobsfResults.urls?.slice(0, 50) || [];
```

## Performance Optimization

1. **Parallel API Calls**: Call MobSF and VirusTotal concurrently
2. **Caching**: Cache VirusTotal results for known hashes
3. **Queue System**: Use Redis + Bull for job queue (if scaling needed)
4. **Progress Updates**: Update job progress at each stage
5. **Error Handling**: Implement retry logic for transient failures

## Monitoring

Log key events for debugging:
- File hash computation
- API call start/completion
- Errors with full context
- Processing time for each stage

Add to audit logs:
- Analysis completion
- API failures
- User actions

## Next Steps

1. Set up MobSF instance (self-hosted or cloud)
2. Configure VirusTotal file upload
3. (Optional) Set up Cuckoo Sandbox
4. Replace mock data with actual API results
5. Implement comprehensive error handling
6. Add retry logic and rate limiting
7. Set up monitoring and alerting

## Support

For integration issues:
- Check edge function logs in Lovable Cloud
- Review API documentation links above
- Test API endpoints with curl/Postman first
- Verify secrets are correctly configured
