/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Settings } from "@api/Settings";
import { Logger } from "@utils/Logger";
import { useEffect } from "@webpack/common";

import { Repeat, TidalStore } from "./TidalStore";


const Native = VencordNative.pluginHelpers.TidalControls as PluginNative<
    typeof import("./native")
>;

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

const COOLDOWN_SECONDS = 2;

const repeatDictionary: Record<string, Repeat> = {
    0: "off",
    1: "context",
    2: "track",
};

export default function TidalStoreUpdater() {
    useEffect(() => {
        let backOffSeconds = 0;
        let backOffCounter = 0;

        let cooldownVolume = 0;
        let cooldownShuffle = 0;
        let cooldownRepeat = 0;

        async function updateTidal() {
            async function loop() { // to make returns restart the loop
                // backoff
                if (backOffSeconds > 0) {
                    if (!await Native.checkServerStatus() && !await Native.checkServerError()) {
                        // if server indicated it is up
                        logger.log("[TidalStoreUpdater] WebSocketServer is not running, assuming server is up again!");
                        backOffSeconds = 0;
                        backOffCounter = 0;
                        return;
                    }
                    backOffSeconds--;
                    return;
                }

                // try to hit endpoint
                let res: Response;
                try {
                    res = await fetch(`http://${Settings.plugins.TidalControls?.host ?? "127.0.0.1"}:${Settings.plugins.TidalControls?.port ?? 3665}/now-playing`);
                    if (!res.ok) {
                        logger.error(`[TidalStoreUpdater] HTTP error! status: ${res.status}`);
                        return;
                    }
                } catch (e) {
                    if ((Settings.plugins.TidalControls?.listenServer ?? true) && backOffCounter >= 5 && !await Native.checkServerError()) {
                        // if too many failed attempts in a row (over about ~63s), assume server is down and start listening for signs of life
                        // this solution only works for one discord client at a time. i'll have to figure out a better way to handle this
                        // falls back to other solution if listening server had an error
                        logger.error("[TidalStoreUpdater] Too many failed attempts. Server is probably down.");
                        if (!await Native.checkServerStatus()) { // if not already started
                            logger.log("[TidalStoreUpdater] Setting up websocket server...");
                            const serverStatus = await Native.startServer(Settings.plugins.TidalControls?.listenHost ?? "127.0.0.1", Settings.plugins.TidalControls?.listenPort ?? 3666);
                            if (!serverStatus) {
                                logger.error("[TidalStoreUpdater] Failed to start websocket server.");
                                return;
                            }
                        }
                        backOffSeconds = 300; // backup check every 5 minutes
                        TidalStore.isPlaying = false;
                        TidalStore.emitChange();
                    } else {
                        // else increase interval for next try
                        backOffSeconds += 3 * (backOffCounter + 1);
                        logger.log(`[TidalStoreUpdater] Failed to fetch now playing: ${e}\nRetrying in ${backOffSeconds} seconds...\nBackoff counter: ${backOffCounter}`);
                        if (backOffCounter < 20) { // max polling rate of 1 minute
                            backOffCounter++;
                        }
                    }
                    return;
                }

                // process response
                const json = await res.json();
                if (json.error) {
                    logger.error("[TidalStoreUpdater] Malformed response:", json.error);
                    backOffSeconds += 3;
                    return;
                } else {
                    if (await Native.checkServerStatus()) await Native.stopServer();
                    backOffCounter = 0;

                    TidalStore.track = parseTrack(json);
                    TidalStore.isPlaying = !json.paused;
                    TidalStore.position = (json.position ?? 0) * 1000;

                    // only update these on initialization
                    // if remotely updated, wait a bit to prevent resetting while API is still updating
                    if (TidalStore.volume === undefined || cooldownVolume >= COOLDOWN_SECONDS) {
                        TidalStore.volume = json.volume ?? undefined;
                        cooldownVolume = 0;
                    }

                    if (TidalStore.repeat === undefined || cooldownRepeat >= COOLDOWN_SECONDS) {
                        const repeat = json.repeat ?? undefined;
                        if (repeat !== undefined) {
                            TidalStore.repeat = repeatDictionary[repeat] ?? undefined;
                            cooldownRepeat = 0;
                        }
                    }

                    if (TidalStore.shuffle === undefined || cooldownShuffle >= COOLDOWN_SECONDS) {
                        TidalStore.shuffle = json.shuffle ?? undefined;
                        cooldownShuffle = 0;
                    }

                    if (TidalStore.volume !== json.volume) cooldownVolume += 1;
                    if (TidalStore.repeat !== repeatDictionary[json.repeat]) cooldownRepeat += 1;
                    if (TidalStore.shuffle !== json.shuffle) cooldownShuffle += 1;

                    TidalStore.emitChange();
                }
            }
            await loop();
            setTimeout(updateTidal, 1000);
        }
        updateTidal();
    }, []);
}
