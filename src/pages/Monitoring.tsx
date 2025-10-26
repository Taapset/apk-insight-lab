import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, AlertTriangle, Shield, TrendingUp, Clock, 
  Globe, Users, Database, ArrowLeft, Bell, CheckCircle, XCircle 
} from 'lucide-react';
import { toast } from 'sonner';

const Monitoring = () => {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalAnalyses: 0,
    activeThreats: 0,
    criticalIncidents: 0,
    uniqueUploaders: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMonitoringData();
    subscribeToRealtime();
  }, []);

  const fetchMonitoringData = async () => {
    try {
      // Fetch recent incidents
      const { data: incidentsData } = await supabase
        .from('security_incidents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      setIncidents(incidentsData || []);

      // Fetch recent jobs
      const { data: jobsData } = await supabase
        .from('analysis_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      setJobs(jobsData || []);

      // Calculate stats
      const { count: totalCount } = await supabase
        .from('analysis_jobs')
        .select('*', { count: 'exact', head: true });

      const { count: criticalCount } = await supabase
        .from('security_incidents')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open')
        .in('severity', ['critical', 'high']);

      const { count: activeCount } = await supabase
        .from('analysis_jobs')
        .select('*', { count: 'exact', head: true })
        .in('threat_level', ['high', 'critical']);

      const { count: uploaderCount } = await supabase
        .from('uploader_tracking')
        .select('user_id', { count: 'exact', head: true });

      setStats({
        totalAnalyses: totalCount || 0,
        activeThreats: activeCount || 0,
        criticalIncidents: criticalCount || 0,
        uniqueUploaders: uploaderCount || 0,
      });
    } catch (error) {
      console.error('Error fetching monitoring data:', error);
      toast.error('Failed to load monitoring data');
    } finally {
      setLoading(false);
    }
  };

  const subscribeToRealtime = () => {
    // Subscribe to incidents
    const incidentsChannel = supabase
      .channel('incidents-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'security_incidents',
        },
        (payload) => {
          console.log('New incident:', payload);
          setIncidents((prev) => [payload.new as any, ...prev]);
          toast.error(`🚨 New ${payload.new.severity} threat detected!`, {
            description: payload.new.title,
          });
        }
      )
      .subscribe();

    // Subscribe to jobs
    const jobsChannel = supabase
      .channel('jobs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'analysis_jobs',
        },
        (payload) => {
          console.log('Job update:', payload);
          if (payload.eventType === 'INSERT') {
            setJobs((prev) => [payload.new as any, ...prev]);
            toast.info('New APK submitted for analysis');
          } else if (payload.eventType === 'UPDATE') {
            setJobs((prev) =>
              prev.map((job) => (job.id === payload.new.id ? payload.new : job))
            );
            
            // Alert on completed high-threat analysis
            if (payload.new.status === 'completed' && 
                (payload.new.threat_level === 'high' || payload.new.threat_level === 'critical')) {
              toast.error(`⚠️ ${payload.new.threat_level} threat analysis completed!`);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(incidentsChannel);
      supabase.removeChannel(jobsChannel);
    };
  };

  const getThreatColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-destructive';
      case 'high': return 'text-danger';
      case 'medium': return 'text-warning';
      case 'low': return 'text-info';
      default: return 'text-success';
    }
  };

  const resolveIncident = async (incidentId: string) => {
    try {
      await supabase
        .from('security_incidents')
        .update({ 
          status: 'resolved',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', incidentId);
      
      toast.success('Incident resolved');
      fetchMonitoringData();
    } catch (error) {
      toast.error('Failed to resolve incident');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading monitoring dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Activity className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Real-Time Threat Monitoring</h1>
              <p className="text-xs text-muted-foreground">Cybercrime Detection Dashboard</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="animate-pulse">
              <div className="w-2 h-2 bg-success rounded-full mr-2" />
              Live
            </Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Analyses</p>
                  <p className="text-3xl font-bold">{stats.totalAnalyses}</p>
                </div>
                <Database className="w-8 h-8 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Threats</p>
                  <p className="text-3xl font-bold text-danger">{stats.activeThreats}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-danger opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Critical Incidents</p>
                  <p className="text-3xl font-bold text-destructive">{stats.criticalIncidents}</p>
                </div>
                <Bell className="w-8 h-8 text-destructive opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Unique Uploaders</p>
                  <p className="text-3xl font-bold">{stats.uniqueUploaders}</p>
                </div>
                <Users className="w-8 h-8 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="live-feed" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="live-feed">Live Feed</TabsTrigger>
            <TabsTrigger value="incidents">Incidents</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="live-feed" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5" />
                  <span>Real-Time Activity Stream</span>
                </CardTitle>
                <CardDescription>Live updates of all APK analysis activities</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {jobs.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No activity yet</p>
                  ) : (
                    jobs.map((job) => (
                      <div
                        key={job.id}
                        className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/dashboard`)}
                      >
                        <div className="flex items-center space-x-4">
                          <div className={`w-3 h-3 rounded-full ${
                            job.status === 'completed' ? 'bg-success' :
                            job.status === 'processing' ? 'bg-warning animate-pulse' :
                            job.status === 'failed' ? 'bg-destructive' :
                            'bg-info'
                          }`} />
                          <div>
                            <p className="font-medium">{job.filename}</p>
                            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span>{new Date(job.created_at).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Badge variant="outline" className="capitalize">
                            {job.status}
                          </Badge>
                          {job.threat_level && (
                            <Badge className={`capitalize ${getThreatColor(job.threat_level)}`}>
                              {job.threat_level}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="incidents" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Bell className="w-5 h-5" />
                  <span>Security Incidents</span>
                </CardTitle>
                <CardDescription>Active security incidents requiring attention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {incidents.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No incidents</p>
                  ) : (
                    incidents.map((incident) => (
                      <div
                        key={incident.id}
                        className="p-4 rounded-lg border bg-card space-y-2"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            {incident.status === 'resolved' ? (
                              <CheckCircle className="w-5 h-5 text-success mt-0.5" />
                            ) : (
                              <XCircle className="w-5 h-5 text-destructive mt-0.5" />
                            )}
                            <div>
                              <p className="font-semibold">{incident.title}</p>
                              <p className="text-sm text-muted-foreground">{incident.description}</p>
                              <div className="flex items-center space-x-2 mt-2 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                <span>{new Date(incident.created_at).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge className={`capitalize ${getThreatColor(incident.severity)}`}>
                              {incident.severity}
                            </Badge>
                            {incident.status === 'open' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => resolveIncident(incident.id)}
                              >
                                Resolve
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Globe className="w-5 h-5" />
                  <span>Threat Intelligence Analytics</span>
                </CardTitle>
                <CardDescription>Coming soon: Geographic heat maps, threat trends, and actor profiling</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="py-12 text-center text-muted-foreground">
                  <Shield className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Advanced analytics dashboard</p>
                  <p className="text-sm">Threat correlation, geographic tracking, and behavioral analysis</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Monitoring;
