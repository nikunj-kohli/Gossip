-- Create circuit breaker status table
CREATE TABLE IF NOT EXISTS circuit_breaker_status (
  id SERIAL PRIMARY KEY,
  service_name VARCHAR(100) NOT NULL,
  state VARCHAR(20) NOT NULL,
  successful_calls INTEGER NOT NULL DEFAULT 0,
  failed_calls INTEGER NOT NULL DEFAULT 0,
  rejected_calls INTEGER NOT NULL DEFAULT 0,
  timeout_calls INTEGER NOT NULL DEFAULT 0,
  last_failure_reason TEXT,
  last_state_change TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(service_name)
);

-- Create query performance logs table
CREATE TABLE IF NOT EXISTS query_performance_logs (
  id SERIAL PRIMARY KEY,
  query_name VARCHAR(100),
  query_text TEXT NOT NULL,
  parameters JSONB,
  duration_ms INTEGER NOT NULL,
  error_message TEXT,
  error_code VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create failed authentication attempts table
CREATE TABLE IF NOT EXISTS failed_auth_attempts (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255),
  email VARCHAR(255),
  ip_address INET NOT NULL,
  user_agent TEXT,
  attempt_type VARCHAR(50) NOT NULL, -- 'login', 'password_reset', etc.
  failure_reason VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create service health logs table
CREATE TABLE IF NOT EXISTS service_health_logs (
  id SERIAL PRIMARY KEY,
  service_name VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL, -- 'up', 'down', 'degraded', etc.
  response_time_ms INTEGER,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create batch processing logs table
CREATE TABLE IF NOT EXISTS batch_processing_logs (
  id SERIAL PRIMARY KEY,
  job_id VARCHAR(255) NOT NULL,
  job_type VARCHAR(100) NOT NULL,
  items_total INTEGER NOT NULL,
  items_processed INTEGER NOT NULL DEFAULT 0,
  items_failed INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL, -- 'pending', 'processing', 'completed', 'failed'
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_circuit_breaker_service_name ON circuit_breaker_status(service_name);
CREATE INDEX IF NOT EXISTS idx_circuit_breaker_state ON circuit_breaker_status(state);

CREATE INDEX IF NOT EXISTS idx_query_perf_query_name ON query_performance_logs(query_name);
CREATE INDEX IF NOT EXISTS idx_query_perf_duration ON query_performance_logs(duration_ms);
CREATE INDEX IF NOT EXISTS idx_query_perf_created_at ON query_performance_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_failed_auth_ip_address ON failed_auth_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_failed_auth_email ON failed_auth_attempts(email);
CREATE INDEX IF NOT EXISTS idx_failed_auth_created_at ON failed_auth_attempts(created_at);
CREATE INDEX IF NOT EXISTS idx_failed_auth_attempt_type ON failed_auth_attempts(attempt_type);

CREATE INDEX IF NOT EXISTS idx_service_health_service_name ON service_health_logs(service_name);
CREATE INDEX IF NOT EXISTS idx_service_health_status ON service_health_logs(status);
CREATE INDEX IF NOT EXISTS idx_service_health_created_at ON service_health_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_batch_processing_job_id ON batch_processing_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_batch_processing_job_type ON batch_processing_logs(job_type);
CREATE INDEX IF NOT EXISTS idx_batch_processing_status ON batch_processing_logs(status);
CREATE INDEX IF NOT EXISTS idx_batch_processing_created_at ON batch_processing_logs(created_at);