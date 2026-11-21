CREATE TABLE IF NOT EXISTS hologram_characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  mime text NOT NULL,
  file_path text NOT NULL DEFAULT '',
  mouth jsonb NOT NULL DEFAULT '{"x":50,"y":62,"w":18,"h":9}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
