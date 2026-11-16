# Build dependency remediation

Finding 06 upgrades Vite to 8.3.8, the React plugin to 5.2.0, the PWA plugin
to 2.0.0, and Workbox to 7.4.1. The package now requires Node >=22.12.0.
The existing Node 22 container build remains compatible.

Workbox still requests an affected glob range, so a tested override pins
glob 14.0.6, which resolves patched minimatch 11.0.8. The legacy filelist
consumer retains its compatible minimatch 5.x API.

There is no patched upstream release for deepmerge
[GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4).
Workbox's Rollup resolver still depends on it. The repository therefore pins
4.3.1 and applies a small, fail-closed patch through `postinstall` and
`prebuild` (also `predev` and `prepreview`): prototype-related keys are refused in both the target-copy and
source-copy loops. Both loops matter; checking source keys alone leaves the
target-copy vulnerability. The patch covers the package entry point and its
other distributed implementations. It refuses unexpected versions/layouts
so a future dependency change requires review.

The regression test runs against the installed dependency and tests malicious
target, source and nested keys, plus ordinary Rollup-style option merging.
A fresh `npm ci`, tests and the production PWA build passed with this patch.

The after-audit still lists **four low-severity package entries** tracing to
this single advisory because npm checks version metadata, not patched files.
There are **zero moderate, high or critical entries**. Do not treat the raw
audit exit code as evidence that the local patch was applied: run the
regression test and normal build. An installation using `--ignore-scripts`
will be patched by `npm run build`; invoking Vite directly in such an
installation requires `node scripts/patch-deepmerge.mjs` first. Normal
`npm ci` applies it automatically.

Remove the patch and version override once an upstream patched release is
available, then rerun the same tests and audit. The original and after-audit
JSON files remain in this review directory as evidence.
