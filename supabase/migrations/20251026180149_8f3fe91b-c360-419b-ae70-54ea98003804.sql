-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('analyst', 'admin');

-- Create enum for job status
CREATE TYPE public.job_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Create enum for threat level
CREATE TYPE public.threat_level AS ENUM ('safe', 'low', 'medium', 'high', 'critical');

-- User roles table (security definer pattern to avoid RLS recursion)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role app_role NOT NULL DEFAULT 'analyst',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Analysis jobs table
CREATE TABLE public.analysis_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    filename TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_hash_md5 TEXT,
    file_hash_sha256 TEXT,
    storage_path TEXT NOT NULL,
    status job_status DEFAULT 'pending',
    threat_level threat_level,
    progress INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.analysis_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own jobs"
  ON public.analysis_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all jobs"
  ON public.analysis_jobs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can create jobs"
  ON public.analysis_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own jobs"
  ON public.analysis_jobs FOR UPDATE
  USING (auth.uid() = user_id);

-- Analysis results table
CREATE TABLE public.analysis_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES public.analysis_jobs(id) ON DELETE CASCADE,
    executive_summary TEXT,
    technical_findings JSONB,
    triage_recommendations TEXT,
    markdown_report TEXT,
    permissions JSONB,
    strings JSONB,
    urls JSONB,
    network_activity JSONB,
    mobsf_results JSONB,
    virustotal_results JSONB,
    sandbox_results JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view results for their jobs"
  ON public.analysis_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.analysis_jobs
      WHERE analysis_jobs.id = analysis_results.job_id
      AND analysis_jobs.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all results"
  ON public.analysis_results FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert results"
  ON public.analysis_results FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.analysis_jobs
      WHERE analysis_jobs.id = analysis_results.job_id
      AND analysis_jobs.user_id = auth.uid()
    )
  );

-- IOCs (Indicators of Compromise) table
CREATE TABLE public.iocs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES public.analysis_jobs(id) ON DELETE CASCADE,
    ioc_type TEXT NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    severity threat_level DEFAULT 'low',
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT now(),
    metadata JSONB
);

ALTER TABLE public.iocs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view IOCs for their jobs"
  ON public.iocs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.analysis_jobs
      WHERE analysis_jobs.id = iocs.job_id
      AND analysis_jobs.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all IOCs"
  ON public.iocs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Audit log table
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    details JSONB,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Storage bucket for APK files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'apk-files',
  'apk-files',
  false,
  104857600, -- 100MB limit
  ARRAY['application/vnd.android.package-archive', 'application/zip', 'application/octet-stream']
);

-- Storage policies for APK files
CREATE POLICY "Authenticated users can upload APKs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'apk-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own APKs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'apk-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Admins can view all APKs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'apk-files' AND
    public.has_role(auth.uid(), 'admin')
  );

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for analysis_jobs updated_at
CREATE TRIGGER update_analysis_jobs_updated_at
    BEFORE UPDATE ON public.analysis_jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_analysis_jobs_user_id ON public.analysis_jobs(user_id);
CREATE INDEX idx_analysis_jobs_status ON public.analysis_jobs(status);
CREATE INDEX idx_analysis_results_job_id ON public.analysis_results(job_id);
CREATE INDEX idx_iocs_job_id ON public.iocs(job_id);
CREATE INDEX idx_iocs_type ON public.iocs(ioc_type);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);