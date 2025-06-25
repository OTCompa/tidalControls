# TidalControls
A Vencord plugin that is a fork of the official SpotifyControls. Does the same thing but for Tidal instead.
TidaLuna must be installed with [playbackapi](https://github.com/OTCompa/luna-plugins) which exposes an API which TidalControls can interact with.

## Versions
The main version is the one without any additional dependencies.
If the endpoint isn't avaialble, interval between requests will increase up to 60s between requests.
This happens infinitely.

The other version in the branch `ws-dependency` adds an additional dependency to Vencord, `ws`, to
open a websocket server which PlaybackAPI can connect to on load.
Requests to the endpoint will still be made infinitely as a fallback, but only once every 5 minutes instead of every minute.
