import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Globe, Server, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

const NetworkIntelligence = () => {
  const [networkData, setNetworkData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNetworkIntelligence();
    subscribeToRealtime();
  }, []);

  const fetchNetworkIntelligence = async () => {
    try {
      const { data, error } = await supabase
        .from('network_intelligence')
        .select('*')
        .order('last_seen', { ascending: false })
        .limit(50);

      if (error) throw error;
      setNetworkData(data || []);
    } catch (error) {
      console.error('Error fetching network intelligence:', error);
      toast.error('Failed to load network intelligence');
    } finally {
      setLoading(false);
    }
  };

  const subscribeToRealtime = () => {
    const channel = supabase
      .channel('network-intel-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'network_intelligence',
        },
        (payload) => {
          console.log('Network intel update:', payload);
          if (payload.eventType === 'INSERT') {
            setNetworkData((prev) => [payload.new as any, ...prev]);
            if (payload.new.is_malicious) {
              toast.warning('🌐 New malicious network endpoint detected!');
            }
          } else if (payload.eventType === 'UPDATE') {
            setNetworkData((prev) =>
              prev.map((item) => (item.id === payload.new.id ? payload.new : item))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Loading network intelligence...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Globe className="w-5 h-5" />
          <span>Network Intelligence</span>
        </CardTitle>
        <CardDescription>
          Real-time tracking of C&C servers, malicious domains, and suspicious network activity
        </CardDescription>
      </CardHeader>
      <CardContent>
        {networkData.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Server className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No network intelligence data available</p>
          </div>
        ) : (
          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {networkData.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 border rounded-lg transition-colors ${
                    item.is_malicious
                      ? 'border-destructive/50 bg-destructive/5'
                      : 'bg-card hover:bg-accent/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1 min-w-0">
                      {item.is_malicious ? (
                        <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          {item.domain && (
                            <p className="font-mono text-sm font-semibold truncate">
                              {item.domain}
                            </p>
                          )}
                          {item.ip_address && (
                            <Badge variant="outline" className="text-xs font-mono">
                              {item.ip_address}
                            </Badge>
                          )}
                          {item.port && (
                            <Badge variant="outline" className="text-xs">
                              :{item.port}
                            </Badge>
                          )}
                        </div>
                        
                        {item.protocol && (
                          <p className="text-xs text-muted-foreground">
                            Protocol: <span className="font-semibold">{item.protocol}</span>
                          </p>
                        )}

                        {item.associated_malware && item.associated_malware.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {item.associated_malware.slice(0, 3).map((malware: string, idx: number) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {malware}
                              </Badge>
                            ))}
                            {item.associated_malware.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{item.associated_malware.length - 3} more
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end space-y-1 flex-shrink-0 ml-3">
                      {item.threat_score !== null && (
                        <Badge
                          className={`
                            ${item.threat_score > 70 ? 'bg-destructive/20 text-destructive' : ''}
                            ${item.threat_score > 40 && item.threat_score <= 70 ? 'bg-warning/20 text-warning' : ''}
                            ${item.threat_score <= 40 ? 'bg-success/20 text-success' : ''}
                          `}
                        >
                          {item.threat_score}/100
                        </Badge>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.last_seen).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default NetworkIntelligence;
