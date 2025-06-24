/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";
import { proxyLazyWebpack } from "@webpack";
import { Flux, FluxDispatcher } from "@webpack/common";


const Native = VencordNative.pluginHelpers.TidalControls as PluginNative<typeof import("./native")>;
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

interface PlayerState {
  accountId: string;
  track: Track | null;
  volumePercent: number;
  isPlaying: boolean;
  repeat: boolean;
  position: number;
  context?: any;
  device?: Device;

  // added by patch
  actual_repeat: Repeat;
  shuffle: boolean;
}

interface Device {
  id: string;
  is_active: boolean;
}

export type Repeat = "off" | "track" | "context";

const logger = new Logger("TidalControls");
const host = "127.0.0.1";
const port = 3665;

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
      //     ? "spotify:" + path.replaceAll("/", (_, idx) => idx === 0 ? "" : ":")
      //     : "https://open.spotify.com" + path;
      // VencordNative.native.openExternal(url);
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
      this._req("PUT", "/previous");
    }

    next() {
      this._req("PUT", "/next");
    }

    setVolume(percent: number) {
      //   this._req("put", "/volume", {
      //     query: {
      //       volume_percent: Math.round(percent),
      //     },
      //   }).then(() => {
      //     this.volume = percent;
      //     this.emitChange();
      //   });
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

  let backOff = 0;
  const interval = setInterval(async () => {
    if (backOff > 0) {
      logger.error(`[TidalStore] Retrying in ${backOff} seconds...`);
      backOff--;
      return;
    }
    const res = await fetch("http://127.0.0.1:3665/now-playing");
    if (!res.ok) {
      backOff += 3;
      logger.error(
        "[TidalStore] Failed to fetch now playing, retrying in 3 seconds..."
      );
      return;
    } else {
      const json = await res.json();
      if (json.error) {
        logger.error("[TidalStore] Error fetching now playing:", json.error);
        backOff += 3;
        return;
      } else {
        logger.info(json);
        store.track = {
          id: json.item?.id ?? "",
          name: json.item?.title ?? "",
          duration: (json.item?.duration ?? 0) * 1000,
          isLocal: false,
          album: {
            id: json.item?.album?.id ?? "",
            name: json.item?.album?.title ?? "",
            image: {
              height: 1280,
              width: 1280,
              url: json.albumArt ?? "",
            },
          },
          artists:
            json.item?.artists?.map((artist: any) => ({
              id: artist.id ?? "",
              href: "",
              name: artist.name ?? "",
              type: "artist",
              uri: "",
            })) ?? [],
        };

        store.isPlaying = !json.paused;

        // store.volume = json.volume ?? 0;
        // store.repeat = json.repeat ? "track" : "off";
        // store.shuffle = json.shuffle ?? false;
        store.position = (json.position ?? 0) * 1000;

        store.isSettingPosition = false;
        store.emitChange();
      }
    }
  }, 1000);

  // return () => clearInterval(interval);

  return store;
});
