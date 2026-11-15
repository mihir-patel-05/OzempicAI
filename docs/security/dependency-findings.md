# Dependency advisory inventory

Recorded 2026-11-15. This is registry advisory evidence, not proof that every advisory is exploitable in this app. See SEC-14 in the main report. The server audit returned zero known advisories.

Root audit: 20 affected dependency entries (7 high, 9 moderate, 4 low), including transitive effects. Counts are package entries, not independent exploitable bugs.

## @babel/core

- Locked versions: 7.29.0; registry severity: **low**.
- Location: `node_modules/@babel/core`.
- Context: Development/build dependency path; not a Node service in the Caddy production image. Exploitation depends on developer-server exposure or malicious build inputs.
- Fix: update the affected dependency chain to a non-vulnerable supported version, regenerate the lockfile and run build/tests; do not apply major audit fixes blindly.
- [@babel/core: Arbitrary File Read via sourceMappingURL Comment](https://github.com/advisories/GHSA-4x5r-pxfx-6jf8) — low; affected range `<=7.29.0`.

## @remix-run/router

- Locked versions: 1.23.2; registry severity: **moderate**.
- Location: `node_modules/@remix-run/router`.
- Context: Browser runtime dependency; exact advisory preconditions still need a matching application path. Current app uses BrowserRouter, not server rendering/data-router actions.
- Fix: update the affected dependency chain to a non-vulnerable supported version, regenerate the lockfile and run build/tests; do not apply major audit fixes blindly.
- [React Router's same-origin redirect with path starting // causes open redirect via protocol-relative URL reinterpretation](https://github.com/advisories/GHSA-2j2x-hqr9-3h42) — moderate; affected range `>=1.3.0 <1.23.3`.

## @rollup/plugin-node-resolve

- Locked versions: 16.0.3; registry severity: **low**.
- Location: `node_modules/@rollup/plugin-node-resolve`.
- Context: Development/build dependency path; not a Node service in the Caddy production image. Exploitation depends on developer-server exposure or malicious build inputs.
- Fix: update the affected dependency chain to a non-vulnerable supported version, regenerate the lockfile and run build/tests; do not apply major audit fixes blindly.
- Transitive exposure through `deepmerge` (see its entry).

## baseline-browser-mapping

- Locked versions: 2.10.29; registry severity: **moderate**.
- Location: `node_modules/baseline-browser-mapping`.
- Context: Development/build dependency path; not a Node service in the Caddy production image. Exploitation depends on developer-server exposure or malicious build inputs.
- Fix: update the affected dependency chain to a non-vulnerable supported version, regenerate the lockfile and run build/tests; do not apply major audit fixes blindly.
- [baseline-browser-mapping process termination on invalid input causes denial of service](https://github.com/advisories/GHSA-w5vr-8v7q-w6rv) — moderate; affected range `>=2.0.0 <2.11.0`.

## brace-expansion

- Locked versions: 2.1.0, 5.0.6; registry severity: **high**.
- Location: `node_modules/brace-expansion`, `node_modules/filelist/node_modules/brace-expansion`.
- Context: Development/build dependency path; not a Node service in the Caddy production image. Exploitation depends on developer-server exposure or malicious build inputs.
- Fix: update the affected dependency chain to a non-vulnerable supported version, regenerate the lockfile and run build/tests; do not apply major audit fixes blindly.
- [brace-expansion: DoS via exponential-time expansion of consecutive non-expanding {} groups](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp) — high; affected range `>=2.0.0 <2.1.2`.
- [brace-expansion: DoS via exponential-time expansion of consecutive non-expanding {} groups](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp) — high; affected range `>=3.0.0 <5.0.7`.
- [brace-expansion: DoS via unbounded expansion length causing an out-of-memory process crash](https://github.com/advisories/GHSA-mh99-v99m-4gvg) — high; affected range `>=2.0.0 <2.1.3`.
- [brace-expansion: DoS via unbounded expansion length causing an out-of-memory process crash](https://github.com/advisories/GHSA-mh99-v99m-4gvg) — high; affected range `>=4.0.0 <5.0.8`.
- [brace-expansion: DoS via unbounded intermediate arrays, bypassing the CVE-2026-14257 mitigation](https://github.com/advisories/GHSA-rgw5-rvv9-x895) — high; affected range `>=4.0.0 <5.0.9`.
- [brace-expansion: DoS via unbounded intermediate arrays, bypassing the CVE-2026-14257 mitigation](https://github.com/advisories/GHSA-rgw5-rvv9-x895) — high; affected range `>=2.0.0 <2.1.4`.
- [brace-expansion: Quadratic-time expansion of the `{a},b}` rewrite causes CPU denial of service](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) — moderate; affected range `>=2.0.0 <2.1.7`.
- [brace-expansion: Quadratic-time expansion of the `{a},b}` rewrite causes CPU denial of service](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) — moderate; affected range `>=4.0.0 <5.0.12`.
- [brace-expansion: DoS via uncontrolled recursion on nested brace groups causing stack exhaustion](https://github.com/advisories/GHSA-qhr7-859c-m2p7) — high; affected range `>=2.0.0 <2.1.6`.
- [brace-expansion: DoS via uncontrolled recursion on nested brace groups causing stack exhaustion](https://github.com/advisories/GHSA-qhr7-859c-m2p7) — high; affected range `>=4.0.0 <5.0.11`.
- [brace-expansion: DoS via uncontrolled recursion in parseCommaParts causing stack exhaustion](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) — high; affected range `>=2.0.0 <2.1.5`.
- [brace-expansion: DoS via uncontrolled recursion in parseCommaParts causing stack exhaustion](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) — high; affected range `>=4.0.0 <5.0.10`.

## browserslist

- Locked versions: 4.28.2; registry severity: **high**.
- Location: `node_modules/browserslist`.
- Context: Development/build dependency path; not a Node service in the Caddy production image. Exploitation depends on developer-server exposure or malicious build inputs.
- Fix: update the affected dependency chain to a non-vulnerable supported version, regenerate the lockfile and run build/tests; do not apply major audit fixes blindly.
- [Browserslist: Unbounded memory growth (no cache eviction) via distinct query results, leading to eventual OOM](https://github.com/advisories/GHSA-c83g-rgw3-j3cx) — high; affected range `<=4.28.6`.
- [Browserslist: Uncaught crash / prototype write via untrusted browserslist-stats.json custom stats (normalizeStats)](https://github.com/advisories/GHSA-73wf-gq98-2v4g) — high; affected range `<=4.28.6`.

## deepmerge

- Locked versions: 4.3.1; registry severity: **low**.
- Location: `node_modules/deepmerge`.
- Context: Development/build dependency path; not a Node service in the Caddy production image. Exploitation depends on developer-server exposure or malicious build inputs.
- Fix: update the affected dependency chain to a non-vulnerable supported version, regenerate the lockfile and run build/tests; do not apply major audit fixes blindly.
- [deepmerge mergeObject() allows prototype poisoning of returned objects](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) — low; affected range `>=4.2.0 <=4.3.1`.

## esbuild

- Locked versions: 0.21.5; registry severity: **moderate**.
- Location: `node_modules/esbuild`.
- Context: Development/build dependency path; not a Node service in the Caddy production image. Exploitation depends on developer-server exposure or malicious build inputs.
- Fix: update the affected dependency chain to a non-vulnerable supported version, regenerate the lockfile and run build/tests; do not apply major audit fixes blindly.
- [esbuild enables any website to send any requests to the development server and read the response](https://github.com/advisories/GHSA-67mh-4wv8-2f99) — moderate; affected range `<=0.24.2`.

## fast-uri

- Locked versions: 3.1.2; registry severity: **high**.
- Location: `node_modules/fast-uri`.
- Context: Development/build dependency path; not a Node service in the Caddy production image. Exploitation depends on developer-server exposure or malicious build inputs.
- Fix: update the affected dependency chain to a non-vulnerable supported version, regenerate the lockfile and run build/tests; do not apply major audit fixes blindly.
- [fast-uri vulnerable to host confusion via literal backslash authority delimiter](https://github.com/advisories/GHSA-v2hh-gcrm-f6hx) — high; affected range `>=3.0.0 <=3.1.3`.
- [fast-uri vulnerable to host confusion via backslash authority introducer](https://github.com/advisories/GHSA-7p8r-x3mc-p8w7) — high; affected range `>=3.0.0 <3.1.5`.
- [fast-uri vulnerable to server-side request forgery via malformed IPv6 normalization](https://github.com/advisories/GHSA-f65p-4m7j-42xc) — high; affected range `>=3.0.0 <3.1.6`.
- [fast-uri vulnerable to server-side request forgery via repeated hostname percent-decoding](https://github.com/advisories/GHSA-fph4-wmhf-6fwf) — high; affected range `>=3.1.2 <3.1.6`.
- [fast-uri vulnerable to host confusion via percent-encoded scheme normalization](https://github.com/advisories/GHSA-jqff-g426-hqxp) — high; affected range `>=3.0.0 <3.1.6`.
- [fast-uri vulnerable to host confusion via failed IDN canonicalization](https://github.com/advisories/GHSA-4c8g-83qw-93j6) — high; affected range `>=3.0.0 <3.1.3`.
- [fast-uri vulnerable to authority injection via an unvalidated port in serialize](https://github.com/advisories/GHSA-qw65-cvwx-89v3) — high; affected range `>=3.0.0 <3.1.7`.
- [fast-uri vulnerable to inconsistent host case normalization via percent-encoded octets](https://github.com/advisories/GHSA-hrr3-gc8f-f4qj) — moderate; affected range `>=3.0.0 <3.1.8`.
- [fast-uri vulnerable to URI scheme spoofing via percent-encoded scheme decoding](https://github.com/advisories/GHSA-w74x-v6f9-j3xg) — moderate; affected range `>=3.0.0 <3.1.9`.
- [fast-uri vulnerable to improper path equivalence in relative reference normalization](https://github.com/advisories/GHSA-xhq7-xmqj-769h) — low; affected range `>=3.0.0 <3.1.9`.
- [fast-uri vulnerable to scheme injection via an unescaped first-segment colon in suffix references](https://github.com/advisories/GHSA-333x-w4r6-6crp) — low; affected range `>=3.0.0 <3.1.9`.

## glob

- Locked versions: 11.1.0; registry severity: **moderate**.
- Location: `node_modules/glob`.
- Context: Development/build dependency path; not a Node service in the Caddy production image. Exploitation depends on developer-server exposure or malicious build inputs.
- Fix: update the affected dependency chain to a non-vulnerable supported version, regenerate the lockfile and run build/tests; do not apply major audit fixes blindly.
- [Glob: AbortSignal cancellation bypass allows post-timeout filesystem traversal](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) — moderate; affected range `>=9.0.0 <=14.0.1`.
- Transitive exposure through `minimatch` (see its entry).

## minimatch

- Locked versions: 10.2.5; registry severity: **moderate**.
- Location: `node_modules/minimatch`.
- Context: Development/build dependency path; not a Node service in the Caddy production image. Exploitation depends on developer-server exposure or malicious build inputs.
- Fix: update the affected dependency chain to a non-vulnerable supported version, regenerate the lockfile and run build/tests; do not apply major audit fixes blindly.
- [minimatch has potential denial of service via globparts amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249) — moderate; affected range `>=7.0.0 <11.0.1`.

## nanoid

- Locked versions: 3.3.12; registry severity: **high**.
- Location: `node_modules/nanoid`.
- Context: Development/build dependency path; not a Node service in the Caddy production image. Exploitation depends on developer-server exposure or malicious build inputs.
- Fix: update the affected dependency chain to a non-vulnerable supported version, regenerate the lockfile and run build/tests; do not apply major audit fixes blindly.
- [nanoid: non-secure generators can loop indefinitely with negative size](https://github.com/advisories/GHSA-28wg-ghj8-5hjv) — high; affected range `<3.3.16`.
- [nanoid: custom generators can loop indefinitely when size is zero](https://github.com/advisories/GHSA-2v37-7h3g-55p8) — high; affected range `<3.3.18`.

## postcss

- Locked versions: 8.5.14; registry severity: **high**.
- Location: `node_modules/postcss`.
- Context: Development/build dependency path; not a Node service in the Caddy production image. Exploitation depends on developer-server exposure or malicious build inputs.
- Fix: update the affected dependency chain to a non-vulnerable supported version, regenerate the lockfile and run build/tests; do not apply major audit fixes blindly.
- [PostCSS: incomplete fix of GHSA-6g55-p6wh-862q — attacker-controlled sourceMappingURL reads arbitrary .map files when `from` is unset](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp) — moderate; affected range `<=8.5.22`.
- [PostCSS: Path Traversal in Previous Source Map Auto-Loading (sourceMappingURL) leads to Arbitrary .map File Disclosure](https://github.com/advisories/GHSA-r28c-9q8g-f849) — high; affected range `<=8.5.17`.

## react-router

- Locked versions: 6.30.3; registry severity: **moderate**.
- Location: `node_modules/react-router`.
- Context: Browser runtime dependency; exact advisory preconditions still need a matching application path. Current app uses BrowserRouter, not server rendering/data-router actions.
- Fix: update the affected dependency chain to a non-vulnerable supported version, regenerate the lockfile and run build/tests; do not apply major audit fixes blindly.
- Transitive exposure through `@remix-run/router` (see its entry).
- [React Router: Open redirect via backslash in <Link> and useNavigate (CVE-2025-68470 bypass)](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6) — moderate; affected range `>=6.0.0 <7.18.0`.
- [React Router: Arbitrary Constructor Injection via deserializeErrors() in React Router SSR Hydration](https://github.com/advisories/GHSA-337j-9hxr-rhxg) — moderate; affected range `>=6.4.0 <7.18.0`.
- [React Router's same-origin redirect with path starting // causes open redirect via protocol-relative URL reinterpretation](https://github.com/advisories/GHSA-2j2x-hqr9-3h42) — moderate; affected range `>=6.7.0 <6.30.4`.

## react-router-dom

- Locked versions: 6.30.3; registry severity: **moderate**.
- Location: `node_modules/react-router-dom`.
- Context: Browser runtime dependency; exact advisory preconditions still need a matching application path. Current app uses BrowserRouter, not server rendering/data-router actions.
- Fix: update the affected dependency chain to a non-vulnerable supported version, regenerate the lockfile and run build/tests; do not apply major audit fixes blindly.
- Transitive exposure through `@remix-run/router` (see its entry).
- [React Router: Open redirect leading to XSS](https://github.com/advisories/GHSA-jjmj-jmhj-qwj2) — moderate; affected range `>=6.30.2 <=6.30.5`.
- Transitive exposure through `react-router` (see its entry).

## serialize-javascript

- Locked versions: 7.0.5; registry severity: **low**.
- Location: `node_modules/serialize-javascript`.
- Context: Development/build dependency path; not a Node service in the Caddy production image. Exploitation depends on developer-server exposure or malicious build inputs.
- Fix: update the affected dependency chain to a non-vulnerable supported version, regenerate the lockfile and run build/tests; do not apply major audit fixes blindly.
- [Serialize JavaScript: Cross-site scripting (XSS) via unescaped </script at the end of a serialized function body](https://github.com/advisories/GHSA-m5mm-p8h7-m29v) — low; affected range `<7.1.3`.

## source-map-js

- Locked versions: 1.2.1; registry severity: **high**.
- Location: `node_modules/source-map-js`.
- Context: Development/build dependency path; not a Node service in the Caddy production image. Exploitation depends on developer-server exposure or malicious build inputs.
- Fix: update the affected dependency chain to a non-vulnerable supported version, regenerate the lockfile and run build/tests; do not apply major audit fixes blindly.
- [source-map-js allows event-loop denial of service through indexed source-map section offsets](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) — high; affected range `>=1.0.0 <1.2.2`.

## vite

- Locked versions: 5.4.21; registry severity: **high**.
- Location: `node_modules/vite`.
- Context: Development/build dependency path; not a Node service in the Caddy production image. Exploitation depends on developer-server exposure or malicious build inputs.
- Fix: update the affected dependency chain to a non-vulnerable supported version, regenerate the lockfile and run build/tests; do not apply major audit fixes blindly.
- [Vite Vulnerable to Path Traversal in Optimized Deps `.map` Handling](https://github.com/advisories/GHSA-4w7w-66w2-5vf9) — moderate; affected range `<=6.4.1`.
- [launch-editor: NTLMv2 hash disclosure via UNC path handling on Windows](https://github.com/advisories/GHSA-v6wh-96g9-6wx3) — moderate; affected range `<=6.4.2`.
- [launch-editor: escapeCmdArgs() omits % escaping on Windows](https://github.com/advisories/GHSA-698v-4r3x-3vcv) — moderate; affected range `<=6.4.3`.
- [launch-editor: Editor CLI flag misinterpretation causing arbitrary command execution for some editors](https://github.com/advisories/GHSA-r825-w8mm-5pxw) — moderate; affected range `<=6.4.3`.
- [launch-editor: `fs.existsSync()` existence check can be bypassed on Windows](https://github.com/advisories/GHSA-587h-7wmj-h5pm) — high; affected range `<=6.4.3`.
- [Vite: Cross origin script execution through Vite custom middleware](https://github.com/advisories/GHSA-9jrq-w75r-8gcw) — low; affected range `<=6.4.3`.
- [Vite: Files outside `server.fs.allow` could be served when project paths match system paths on non-Windows machine](https://github.com/advisories/GHSA-rq7h-c2jc-7f22) — moderate; affected range `<=6.4.3`.
- [vite: `server.fs.deny` bypass on Windows alternate paths](https://github.com/advisories/GHSA-fx2h-pf6j-xcff) — moderate; affected range `<=6.4.2`.
- Transitive exposure through `esbuild` (see its entry).

## vite-plugin-pwa

- Locked versions: 0.20.5; registry severity: **moderate**.
- Location: `node_modules/vite-plugin-pwa`.
- Context: Development/build dependency path; not a Node service in the Caddy production image. Exploitation depends on developer-server exposure or malicious build inputs.
- Fix: update the affected dependency chain to a non-vulnerable supported version, regenerate the lockfile and run build/tests; do not apply major audit fixes blindly.
- Transitive exposure through `vite` (see its entry).

## workbox-build

- Locked versions: 7.4.1; registry severity: **moderate**.
- Location: `node_modules/workbox-build`.
- Context: Development/build dependency path; not a Node service in the Caddy production image. Exploitation depends on developer-server exposure or malicious build inputs.
- Fix: update the affected dependency chain to a non-vulnerable supported version, regenerate the lockfile and run build/tests; do not apply major audit fixes blindly.
- Transitive exposure through `@rollup/plugin-node-resolve` (see its entry).
- Transitive exposure through `glob` (see its entry).
