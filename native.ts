/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { CspPolicies, ImageSrc } from "@main/csp";
import { IpcMainInvokeEvent } from "electron";

CspPolicies["resources.tidal.com"] = ImageSrc;

export async function request(_: IpcMainInvokeEvent, method: "GET" | "PUT", host: string, port: number, route: string, data: any = {}) {
    var url = new URL(`http://${host}:${port}${route}`);
    if (data) {
        for (const key in data) {
            url.searchParams.append(key, data[key]);
        }
    }
    return await fetch(url, {
        method,
    });
}
