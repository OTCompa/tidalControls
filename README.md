# TidalControls
A Vencord plugin that is a fork of the official SpotifyControls. Does the same thing but for Tidal instead.
TidaLuna must be installed with [playbackapi](https://github.com/OTCompa/luna-plugins) which exposes an API which TidalControls can interact with.

If PlaybackAPI isn't detected, the plugin will keep trying to hit the API, increasing intervals between tries each time, up to 1 minute in between requests.
At some point (if enabled), the plugin will set up a listening server so that PlaybackAPI can tell the plugin whenever it's available.
Even with the above feature enabled, the plugin will still attempt to hit the endpoint every 5 minutes just in case.
