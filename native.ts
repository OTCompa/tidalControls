/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { CspPolicies, ImageSrc } from "@main/csp";
import { IpcMainInvokeEvent } from "electron";
import { createServer } from "http";

let server: ReturnType<typeof createServer> | null = null;
let wsServerError = false;

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

export const startServer = (_: IpcMainInvokeEvent, host: string, port: number = 3666) => {
    if (server) {
        console.log("Server is already running, restarting");
        stopServer();
    }
    server = createServer((req, res) => {
        if (req.method === "GET") {
            res.writeHead(200);
            res.end();
            stopServer();
            return;
        }

        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
    });
    server.on("error", err => {
        console.error("Server error:", err);
        wsServerError = true;
    });
    server.listen(port, host, undefined, () => {
        console.log(`Running listening server on ${host}:${port}`);
    });
    return true;
};

export const stopServer = () => {
    if (server) {
        server.close(() => {
            server = null;
            console.log("Server stopped");
        });
    }
    wsServerError = false;
};

export const checkServerStatus = () => server?.listening ?? false;
export const checkServerError = () => wsServerError;
