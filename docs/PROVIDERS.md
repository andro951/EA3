# Text, images, and replaceable providers

The local story demo is authored/scripted, not an AI. Unavailable providers produce an error rather than silently falling back to fake responses.

## Server adapter
Copy `.env.example` to `.env` and configure a full TEXT_ENDPOINT and model. The `chat` format speaks compatible chat-completions JSON/SSE; `ea3` sends `{request,promptVersion}` and receives `{text,memories?,model?}` or normalized chunk/result SSE. Images are selected independently. The `images` format requires `data[0].b64_json`; `ea3` requires owned PNG/JPEG/WebP data in a `data` field. Remote image URLs are never fetched automatically. Keys stay server-side. No paid service or account is created.

Choose the adapter in Settings. Configured does not mean live-tested. Inspect a non-explicit text response and a clothed portrait before relying on a provider. Generation is local-only by default. Never expose an unauthenticated paid proxy; PUBLIC_MODE disables the local authorization shortcut.

Requests have stable IDs, separate bounded text/image lanes, atomic private job receipts, cancellation and explicit unknown-result errors. Completed results can be reconciled without another generation. Unknown jobs need deliberate resolution, not automatic retry. Context budgets disclose omitted earlier turns and never truncate authored definitions or saves.

## Perchance host
Official references checked: https://perchance.org/ai-text-plugin and https://perchance.org/text-to-image-plugin . Generated documentation and live provider acceptance remain separate. Host equipment adapts EA2's tested MessageChannel contract.

Host EA3 on HTTPS. In your owned Perchance generator import its official plugins as `aiTextPlugin = {import:ai-text-plugin}` and `textToImagePlugin = {import:text-to-image-plugin}`. Use your actual plugin function names. Example HTML:

```html
<script src="https://YOUR-EA3-HOST/integrations/perchance-host.js"></script>
<iframe id="ea3-game" title="EmberAdventures 3" style="width:100%;height:100vh;border:0"></iframe>
<script>
const gameOrigin = 'https://YOUR-EA3-HOST';
const frame = document.getElementById('ea3-game');
const host = EA3Host.installHost({gameOrigin, sourceWindow:()=>frame.contentWindow,
  providers:EA3Host.perchancePlugins({text:aiTextPlugin,image:textToImagePlugin})});
frame.src = gameOrigin + '/?hostOrigin=' + encodeURIComponent(location.origin);
</script>
```

The exact origin/source window is checked before transferring a MessageChannel; no wildcard target origin is used. Host jobs are journaled in separate IndexedDB storage. The image callback must supply owned raster data or a canvas. An inaccessible URL is not silently proxied. Choose the bridge in game Settings. Standalone play never assumes a parent plugin exists.

## Evidence
The provider tests cover split UTF-8/SSE frames, early disconnects, terminal events, idempotent replay, unknown jobs, credential isolation and URL refusal using synthetic fixtures. Live Perchance, actual API credentials, image consistency and host-specific embedding remain separate acceptance gates.
