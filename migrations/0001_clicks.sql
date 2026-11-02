-- One row per click on /go/<name>. Anonymous: no IP, user agent or cookies.
CREATE TABLE clicks (
  at TEXT NOT NULL,        -- UTC ISO time
  campaign TEXT NOT NULL,  -- the name as looked up (lowercased, no trailing slash)
  known INTEGER NOT NULL,  -- 1 if in src/campaigns.js, 0 for typos and unknown names
  country TEXT,            -- request.cf.country
  referrer TEXT,           -- referring site's host only
  device TEXT NOT NULL,    -- iphone, ipad, android, desktop or other
  bot INTEGER NOT NULL     -- 1 for link-preview fetchers and crawlers
);
