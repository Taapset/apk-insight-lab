import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Shield, Lock, Zap, FileSearch } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card/50 to-background">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-block mb-6">
            <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
              <Shield className="w-12 h-12 text-primary" style={{ filter: 'drop-shadow(0 0 20px hsl(193 89% 55% / 0.5))' }} />
            </div>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary via-info to-primary bg-clip-text text-transparent">
            APK Analyzer
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
            Comprehensive Android security analysis platform powered by AI.
            Upload APK files for deep static and dynamic analysis with automated threat detection.
          </p>

          <div className="flex items-center justify-center space-x-4">
            <Button 
              size="lg" 
              onClick={() => navigate('/auth')}
              className="text-lg px-8"
            >
              <Lock className="w-5 h-5 mr-2" />
              Sign In
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => navigate('/auth')}
              className="text-lg px-8"
            >
              Get Started
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mt-20 max-w-5xl mx-auto">
          <div className="p-6 rounded-xl border border-border bg-card/50 backdrop-blur-sm">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <FileSearch className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Static Analysis</h3>
            <p className="text-sm text-muted-foreground">
              Deep code inspection with MobSF integration for permissions, strings, and vulnerability detection
            </p>
          </div>

          <div className="p-6 rounded-xl border border-border bg-card/50 backdrop-blur-sm">
            <div className="w-12 h-12 bg-info/10 rounded-lg flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-info" />
            </div>
            <h3 className="text-lg font-semibold mb-2">AI-Powered Reports</h3>
            <p className="text-sm text-muted-foreground">
              Automated executive summaries, technical findings, and triage recommendations using OpenAI
            </p>
          </div>

          <div className="p-6 rounded-xl border border-border bg-card/50 backdrop-blur-sm">
            <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-success" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Role-Based Access</h3>
            <p className="text-sm text-muted-foreground">
              Secure analyst and admin roles with comprehensive audit logging and rate limiting
            </p>
          </div>
        </div>

        {/* Tech Stack Info */}
        <div className="mt-20 p-8 rounded-xl border border-warning/20 bg-warning/5 max-w-3xl mx-auto">
          <h3 className="text-lg font-semibold mb-4 text-warning flex items-center">
            <Lock className="w-5 h-5 mr-2" />
            Enterprise Security Platform
          </h3>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>• MobSF integration for comprehensive static analysis</li>
            <li>• VirusTotal enrichment for threat intelligence</li>
            <li>• Optional Cuckoo Sandbox for dynamic analysis</li>
            <li>• PostgreSQL + Redis job queue architecture</li>
            <li>• S3-compatible storage for APK artifacts</li>
            <li>• Rate limiting and file size validation</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Index;
