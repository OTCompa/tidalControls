/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Settings } from "@api/Settings";
import { Logger } from "@utils/Logger";
import { useEffect } from "@webpack/common";

import { TidalStore } from "./TidalStore";

const logger = new Logger("TidalControls");

function parseTrack(json: any) {
    if (json.item === null) return null;

    return {
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
}

const host = Settings.plugins.TidalControls.host || "127.0.0.1";
const port = Settings.plugins.TidalControls.port || 3665;

export default function TidalStoreUpdater() {
    useEffect(() => {
        let backOff = 0;
        const interval = setInterval(async () => {
            if (backOff > 0) {
                logger.error(`[TidalStore] Retrying in ${backOff} seconds...`);
                backOff--;
                return;
            }
            const res = await fetch(`http://${host}:${port}/now-playing`);
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
                    TidalStore.track = parseTrack(json);

                    TidalStore.isPlaying = !json.paused;

                    // store.volume = json.volume ?? 0;
                    // store.repeat = json.repeat ? "track" : "off";
                    // store.shuffle = json.shuffle ?? false;
                    TidalStore.position = (json.position ?? 0) * 1000;

                    TidalStore.isSettingPosition = false;
                    TidalStore.emitChange();
                }
            }
        }, 1000);
        return () => clearInterval(interval);
    }, []);
}
