import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, TrendingUp, AlertTriangle, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface ThreatActorProfileProps {
  jobId?: string;
}

const ThreatActorProfile = ({ jobId }: ThreatActorProfileProps) => {
  const [actors, setActors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchThreatActors();
  }, [jobId]);

  const fetchThreatActors = async () => {
    try {
      let query = supabase
        .from('threat_actors')
        .select('*')
        .order('last_seen', { ascending: false });

      if (jobId) {
        // If jobId provided, fetch actors linked to this job
        const { data: links } = await supabase
          .from('job_threat_actor_links')
          .select('threat_actor_id, confidence_score')
          .eq('job_id', jobId);

        if (links && links.length > 0) {
          const actorIds = links.map(l => l.threat_actor_id);
          query = query.in('id', actorIds);
        }
      }

      const { data, error } = await query.limit(10);

      if (error) throw error;
      setActors(data || []);
    } catch (error) {
      console.error('Error fetching threat actors:', error);
      toast.error('Failed to load threat actors');
    } finally {
      setLoading(false);
    }
  };

  const getThreatColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-destructive/20 text-destructive';
      case 'high': return 'bg-danger/20 text-danger';
      case 'medium': return 'bg-warning/20 text-warning';
      case 'low': return 'bg-info/20 text-info';
      default: return 'bg-success/20 text-success';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Loading threat actor profiles...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Users className="w-5 h-5" />
          <span>Threat Actor Profiles</span>
        </CardTitle>
        <CardDescription>
          Known threat actors and their associated malware campaigns
        </CardDescription>
      </CardHeader>
      <CardContent>
        {actors.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No threat actors identified yet</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              {actors.map((actor) => (
                <div
                  key={actor.id}
                  className="p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-lg">{actor.name}</h4>
                      {actor.aliases && actor.aliases.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          aka: {actor.aliases.join(', ')}
                        </p>
                      )}
                    </div>
                    <Badge className={`capitalize ${getThreatColor(actor.threat_level)}`}>
                      {actor.threat_level}
                    </Badge>
                  </div>

                  {actor.description && (
                    <p className="text-sm text-muted-foreground mb-3">
                      {actor.description}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      <span className="text-muted-foreground">Samples:</span>
                      <span className="font-semibold">{actor.total_samples}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-primary" />
                      <span className="text-muted-foreground">Last Seen:</span>
                      <span className="font-semibold">
                        {new Date(actor.last_seen).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {actor.ttps && Object.keys(actor.ttps).length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs font-semibold mb-2">Tactics & Techniques:</p>
                      <div className="flex flex-wrap gap-1">
                        {Object.keys(actor.ttps).slice(0, 5).map((ttp, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {ttp}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default ThreatActorProfile;
