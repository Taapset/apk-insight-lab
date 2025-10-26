# APK Analyzer - Testing Guide

## Quick Start Testing

### 1. Create Test Account

1. Navigate to `/auth`
2. Click "Sign Up" tab
3. Create account with email/password
4. You'll be automatically assigned the "analyst" role

### 2. Upload Test APK

For testing without real APK files:

**Option A: Use Sample APK**
- Download a sample APK from: https://github.com/OWASP/MASTG-Hacks
- Or use any legitimate APK from APKMirror

**Option B: Create Test File**
```bash
# Create a dummy APK (won't work for real analysis but tests upload)
echo "PK" > test.apk
# Note: This will fail validation - use real APK for full testing
```

### 3. Upload and Monitor

1. Go to dashboard
2. Drag & drop APK file
3. Watch job progress in real-time
4. Click on completed job to view results

## Testing the Analysis Pipeline

### Test Edge Function Directly

```bash
# Get your project details
SUPABASE_URL="https://omtfesefipenrtvtynrl.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"

# First, upload an APK and get the job ID from the database
# Then test the edge function:

curl -X POST \
  "${SUPABASE_URL}/functions/v1/process-apk" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"jobId": "your-job-id-here"}'
```

### Check Edge Function Logs

1. Open Lovable Cloud backend
2. Navigate to Edge Functions → process-apk
3. View logs for debugging

## Expected Behavior

### Successful Analysis Flow

1. **Upload (10 seconds)**
   - File uploads to storage
   - Job created with status "pending"
   - Edge function triggered

2. **Processing (30-120 seconds)**
   - Job status changes to "processing"
   - Progress updates: 10% → 20% → 40% → 60% → 70% → 90%
   - Hashes computed
   - Mock data generated (or real API calls if configured)

3. **Completion**
   - Job status changes to "completed"
   - Results stored in database
   - IOCs created
   - Threat level assigned
   - AI report generated

### Current Limitations (Mock Data)

Without external API configuration, the pipeline will:
- ✅ Compute real file hashes (MD5, SHA256)
- ✅ Upload file to storage
- ✅ Generate AI-powered security report
- ✅ Create mock IOCs
- ⚠️ Use placeholder data for MobSF results
- ⚠️ Skip VirusTotal if hash not found in database
- ⚠️ Skip Cuckoo Sandbox (optional feature)

## Testing with Real APIs

### 1. Configure MobSF

```bash
# Set up MobSF (Docker)
docker run -it --rm -p 8000:8000 opensecurity/mobile-security-framework-mobsf:latest

# Update secrets in Lovable Cloud:
# MOBSF_API_URL=http://your-ip:8000
# MOBSF_API_KEY=your-api-key
```

### 2. Configure VirusTotal

1. Get API key from https://www.virustotal.com/gui/my-apikey
2. Update `VIRUSTOTAL_API_KEY` in Lovable Cloud
3. Note: Free tier has rate limits (4 requests/min)

### 3. Test Full Pipeline

Upload a real APK and verify:
- ✅ File hash matches VirusTotal lookup
- ✅ Permissions extracted from MobSF
- ✅ Suspicious strings detected
- ✅ IOCs generated based on findings
- ✅ AI report includes actual security issues

## Admin Role Testing

### Grant Admin Role

```sql
-- Connect to your database and run:
INSERT INTO user_roles (user_id, role)
VALUES ('your-user-id', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
```

### Admin Features

Once granted admin role:
- ✅ View all users' analysis jobs
- ✅ Access audit logs
- ✅ View all IOCs across all jobs
- ✅ "ADMIN" badge displayed in header

## Performance Testing

### Load Testing

```bash
# Test concurrent uploads (requires test APKs)
for i in {1..5}; do
  curl -X POST "https://your-project.supabase.co/functions/v1/process-apk" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"jobId\": \"job-${i}\"}" &
done
wait
```

### Expected Response Times

- Upload: 5-10 seconds (100MB file)
- Hash computation: 1-2 seconds
- MobSF scan: 30-60 seconds
- VirusTotal lookup: 2-5 seconds
- AI report generation: 5-10 seconds
- **Total: 45-90 seconds per APK**

## Troubleshooting

### Job Stuck in "Processing"

1. Check edge function logs
2. Look for API errors or timeouts
3. Verify secrets are configured
4. Check job error_message field:
   ```sql
   SELECT error_message FROM analysis_jobs WHERE id = 'job-id';
   ```

### Upload Fails

1. Verify file size < 100MB
2. Check file extension is .apk
3. Verify user has storage permissions
4. Check storage bucket RLS policies

### No Results Displayed

1. Check RLS policies allow user to view results
2. Verify job completed successfully
3. Check browser console for errors
4. Verify user is authenticated

### AI Rate Limits

If you see:
- `429 error`: Too many AI requests, wait 1 minute
- `402 error`: AI credits exhausted, add credits in Settings → Workspace → Usage

## Database Testing

### Query Job Status

```sql
-- Check all jobs
SELECT id, filename, status, progress, threat_level, created_at
FROM analysis_jobs
ORDER BY created_at DESC
LIMIT 10;

-- Check job results
SELECT 
  j.filename,
  j.status,
  r.executive_summary,
  r.triage_recommendations
FROM analysis_jobs j
LEFT JOIN analysis_results r ON j.id = r.job_id
WHERE j.status = 'completed'
ORDER BY j.completed_at DESC;

-- Check IOCs
SELECT 
  j.filename,
  i.ioc_type,
  i.value,
  i.severity
FROM iocs i
JOIN analysis_jobs j ON i.job_id = j.id
WHERE i.severity IN ('high', 'critical')
ORDER BY i.first_seen DESC;
```

### Audit Log Queries

```sql
-- View recent activity
SELECT 
  action,
  resource_type,
  details,
  created_at
FROM audit_logs
ORDER BY created_at DESC
LIMIT 20;
```

## Integration Testing Checklist

- [ ] User can sign up and sign in
- [ ] User can upload APK file
- [ ] Job appears in jobs list
- [ ] Job status updates in real-time
- [ ] Completed job shows results
- [ ] IOCs are displayed correctly
- [ ] Executive summary is generated
- [ ] Technical findings are detailed
- [ ] Permissions are listed
- [ ] Strings and URLs are extracted
- [ ] Network graph placeholder displays
- [ ] Timeline shows events
- [ ] Export PDF button present (placeholder)
- [ ] User can sign out
- [ ] Admin can view all jobs
- [ ] Audit logs are created

## Next Steps After Testing

1. Configure real MobSF instance
2. Set up VirusTotal API
3. (Optional) Configure Cuckoo Sandbox
4. Implement PDF export functionality
5. Add network graph visualization
6. Enhance timeline with real events
7. Add email notifications for completed analyses
8. Implement rate limiting at application level
9. Add user management for admins
10. Deploy to production

## Getting Help

- Check `BACKEND_INTEGRATION.md` for API integration details
- Review edge function logs for errors
- Test APIs with curl before integration
- Join Lovable Discord for community support
