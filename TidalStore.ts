/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Settings } from "@api/Settings";
import { Logger } from "@utils/Logger";
import { proxyLazyWebpack } from "@webpack";
import { Flux, FluxDispatcher } from "@webpack/common";
const Native = VencordNative.pluginHelpers.TidalControls as PluginNative<
  typeof import("./native")
>;

export interface Track {
  id: string;
  name: string;
  duration: number;
  isLocal: boolean;
  album: {
    id: string;
    name: string;
    image: {
      height: number;
      width: number;
      url: string;
    };
  };
  artists: {
    id: string;
    href: string;
    name: string;
    type: string;
    uri: string;
  }[];
}

interface Device {
  id: string;
  is_active: boolean;
}

export type Repeat = "off" | "track" | "context";

const logger = new Logger("TidalControls");
const host = Settings.plugins.TidalControls.host || "127.0.0.1";
const port = Settings.plugins.TidalControls.port || 3665;

// Don't wanna run before Flux and Dispatcher are ready!
export const TidalStore = proxyLazyWebpack(() => {
  class TidalStore extends Flux.Store {
    public mPosition = 0;
    public _start = 0;

    public track: Track | null = null;
    public isPlaying = false;
    public repeat: Repeat = "off";
    public shuffle = false;
    public volume = 0;

    public isSettingPosition = false;

    public device: Device | null = null;

    public openExternal(path: string) {
      // const url = Settings.plugins.SpotifyControls.useSpotifyUris || Vencord.Plugins.isPluginEnabled("OpenInApp")
      //   ? "spotify:" + path.replaceAll("/", (_, idx) => idx === 0 ? "" : ":")
      //   : "https://listen.tidal.com" + path;
      const url = `https://listen.tidal.com${path}`;
      VencordNative.native.openExternal(url);
    }

    // Need to keep track of this manually
    public get position(): number {
      let pos = this.mPosition;
      if (this.isPlaying) {
        pos += Date.now() - this._start;
      }
      return pos;
    }

    public set position(p: number) {
      this.mPosition = p;
      this._start = Date.now();
    }

    prev() {
      if (this.position > 3000) {
        this.seek(0);
      } else {
        this._req("PUT", "/prev");
      }
    }

    next() {
      this._req("PUT", "/next");
    }

    setVolume(percent: number) {
      this._req("PUT", "/volume", { level: percent }).then(() => {
        this.volume = percent;
        this.emitChange();
      });
    }

    setPlaying(playing: boolean) {
      this._req("PUT", playing ? "/play" : "/pause");
    }

    setRepeat(state: Repeat) {
      this._req("PUT", "/repeat", { state }).then(() => {
        this.repeat = state;
        this.emitChange();
      });
    }

    setShuffle(state: boolean) {
      this._req("PUT", "/shuffle", { state }).then(() => {
        this.shuffle = state;
        this.emitChange();
      });
    }

    seek(ms: number) {
      if (this.isSettingPosition) return Promise.resolve();
      this.isSettingPosition = true;
      this._req("PUT", "/seek", { position: ms / 1000 });
      this.isSettingPosition = false;
    }

    async _req(method: "GET" | "PUT", route: string, data: any = {}) {
      await Native.request(method, host, port, route, data);
    }
  }

  const store = new TidalStore(FluxDispatcher);

  return store;
});
