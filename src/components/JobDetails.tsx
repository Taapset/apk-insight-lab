import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Download, Shield, AlertTriangle, FileText, Network, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import IOCPanel from '@/components/IOCPanel';
import TimelineVisualization from '@/components/TimelineVisualization';
import NetworkGraph from '@/components/NetworkGraph';
import ReactMarkdown from 'react-markdown';

interface JobDetailsProps {
  jobId: string;
  onBack: () => void;
}

const JobDetails = ({ jobId, onBack }: JobDetailsProps) => {
  const [job, setJob] = useState<any>(null);
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJobDetails();
  }, [jobId]);

  const fetchJobDetails = async () => {
    try {
      const { data: jobData, error: jobError } = await supabase
        .from('analysis_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (jobError) throw jobError;
      setJob(jobData);

      const { data: resultsData, error: resultsError } = await supabase
        .from('analysis_results')
        .select('*')
        .eq('job_id', jobId)
        .single();

      if (resultsError && resultsError.code !== 'PGRST116') {
        throw resultsError;
      }

      setResults(resultsData);
    } catch (error) {
      console.error('Error fetching job details:', error);
      toast.error('Failed to load job details');
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    // TODO: Implement PDF export using a library like jsPDF or html2pdf
    toast.info('PDF export feature coming soon');
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p>Loading job details...</p>
        </CardContent>
      </Card>
    );
  }

  if (!job) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p>Job not found</p>
          <Button onClick={onBack} className="mt-4">Back to Jobs</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h2 className="text-2xl font-bold">{job.filename}</h2>
            <p className="text-sm text-muted-foreground">
              Job ID: {job.id.substring(0, 8)}...
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
          {job.threat_level && (
            <Badge 
              className={`
                capitalize text-sm px-3 py-1
                ${job.threat_level === 'critical' ? 'bg-destructive/20 text-destructive' : ''}
                ${job.threat_level === 'high' ? 'bg-danger/20 text-danger' : ''}
                ${job.threat_level === 'medium' ? 'bg-warning/20 text-warning' : ''}
                ${job.threat_level === 'low' ? 'bg-info/20 text-info' : ''}
                ${job.threat_level === 'safe' ? 'bg-success/20 text-success' : ''}
              `}
            >
              {job.threat_level} Risk
            </Badge>
          )}
        </div>
      </div>

      {/* Risk Meter */}
      {job.threat_level && (
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              {job.threat_level === 'safe' || job.threat_level === 'low' ? (
                <CheckCircle className="w-6 h-6 text-success" />
              ) : job.threat_level === 'medium' ? (
                <AlertCircle className="w-6 h-6 text-warning" />
              ) : (
                <XCircle className="w-6 h-6 text-destructive" />
              )}
              <span>Security Assessment</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold">Threat Level:</span>
                <Badge 
                  className={`
                    capitalize text-lg px-4 py-2
                    ${job.threat_level === 'critical' ? 'bg-destructive text-destructive-foreground' : ''}
                    ${job.threat_level === 'high' ? 'bg-danger text-danger-foreground' : ''}
                    ${job.threat_level === 'medium' ? 'bg-warning text-warning-foreground' : ''}
                    ${job.threat_level === 'low' ? 'bg-info text-info-foreground' : ''}
                    ${job.threat_level === 'safe' ? 'bg-success text-success-foreground' : ''}
                  `}
                >
                  {job.threat_level}
                </Badge>
              </div>
              <div className="w-full bg-secondary rounded-full h-4">
                <div 
                  className={`h-4 rounded-full transition-all ${
                    job.threat_level === 'safe' ? 'w-[20%] bg-success' :
                    job.threat_level === 'low' ? 'w-[40%] bg-info' :
                    job.threat_level === 'medium' ? 'w-[60%] bg-warning' :
                    job.threat_level === 'high' ? 'w-[80%] bg-danger' :
                    'w-[100%] bg-destructive'
                  }`}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {job.threat_level === 'safe' || job.threat_level === 'low' 
                  ? '✅ This app appears to be safe to use'
                  : job.threat_level === 'medium'
                  ? '⚠️ This app has some concerning behaviors - review carefully'
                  : '🚨 This app has serious security concerns - use with extreme caution'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full Analysis Report with Markdown Rendering */}
      {results?.markdown_report && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="w-5 h-5" />
              <span>Complete Analysis Report</span>
            </CardTitle>
            <CardDescription>
              Comprehensive breakdown in simple, easy-to-understand language
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{results.markdown_report}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Executive Summary */}
      {results?.executive_summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="w-5 h-5" />
              <span>Quick Summary</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{results.executive_summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Triage Recommendations */}
      {results?.triage_recommendations && (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-warning">
              <AlertTriangle className="w-5 h-5" />
              <span>Triage Recommendations</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{results.triage_recommendations}</p>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="findings" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="findings">Findings</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="iocs">IOCs</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="network">Network</TabsTrigger>
        </TabsList>

        <TabsContent value="findings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Technical Findings</CardTitle>
            </CardHeader>
            <CardContent>
              {results?.technical_findings ? (
                <pre className="text-xs bg-secondary/50 p-4 rounded-lg overflow-auto">
                  {JSON.stringify(results.technical_findings, null, 2)}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground">No technical findings available</p>
              )}
            </CardContent>
          </Card>

          {/* Strings and URLs */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Extracted Strings</CardTitle>
              </CardHeader>
              <CardContent>
                {results?.strings && Array.isArray(results.strings) ? (
                  <div className="space-y-1 max-h-64 overflow-auto">
                    {results.strings.slice(0, 50).map((str: string, idx: number) => (
                      <div key={idx} className="text-xs font-mono bg-secondary/30 px-2 py-1 rounded">
                        {str}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No strings extracted</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">URLs Found</CardTitle>
              </CardHeader>
              <CardContent>
                {results?.urls && Array.isArray(results.urls) ? (
                  <div className="space-y-1 max-h-64 overflow-auto">
                    {results.urls.map((url: string, idx: number) => (
                      <div key={idx} className="text-xs font-mono bg-secondary/30 px-2 py-1 rounded truncate">
                        {url}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No URLs found</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="permissions">
          <Card>
            <CardHeader>
              <CardTitle>Android Permissions</CardTitle>
              <CardDescription>Permissions requested by the application</CardDescription>
            </CardHeader>
            <CardContent>
              {results?.permissions && Array.isArray(results.permissions) ? (
                <div className="grid md:grid-cols-2 gap-2">
                  {results.permissions.map((perm: any, idx: number) => (
                    <div key={idx} className="flex items-start space-x-2 p-2 rounded bg-secondary/30">
                      <Shield className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-mono truncate">{perm.name || perm}</p>
                        {perm.description && (
                          <p className="text-xs text-muted-foreground mt-1">{perm.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No permissions data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="iocs">
          <IOCPanel jobId={jobId} />
        </TabsContent>

        <TabsContent value="timeline">
          <TimelineVisualization jobId={jobId} />
        </TabsContent>

        <TabsContent value="network">
          <NetworkGraph jobId={jobId} networkData={results?.network_activity} />
        </TabsContent>
      </Tabs>

    </div>
  );
};

export default JobDetails;