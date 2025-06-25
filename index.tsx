/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Settings } from "@api/Settings";
import { disableStyle, enableStyle } from "@api/Styles";
import ErrorBoundary from "@components/ErrorBoundary";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

import hoverOnlyStyle from "./hoverOnly.css?managed";
import { Player } from "./PlayerComponent";

function toggleHoverControls(value: boolean) {
  (value ? enableStyle : disableStyle)(hoverOnlyStyle);
}

export default definePlugin({
  name: "TidalControls",
  description: "Adds a Tidal player above the account panel",
  authors: [
    Devs.Ven,
    Devs.afn,
    Devs.KraXen72,
    Devs.Av32000,
    Devs.nin0dev,
    { name: "Frey", id: 123124171386388480n },
  ],
  options: {
    hoverControls: {
      description: "Show controls on hover",
      type: OptionType.BOOLEAN,
      default: false,
      onChange: v => toggleHoverControls(v),
    },
    useTidalUris: {
      type: OptionType.BOOLEAN,
      description:
        "Open Spotify URIs instead of Spotify URLs. Will only work if you have Spotify installed and might not work on all platforms",
      default: false,
    },
    previousButtonRestartsTrack: {
      type: OptionType.BOOLEAN,
      description:
        "Restart currently playing track when pressing the previous button if playtime is >3s",
      default: true,
    },
    hostname: {
      type: OptionType.STRING,
      description: "Hostname of the Tidal Controls server",
      default: "127.0.0.1",
    },
    port: {
      type: OptionType.NUMBER,
      description: "Port of the Tidal Controls server",
      default: 3665,
      min: 1,
      max: 65535,
    },
    listenServer: {
      type: OptionType.BOOLEAN,
      description:
        "Start a websocket server to listen for PlaybackApi status if plugin is hibernating. If two clients have this enabled at the same time, this feature will not work for one of the clients.",
      default: true,
    },
    listenHost: {
      type: OptionType.STRING,
      description: "Hostname of the listening server",
      default: "127.0.0.1",
    },
    listenPort: {
      type: OptionType.NUMBER,
      description: "Port to listen on to get notified of PlaybackApi",
      default: 3666,
      min: 1,
      max: 65535,
    },
  },
  patches: [
    {
      find: "this.isCopiedStreakGodlike",
      replacement: {
        // react.jsx)(AccountPanel, { ..., showTaglessAccountPanel: blah })
        match: /(?<=\i\.jsxs?\)\()(\i),{(?=[^}]*?userTag:\i,hidePrivateData:)/,
        // react.jsx(WrapperComponent, { VencordOriginal: AccountPanel, ...
        replace: "$self.PanelWrapper,{VencordOriginal:$1,",
      },
    },
    {
      find: ".PLAYER_DEVICES",
      replacement: [
        {
          // Adds POST and a Marker to the SpotifyAPI (so we can easily find it)
          match: /get:(\i)\.bind\(null,(\i\.\i)\.get\)/,
          replace: "post:$1.bind(null,$2.post),vcSpotifyMarker:1,$&",
        },
        {
          // Spotify Connect API returns status 202 instead of 204 when skipping tracks.
          // Discord rejects 202 which causes the request to send twice. This patch prevents this.
          match: /202===\i\.status/,
          replace: "false",
        },
      ],
    },
    {
      find: 'repeat:"off"!==',
      replacement: [
        {
          // Discord doesn't give you shuffle state and the repeat kind, only a boolean
          match: /repeat:"off"!==(\i),/,
          replace:
            "shuffle:arguments[2]?.shuffle_state??false,actual_repeat:$1,$&",
        },
        {
          match: /(?<=artists.filter\(\i=>).{0,10}\i\.id\)&&/,
          replace: "",
        },
      ],
    },
  ],

  start: () =>
    toggleHoverControls(Settings.plugins.TidalControls?.hoverControls ?? false),

  PanelWrapper({ VencordOriginal, ...props }) {
    return (
      <>
        <ErrorBoundary
          fallback={() => (
            <div className="vc-spotify-fallback">
              <p>Failed to render Tidal Modal :(</p>
              <p>Check the console for errors</p>
            </div>
          )}
        >
          <Player />
        </ErrorBoundary>

        <VencordOriginal {...props} />
      </>
    );
  },
});
