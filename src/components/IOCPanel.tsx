import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Search } from 'lucide-react';

interface IOC {
  id: string;
  ioc_type: string;
  value: string;
  description: string | null;
  severity: string;
  first_seen: string;
}

interface IOCPanelProps {
  jobId: string;
}

const IOCPanel = ({ jobId }: IOCPanelProps) => {
  const [iocs, setIocs] = useState<IOC[]>([]);
  const [filteredIocs, setFilteredIocs] = useState<IOC[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchIOCs();
  }, [jobId]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = iocs.filter(
        ioc => 
          ioc.value.toLowerCase().includes(searchTerm.toLowerCase()) ||
          ioc.ioc_type.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredIocs(filtered);
    } else {
      setFilteredIocs(iocs);
    }
  }, [searchTerm, iocs]);

  const fetchIOCs = async () => {
    try {
      const { data, error } = await supabase
        .from('iocs')
        .select('*')
        .eq('job_id', jobId)
        .order('severity', { ascending: false });

      if (error) throw error;
      setIocs(data || []);
      setFilteredIocs(data || []);
    } catch (error) {
      console.error('Error fetching IOCs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      safe: 'bg-success/20 text-success',
      low: 'bg-info/20 text-info',
      medium: 'bg-warning/20 text-warning',
      high: 'bg-danger/20 text-danger',
      critical: 'bg-destructive/20 text-destructive',
    };
    return colors[severity] || 'bg-secondary text-secondary-foreground';
  };

  const groupByType = (iocs: IOC[]) => {
    return iocs.reduce((acc, ioc) => {
      if (!acc[ioc.ioc_type]) {
        acc[ioc.ioc_type] = [];
      }
      acc[ioc.ioc_type].push(ioc);
      return acc;
    }, {} as Record<string, IOC[]>);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p>Loading IOCs...</p>
        </CardContent>
      </Card>
    );
  }

  const groupedIocs = groupByType(filteredIocs);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5" />
              <span>Indicators of Compromise (IOCs)</span>
            </CardTitle>
            <CardDescription>Security indicators found during analysis</CardDescription>
          </div>
          <Badge variant="secondary">{iocs.length} Total</Badge>
        </div>
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search IOCs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </CardHeader>
      <CardContent>
        {filteredIocs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm ? 'No IOCs match your search' : 'No IOCs detected'}
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedIocs).map(([type, typeIocs]) => (
              <div key={type}>
                <h3 className="text-sm font-semibold mb-3 text-primary capitalize">
                  {type.replace('_', ' ')} ({typeIocs.length})
                </h3>
                <div className="space-y-2">
                  {typeIocs.map((ioc) => (
                    <div
                      key={ioc.id}
                      className="p-3 rounded-lg border border-border bg-card/50 hover:bg-card transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-sm truncate">{ioc.value}</p>
                          {ioc.description && (
                            <p className="text-xs text-muted-foreground mt-1">{ioc.description}</p>
                          )}
                        </div>
                        <Badge className={`ml-2 ${getSeverityColor(ioc.severity)} capitalize`}>
                          {ioc.severity}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default IOCPanel;