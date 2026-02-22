# Supabase: Create weight_logs Table

Run the following SQL in the **Supabase SQL Editor** (Dashboard → SQL Editor → New query):

```sql
CREATE TABLE weight_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    weight_kg   FLOAT8 NOT NULL CHECK (weight_kg > 0),
    logged_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast per-user queries ordered by date
CREATE INDEX idx_weight_logs_user_date ON weight_logs (user_id, logged_at ASC);

-- Enable Row Level Security
ALTER TABLE weight_logs ENABLE ROW LEVEL SECURITY;

-- Policy: users can only read their own logs
CREATE POLICY "Users can read own weight logs"
    ON weight_logs FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: users can insert their own logs
CREATE POLICY "Users can insert own weight logs"
    ON weight_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: users can delete their own logs
CREATE POLICY "Users can delete own weight logs"
    ON weight_logs FOR DELETE
    USING (auth.uid() = user_id);
```
