-- ============================================================
-- SPARKTREE SAAS - AUDITORÍA (audit_logs)
-- Aplica en Supabase SQL Editor (o con psql en la base de datos)
-- ============================================================

-- 1. Tabla de auditoría general por organización
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  user_email text,
  action text NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'ASSIGN', 'UNASSIGN', 'TRANSFER', 'REACTIVATE_BOT', 'EXPORT', 'OTHER')),
  resource_type text,
  resource_id text,
  details text,
  ip text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON public.audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created ON public.audit_logs(organization_id, created_at DESC);

-- ============================================================
-- FIN DE MIGRACIÓN
-- ============================================================