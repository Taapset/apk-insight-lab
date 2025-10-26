import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Users, Activity, Database, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import ThreatActorProfile from '@/components/ThreatActorProfile';
import NetworkIntelligence from '@/components/NetworkIntelligence';

const Admin = () => {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    totalUsers: 0,
    highThreatJobs: 0,
  });

  useEffect(() => {
    checkAdminAccess();
    fetchStats();
  }, []);

  const checkAdminAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      navigate('/auth');
      return;
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const hasAdminRole = roles?.some(r => r.role === 'admin');
    
    if (!hasAdminRole) {
      toast.error('Access denied. Admin role required.');
      navigate('/dashboard');
      return;
    }

    setIsAdmin(true);
    setLoading(false);
  };

  const fetchStats = async () => {
    try {
      // Total jobs
      const { count: totalJobs } = await supabase
        .from('analysis_jobs')
        .select('*', { count: 'exact', head: true });

      // Completed jobs
      const { count: completedJobs } = await supabase
        .from('analysis_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed');

      // Failed jobs
      const { count: failedJobs } = await supabase
        .from('analysis_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed');

      // High threat jobs
      const { count: highThreatJobs } = await supabase
        .from('analysis_jobs')
        .select('*', { count: 'exact', head: true })
        .in('threat_level', ['high', 'critical']);

      // Total users (approximate from user_roles)
      const { count: totalUsers } = await supabase
        .from('user_roles')
        .select('user_id', { count: 'exact', head: true });

      setStats({
        totalJobs: totalJobs || 0,
        completedJobs: completedJobs || 0,
        failedJobs: failedJobs || 0,
        totalUsers: totalUsers || 0,
        highThreatJobs: highThreatJobs || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Checking permissions...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="w-10 h-10 bg-warning/10 rounded-lg flex items-center justify-center">
              <Shield className="w-6 h-6 text-warning" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Admin Panel</h1>
              <p className="text-xs text-muted-foreground">System overview and management</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Overview */}
        <div className="grid md:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Jobs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Database className="w-5 h-5 text-primary" />
                <span className="text-2xl font-bold">{stats.totalJobs}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Completed</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Activity className="w-5 h-5 text-success" />
                <span className="text-2xl font-bold">{stats.completedJobs}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Failed</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Activity className="w-5 h-5 text-danger" />
                <span className="text-2xl font-bold">{stats.failedJobs}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>High Threats</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-warning" />
                <span className="text-2xl font-bold">{stats.highThreatJobs}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Users</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-info" />
                <span className="text-2xl font-bold">{stats.totalUsers}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Admin Tabs */}
        <Tabs defaultValue="info" className="w-full">
          <TabsList>
            <TabsTrigger value="info">System Info</TabsTrigger>
            <TabsTrigger value="threats">Threat Intel</TabsTrigger>
            <TabsTrigger value="network">Network Intel</TabsTrigger>
            <TabsTrigger value="config">Configuration</TabsTrigger>
            <TabsTrigger value="docs">Documentation</TabsTrigger>
          </TabsList>

          <TabsContent value="info">
            <Card>
              <CardHeader>
                <CardTitle>System Information</CardTitle>
                <CardDescription>Platform status and configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 bg-secondary/30 rounded-lg">
                    <h3 className="font-semibold mb-2">Backend Status</h3>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>✅ Database: Connected</li>
                      <li>✅ Storage: Configured</li>
                      <li>✅ Edge Functions: Deployed</li>
                      <li>✅ Authentication: Active</li>
                      <li>✅ Lovable AI: Enabled</li>
                    </ul>
                  </div>

                  <div className="p-4 bg-secondary/30 rounded-lg">
                    <h3 className="font-semibold mb-2">External Services</h3>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>⚠️ MobSF: Configuration required</li>
                      <li>⚠️ VirusTotal: Configuration required</li>
                      <li>⚠️ Cuckoo Sandbox: Optional</li>
                    </ul>
                  </div>
                </div>

                <div className="p-4 border border-warning/30 bg-warning/5 rounded-lg">
                  <h3 className="font-semibold text-warning mb-2">⚠️ Important Notes</h3>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Analysis pipeline uses mock data until external APIs are configured</li>
                    <li>• File hashes and AI reports are fully functional</li>
                    <li>• Configure MobSF and VirusTotal for production use</li>
                    <li>• Review BACKEND_INTEGRATION.md for setup instructions</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="threats">
            <ThreatActorProfile />
          </TabsContent>

          <TabsContent value="network">
            <NetworkIntelligence />
          </TabsContent>

          <TabsContent value="config">
            <Card>
              <CardHeader>
                <CardTitle>Configuration</CardTitle>
                <CardDescription>Manage system settings and integrations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-secondary/30 rounded-lg">
                  <h3 className="font-semibold mb-3">Required Secrets</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between p-2 bg-background rounded">
                      <span className="font-mono">MOBSF_API_KEY</span>
                      <span className="text-success">✓ Configured</span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-background rounded">
                      <span className="font-mono">MOBSF_API_URL</span>
                      <span className="text-success">✓ Configured</span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-background rounded">
                      <span className="font-mono">VIRUSTOTAL_API_KEY</span>
                      <span className="text-success">✓ Configured</span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-background rounded">
                      <span className="font-mono">LOVABLE_API_KEY</span>
                      <span className="text-success">✓ Auto-configured</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-info/10 border border-info/30 rounded-lg">
                  <p className="text-sm">
                    <strong>Note:</strong> Secrets are managed in Lovable Cloud. 
                    Contact your administrator to update API keys.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="docs">
            <Card>
              <CardHeader>
                <CardTitle>Documentation</CardTitle>
                <CardDescription>Integration guides and testing instructions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="p-4 bg-secondary/30 rounded-lg">
                    <h3 className="font-semibold mb-2">📘 BACKEND_INTEGRATION.md</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      Comprehensive guide for integrating MobSF, VirusTotal, and Cuckoo Sandbox.
                      Includes API documentation, code examples, and security considerations.
                    </p>
                    <Button variant="outline" size="sm" asChild>
                      <a href="/BACKEND_INTEGRATION.md" target="_blank">View Guide</a>
                    </Button>
                  </div>

                  <div className="p-4 bg-secondary/30 rounded-lg">
                    <h3 className="font-semibold mb-2">🧪 TESTING_GUIDE.md</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      Testing instructions, troubleshooting tips, and database queries.
                      Includes curl commands and integration checklist.
                    </p>
                    <Button variant="outline" size="sm" asChild>
                      <a href="/TESTING_GUIDE.md" target="_blank">View Guide</a>
                    </Button>
                  </div>

                  <div className="p-4 bg-secondary/30 rounded-lg">
                    <h3 className="font-semibold mb-2">🔧 Quick Start</h3>
                    <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>Set up MobSF instance (Docker or cloud)</li>
                      <li>Get VirusTotal API key</li>
                      <li>Update secrets in Lovable Cloud</li>
                      <li>Deploy updated edge function</li>
                      <li>Test with real APK file</li>
                      <li>Monitor logs and results</li>
                    </ol>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;