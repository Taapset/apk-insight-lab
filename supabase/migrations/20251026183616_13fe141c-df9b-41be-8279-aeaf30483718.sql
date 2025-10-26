-- Create uploader tracking table
CREATE TABLE public.uploader_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.analysis_jobs(id) ON DELETE CASCADE,
  user_id UUID,
  ip_address INET,
  user_agent TEXT,
  device_info JSONB,
  geolocation JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create threat intelligence feeds table
CREATE TABLE public.threat_intel_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ioc_value TEXT NOT NULL,
  ioc_type TEXT NOT NULL,
  threat_actor TEXT,
  malware_family TEXT,
  first_seen TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT now(),
  severity threat_level DEFAULT 'medium',
  source TEXT,
  metadata JSONB,
  UNIQUE(ioc_value, ioc_type)
);

-- Create incidents table for real-time alerts
CREATE TABLE public.security_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.analysis_jobs(id) ON DELETE CASCADE,
  incident_type TEXT NOT NULL,
  severity threat_level NOT NULL,
  status TEXT DEFAULT 'open',
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID,
  resolved_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create threat actor profiles table
CREATE TABLE public.threat_actors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  aliases TEXT[],
  first_seen TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT now(),
  total_samples INTEGER DEFAULT 0,
  threat_level threat_level DEFAULT 'medium',
  description TEXT,
  ttps JSONB,
  indicators JSONB,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create correlation table linking jobs to threat actors
CREATE TABLE public.job_threat_actor_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.analysis_jobs(id) ON DELETE CASCADE,
  threat_actor_id UUID REFERENCES public.threat_actors(id) ON DELETE CASCADE,
  confidence_score DECIMAL(3,2),
  evidence JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(job_id, threat_actor_id)
);

-- Create network intelligence table
CREATE TABLE public.network_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT,
  ip_address INET,
  port INTEGER,
  protocol TEXT,
  is_malicious BOOLEAN DEFAULT false,
  threat_score INTEGER,
  associated_malware TEXT[],
  first_seen TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT now(),
  metadata JSONB,
  UNIQUE(domain, ip_address, port)
);

-- Enable RLS on all new tables
ALTER TABLE public.uploader_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.threat_intel_feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.threat_actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_threat_actor_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_intelligence ENABLE ROW LEVEL SECURITY;

-- RLS Policies for uploader_tracking
CREATE POLICY "Admins can view all uploader tracking"
  ON public.uploader_tracking FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert uploader tracking"
  ON public.uploader_tracking FOR INSERT
  WITH CHECK (true);

-- RLS Policies for threat_intel_feeds
CREATE POLICY "Admins can view threat intel"
  ON public.threat_intel_feeds FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage threat intel"
  ON public.threat_intel_feeds FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for security_incidents
CREATE POLICY "Admins can view all incidents"
  ON public.security_incidents FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Analysts can view incidents"
  ON public.security_incidents FOR SELECT
  USING (has_role(auth.uid(), 'analyst'));

CREATE POLICY "Admins can manage incidents"
  ON public.security_incidents FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for threat_actors
CREATE POLICY "Admins and analysts can view threat actors"
  ON public.threat_actors FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analyst'));

CREATE POLICY "Admins can manage threat actors"
  ON public.threat_actors FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for job_threat_actor_links
CREATE POLICY "Admins and analysts can view links"
  ON public.job_threat_actor_links FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analyst'));

CREATE POLICY "System can insert links"
  ON public.job_threat_actor_links FOR INSERT
  WITH CHECK (true);

-- RLS Policies for network_intelligence
CREATE POLICY "Admins and analysts can view network intel"
  ON public.network_intelligence FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analyst'));

CREATE POLICY "Admins can manage network intel"
  ON public.network_intelligence FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Create indexes for performance
CREATE INDEX idx_uploader_tracking_job_id ON public.uploader_tracking(job_id);
CREATE INDEX idx_uploader_tracking_ip ON public.uploader_tracking(ip_address);
CREATE INDEX idx_threat_intel_ioc_value ON public.threat_intel_feeds(ioc_value);
CREATE INDEX idx_threat_intel_type ON public.threat_intel_feeds(ioc_type);
CREATE INDEX idx_incidents_status ON public.security_incidents(status);
CREATE INDEX idx_incidents_severity ON public.security_incidents(severity);
CREATE INDEX idx_threat_actors_name ON public.threat_actors(name);
CREATE INDEX idx_network_intel_domain ON public.network_intelligence(domain);
CREATE INDEX idx_network_intel_ip ON public.network_intelligence(ip_address);

-- Create trigger for updating incident timestamps
CREATE TRIGGER update_incidents_updated_at
  BEFORE UPDATE ON public.security_incidents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for critical tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.security_incidents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.analysis_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.uploader_tracking;