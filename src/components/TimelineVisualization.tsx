import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock } from 'lucide-react';

interface TimelineVisualizationProps {
  jobId: string;
}

const TimelineVisualization = ({ jobId }: TimelineVisualizationProps) => {
  // TODO: Implement timeline visualization using a library like vis-timeline or react-chrono
  // This would show analysis events over time (file upload, static analysis start/end, 
  // dynamic analysis events, API calls to external services, etc.)

  const mockEvents = [
    { time: '00:00', event: 'APK uploaded', type: 'info' },
    { time: '00:01', event: 'File hash computed (MD5, SHA256)', type: 'success' },
    { time: '00:02', event: 'Static analysis started (MobSF)', type: 'info' },
    { time: '00:15', event: 'Static analysis completed', type: 'success' },
    { time: '00:16', event: 'VirusTotal API called', type: 'info' },
    { time: '00:20', event: 'VirusTotal results received', type: 'success' },
    { time: '00:21', event: 'AI report generation started', type: 'info' },
    { time: '00:35', event: 'Analysis complete', type: 'success' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Clock className="w-5 h-5" />
          <span>Analysis Timeline</span>
        </CardTitle>
        <CardDescription>Chronological view of analysis events</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-8 top-0 bottom-0 w-px bg-border" />
          
          <div className="space-y-6">
            {mockEvents.map((item, idx) => (
              <div key={idx} className="relative flex items-start space-x-4">
                {/* Timeline dot */}
                <div className="relative z-10">
                  <div className={`
                    w-4 h-4 rounded-full border-2 border-background
                    ${item.type === 'success' ? 'bg-success' : ''}
                    ${item.type === 'info' ? 'bg-info' : ''}
                    ${item.type === 'warning' ? 'bg-warning' : ''}
                  `} />
                </div>
                
                {/* Event content */}
                <div className="flex-1 pb-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{item.event}</p>
                    <span className="text-xs text-muted-foreground font-mono">{item.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 p-4 bg-info/10 border border-info/20 rounded-lg">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-info">TODO:</span> Integrate with actual analysis pipeline events.
            This timeline will show real-time updates as MobSF, VirusTotal, and sandbox analysis progress.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default TimelineVisualization;