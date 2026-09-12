# Tests and honest evidence

`npm test` exercises domain, session and archive logic. Storage tests explicitly use MemoryRepository.

`python tools/ui_test.py` executes the real UI in an offline Chromium DOM, with named storage, hash, network and download fixtures. This is not evidence of native browser storage or network operation. Install Python Playwright, Pillow and CairoSVG for this path. It never changes browser policies.

`python tools/ui_test.py --native` requires a running `npm start`. It navigates normally, reads actual IndexedDB, reloads, downloads a complete adventure, and imports that file through the UI into a second independent browser context. It uses only synthetic launch data. Live AI, folder permissions, physical devices, real voice playback, and WebRTC between physical devices are separate acceptance gates.

The repository's qualification workflow runs the native path on an authorized standard GitHub-hosted runner with Node 22.16.0 and Playwright 1.57.0. It preserves the exact commit, native screenshots, test output and a source checkpoint ZIP. No credentials or production player data are used. Failed results are retained rather than relabeled passing.


## Expanded launch and package gates

`python tools/launch_ui_test.py --native` plays all twenty ending routes through real controls, checks their actual stored saves and reloads the latest completion. Five viewport sizes cover the library and two opening scenes. The same script without `--native` uses the explicitly labeled offline repository; it does not qualify native storage.

`npm run test:release` builds twice, checks manifest equality and every included file hash, serves the built static files and verifies private-path denial. It also starts the actual built Node entry point in an isolated directory, reads an anonymous session, verifies that generation is unconfigured and checks that an unauthenticated administrative request is denied. This does not claim Windows or public-deployment acceptance.

CI checks out complete repository history and preserves a verified Git bundle alongside the exact source ZIP and reports. The bundle is real GitHub history, not the synthetic local mirror used when the container cannot reach Git over the network. It contains repository objects, not credentials from checkout configuration.
