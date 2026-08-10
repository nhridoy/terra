import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  HttpError,
  httpRequest,
  onSessionRevoked,
  SESSION_REVOKED_EVENT,
} from "./http";

const mockInvoke = vi.mocked(invoke);
const mockListen = vi.mocked(listen);

beforeEach(() => {
  mockInvoke.mockReset();
  mockListen.mockReset();
});

describe("httpRequest", () => {
  it("returns the wrapped response and forwards the Tauri args", async () => {
    mockInvoke.mockResolvedValue([200, '{"ok":true}']);
    const res = await httpRequest("GET", "/api/v1/ping");
    expect(res).toEqual({ status: 200, body: '{"ok":true}' });
    expect(mockInvoke).toHaveBeenCalledWith("http_request", {
      method: "GET",
      path: "/api/v1/ping",
      body: null,
      auth: true,
    });
  });

  it("sends the JSON body and honors auth: false", async () => {
    mockInvoke.mockResolvedValue([201, ""]);
    await httpRequest(
      "POST",
      "/api/v1/auth/refresh",
      { refresh_token: "rt" },
      { auth: false },
    );
    expect(mockInvoke).toHaveBeenCalledWith("http_request", {
      method: "POST",
      path: "/api/v1/auth/refresh",
      body: { refresh_token: "rt" },
      auth: false,
    });
  });

  it("maps network: rejections to HttpError(network) with the server message", async () => {
    mockInvoke.mockRejectedValue(
      "network:Cannot reach the server. Check that it is running and your connection is online.",
    );
    await expect(httpRequest("GET", "/api/v1/ping")).rejects.toMatchObject({
      name: "HttpError",
      kind: "network",
      message:
        "Cannot reach the server. Check that it is running and your connection is online.",
    });
  });

  it("maps any other rejection to HttpError(auth_expired)", async () => {
    mockInvoke.mockRejectedValue("auth:session-expired. Please sign in again.");
    await expect(httpRequest("GET", "/api/v1/me")).rejects.toMatchObject({
      name: "HttpError",
      kind: "auth_expired",
      message: "Your session has expired. Please sign in again.",
    });
  });
});

describe("onSessionRevoked", () => {
  it("wires a listener on the session-revoked event and returns the unlisten fn", async () => {
    const unlisten = vi.fn();
    mockListen.mockResolvedValue(unlisten);
    const cb = vi.fn();
    const result = await onSessionRevoked(cb);
    expect(mockListen).toHaveBeenCalledWith(SESSION_REVOKED_EVENT, cb);
    expect(result).toBe(unlisten);
  });
});

describe("HttpError", () => {
  it("is an instanceof Error with name HttpError", () => {
    const err = new HttpError("network", "boom");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("HttpError");
    expect(err.kind).toBe("network");
  });
});
