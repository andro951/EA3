# Tests and honest evidence

`npm test` exercises domain, session and archive logic. Storage tests explicitly use MemoryRepository.

`python tools/ui_test.py` executes the real UI in an offline Chromium DOM, with named storage, hash, network and download fixtures. This is not evidence of native browser storage or network operation. Install Python Playwright, Pillow and CairoSVG for this path. It never changes browser policies.

`python tools/ui_test.py --native` requires a running `npm start`. It navigates normally, reads actual IndexedDB, reloads, downloads a complete adventure, and imports that file through the UI into a second independent browser context. It uses only synthetic launch data. Live AI, folder permissions, physical devices, real voice playback, and WebRTC between physical devices are separate acceptance gates.

The repository's qualification workflow runs the native path on an authorized standard GitHub-hosted runner with Node 22.16.0 and Playwright 1.57.0. It preserves the exact commit, native screenshots, test output and a source checkpoint ZIP. No credentials or production player data are used. Failed results are retained rather than relabeled passing.
