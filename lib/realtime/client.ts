"use client";

import { io, type Socket } from "socket.io-client";
import { authFetch } from "@/lib/api/client";

/**
 * The browser's socket, and the rules for keeping it alive.
 *
 * ## One connection, shared
 *
 * A module-level singleton rather than a socket per component. The connection is
 * the expensive part — a handshake each — and the point of a socket is that many
 * places can listen on one. Components subscribe and unsubscribe; the socket
 * itself opens when the first one asks and closes when the last one leaves.
 *
 * ## Reconnecting is a credential problem, not a retry problem
 *
 * Socket.IO reconnects by itself, but every reconnection needs a **fresh**
 * ticket: the old one expired in a minute and a used one is worth nothing. So
 * an authentication failure triggers a new ticket and an explicit reconnect
 * rather than an endless loop of rejections — and a ticket is fetched before
 * each attempt, not once at startup.
 *
 * ## Failure is not fatal
 *
 * Nothing here throws to its callers. Every caller is a page that works without
 * a socket — the notification list loads over REST, the generation screen falls
 * back to polling — so a socket that cannot be established costs latency and
 * nothing else. That is deliberate: a deployment where the API's socket is
 * unreachable should degrade, not break.
 */

interface TicketResponse {
  ticket: string;
  expiresInSeconds: number;
  url: string;
}

type Listener = (payload: unknown) => void;

let socket: Socket | null = null;
let pending: Promise<Socket | null> | null = null;
let refCount = 0;

/** Event name → listeners, so one socket can serve every consumer and the
 *  connection can stay open while any of them is interested. */
const listeners = new Map<string, Set<Listener>>();
/** Topics this client has asked for, replayed after a reconnect: the server
 *  keeps no memory of a subscription across connections. */
const topics = new Set<string>();

async function fetchTicket(): Promise<TicketResponse | null> {
  try {
    return await authFetch<TicketResponse>("realtime-ticket", {
      method: "POST",
    });
  } catch {
    // Includes the signed-out case, which is not an error worth surfacing: the
    // page a signed-out reader sees has no bell on it.
    return null;
  }
}

function dispatch(event: string, payload: unknown): void {
  for (const listener of listeners.get(event) ?? []) {
    try {
      listener(payload);
    } catch {
      // One bad listener must not stop the others from being told.
    }
  }
}

/**
 * Opens the connection if it is not already open.
 *
 * Concurrent callers share one attempt: three components mounting at once
 * should cost one ticket, not three.
 */
export async function connectRealtime(): Promise<Socket | null> {
  if (socket?.connected) return socket;
  if (pending) return pending;

  pending = (async () => {
    const ticket = await fetchTicket();
    if (!ticket) return null;

    const next = io(ticket.url, {
      // The ticket, not a cookie: see `/api/auth/realtime-ticket`.
      auth: { ticket: ticket.ticket },
      // Websocket first, with polling as the fallback for a network that will
      // not carry the upgrade.
      transports: ["websocket", "polling"],
      // No cross-origin cookie is sent — the ticket is the whole credential.
      withCredentials: false,
      // Let the server's own reconnect guidance apply; we only intervene when
      // the failure is ours to fix (an expired ticket).
      reconnection: true,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 10_000,
    });

    next.on("connect", () => {
      // Re-subscribe: this connection is new as far as the server is concerned.
      for (const topic of topics) next.emit("subscribe", { topic });
    });

    next.on("connect_error", async (error) => {
      const message = error.message ?? "";
      if (!/ticket|auth/i.test(message)) return;

      // The ticket aged out, or the connection was refused as unauthenticated.
      // Fetch another and try once more rather than letting Socket.IO retry
      // with a credential that can never work.
      const fresh = await fetchTicket();
      if (!fresh) return;

      next.auth = { ticket: fresh.ticket };
    });

    for (const [event] of listeners) {
      next.on(event, (payload: unknown) => dispatch(event, payload));
    }

    socket = next;
    return next;
  })();

  try {
    return await pending;
  } finally {
    pending = null;
  }
}

/**
 * Listens for a server event, opening the connection if needed.
 *
 * Returns an unsubscribe function, and closes the socket when the last listener
 * goes — so signing out, or navigating away from the only screen that cared,
 * does not leave a connection open for the life of the tab.
 */
export function onRealtimeEvent(
  event: string,
  listener: Listener,
): () => void {
  refCount += 1;

  let set = listeners.get(event);
  if (!set) {
    set = new Set();
    listeners.set(event, set);
  }
  set.add(listener);

  // A listener added after the socket is already open still needs wiring: the
  // socket was created with whatever events existed then.
  socket?.on(event, listener);

  void connectRealtime();

  return () => {
    refCount -= 1;
    set.delete(listener);
    socket?.off(event, listener);
    if (set.size === 0) listeners.delete(event);

    if (refCount <= 0) {
      refCount = 0;
      socket?.disconnect();
      socket = null;
    }
  };
}

/** Asks to be told about a topic. Idempotent, and replayed on reconnect. */
export function subscribeTopic(topic: string): void {
  topics.add(topic);
  socket?.emit("subscribe", { topic });
}

export function unsubscribeTopic(topic: string): void {
  topics.delete(topic);
  socket?.emit("unsubscribe", { topic });
}

/** Closes everything. Called when the session ends, so a signed-out tab does
 *  not keep a socket open against an account it no longer holds. */
export function disconnectRealtime(): void {
  topics.clear();
  listeners.clear();
  refCount = 0;
  socket?.disconnect();
  socket = null;
}
