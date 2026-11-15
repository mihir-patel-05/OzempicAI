-- Scopes of one access token, when they are narrower than its connection's
-- (a refresh may ask for less: scope=read on a read+write connection).
-- Null means "the connection's scopes", which is what every existing token has.
alter table auth.oauth_tokens add column if not exists scopes text[];
