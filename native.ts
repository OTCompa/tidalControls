/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { CspPolicies, ImageSrc } from "@main/csp";
import { IpcMainInvokeEvent } from "electron";
import { WebSocketServer } from "ws";

let server: WebSocketServer | null = null;
let wsServerActive = false;
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
    try {
        server = new WebSocketServer({ host, port });
        wsServerActive = true;
        server.on("connection", ws => {
            console.log("Server is now detected, closing server.");
            ws.send("hello");
            ws.close(1000); // don't really care about connections, just here to indicate that the server is running
            server.close();
            wsServerActive = false;
            server = null;
        });
        server.on("error", error => {
            console.log("Server ran into an error:", error);
            wsServerActive = false;
            wsServerError = true;
        });
    } catch (error) {
        console.log("Failed to start server:", error);
        wsServerActive = false;
        return false;
    }
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
    wsServerActive = false;
};

export const checkServerStatus = () => wsServerActive;
export const checkServerError = () => wsServerError;
