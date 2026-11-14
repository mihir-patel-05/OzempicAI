-- Custom day labels (e.g. "Leg Day", "Cardio", "Active Recovery")
CREATE TABLE public.day_labels (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  label_date date NOT NULL,
  label      text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, label_date)
);

ALTER TABLE public.day_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own day labels"
  ON public.day_labels
  FOR ALL
  USING (auth.uid() = user_id);
