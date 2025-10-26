import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, FileCode, AlertCircle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Job {
  id: string;
  filename: string;
  status: string;
  threat_level: string | null;
  created_at: string;
  progress: number;
}

interface JobsListProps {
  onJobSelect: (jobId: string) => void;
}

const JobsList = ({ onJobSelect }: JobsListProps) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJobs();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('analysis_jobs_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'analysis_jobs',
        },
        () => {
          fetchJobs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('analysis_jobs')
        .select('id, filename, status, threat_level, created_at, progress')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-danger" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-info animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      pending: 'secondary',
      processing: 'default',
      completed: 'default',
      failed: 'destructive',
    };

    return (
      <Badge variant={variants[status] as any} className="capitalize">
        {status}
      </Badge>
    );
  };

  const getThreatBadge = (level: string | null) => {
    if (!level) return null;

    const colors: Record<string, string> = {
      safe: 'bg-success/20 text-success',
      low: 'bg-info/20 text-info',
      medium: 'bg-warning/20 text-warning',
      high: 'bg-danger/20 text-danger',
      critical: 'bg-destructive/20 text-destructive',
    };

    return (
      <Badge className={`capitalize ${colors[level]}`}>
        {level}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
          <p className="mt-2 text-sm text-muted-foreground">Loading analysis jobs...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Analysis Jobs</CardTitle>
        <CardDescription>Recent APK security analysis results</CardDescription>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <div className="text-center py-12">
            <FileCode className="w-12 h-12 mx-auto text-muted-foreground/50" />
            <p className="mt-4 text-sm text-muted-foreground">
              No analysis jobs yet. Upload an APK to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <div
                key={job.id}
                onClick={() => job.status === 'completed' && onJobSelect(job.id)}
                className={`
                  p-4 rounded-lg border border-border bg-card/50
                  transition-all duration-200
                  ${job.status === 'completed' 
                    ? 'hover:border-primary/50 hover:bg-card cursor-pointer' 
                    : 'opacity-75'
                  }
                `}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1 min-w-0">
                    <div className="mt-1">{getStatusIcon(job.status)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{job.filename}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                      </p>
                      {job.status === 'processing' && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-medium">{job.progress}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary transition-all duration-300"
                              style={{ width: `${job.progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    {job.threat_level && getThreatBadge(job.threat_level)}
                    {getStatusBadge(job.status)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default JobsList;