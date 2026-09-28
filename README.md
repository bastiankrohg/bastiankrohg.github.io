# bastiankrohg.com

Personal site of Bastian Krohg, PhD candidate in applied robotics at the University of Oslo
working on robotics for humanitarian mine action. Plain static HTML/CSS/JS, served by GitHub Pages.

## Structure

```
index.html                     Home: research, field video, background, earlier work, contact
projects/                      Earlier work, grouped by where it was done
  insa-toulouse/
  innovation-norway/
  independent/
404.html                       Not-found page; also forwards /uxo/<project> (see below)
uxo/index.html                 Forwards /uxo/ to https://uxo.bastiankrohg.com/
assets/css/site.css            All styles (light + dark theme tokens at the top)
assets/js/site.js              Hero survey animation + footer year
assets/images/web/             Optimised WebP photos used by the new pages
project-pages/                 Old URLs (redirect stubs) + standalone pages (pastis, tracker, beau, metamanager)
css/, js/                      Legacy styles still used by pastis.html and tracker.html
```

Preview locally with `python3 -m http.server` from the repo root (paths are root-absolute, so
opening the files directly with `file://` won't load styles).

## Adding the field video

In `index.html`, find the `fieldcam` figure. Uncomment either the `<video>` (self-hosted, keep it
compressed and well under GitHub's 100 MB file limit) or the `<iframe>` (Vimeo/YouTube), and delete the
`fieldcam__placeholder` block.

Before publishing footage from hazardous areas, strip GPS/telemetry/location overlays and get clearance
from the operator and, where relevant, the national mine action authority.

## Research workspace (uxo.bastiankrohg.com)

The restricted research pages live on a separate host at `uxo.bastiankrohg.com/<project>`.

- **The subdomain itself is DNS, not this repo.** Add a `CNAME` record for `uxo` pointing at whichever
  host serves the workspace (e.g. Cloudflare Pages + Cloudflare Access, Vercel with password protection,
  or Netlify). The auth wall is configured on that host.
- **From this site:** `bastiankrohg.com/uxo/` and `bastiankrohg.com/uxo/<project>` already forward to
  `https://uxo.bastiankrohg.com/<project>` (query string and hash preserved).
- When the workspace is live, un-hide the "Collaborators: research workspace" note in the research
  section of `index.html`.
