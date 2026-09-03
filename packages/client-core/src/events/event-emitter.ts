import type { AiMemoryEvents } from "./event-types.js";

export type EventHandler<T> = (payload: T) => void | Promise<void>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (payload: any) => void | Promise<void>;

/**
 * Platform-independent, zero-dependency Typed Event Emitter.
 */
export class TypedEventEmitter {
  private listeners = new Map<keyof AiMemoryEvents, Set<AnyHandler>>();

  /**
   * Subscribes a listener to a specific event.
   * @returns Unsubscribe function to easily detach the listener.
   */
  on<E extends keyof AiMemoryEvents>(
    event: E,
    handler: EventHandler<AiMemoryEvents[E]>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as AnyHandler);

    return () => this.off(event, handler);
  }

  /**
   * Subscribes a listener that will trigger at most once.
   * @returns Unsubscribe function.
   */
  once<E extends keyof AiMemoryEvents>(
    event: E,
    handler: EventHandler<AiMemoryEvents[E]>
  ): () => void {
    const wrapped: EventHandler<AiMemoryEvents[E]> = (payload) => {
      this.off(event, wrapped);
      return handler(payload);
    };
    return this.on(event, wrapped);
  }

  /**
   * Removes a specific listener from an event.
   */
  off<E extends keyof AiMemoryEvents>(
    event: E,
    handler: EventHandler<AiMemoryEvents[E]>
  ): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler as AnyHandler);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Synchronously dispatches an event to all registered listeners.
   */
  emit<E extends keyof AiMemoryEvents>(
    event: E,
    payload: AiMemoryEvents[E]
  ): void {
    const handlers = this.listeners.get(event);
    if (!handlers || handlers.size === 0) return;

    for (const handler of Array.from(handlers)) {
      try {
        const result = handler(payload);
        if (result instanceof Promise) {
          result.catch((err) => {
            console.error(`[AiMemory:EventError] Error in async handler for '${String(event)}':`, err);
          });
        }
      } catch (err) {
        console.error(`[AiMemory:EventError] Error in handler for '${String(event)}':`, err);
      }
    }
  }

  /**
   * Returns the count of active listeners for a given event.
   */
  listenerCount<E extends keyof AiMemoryEvents>(event: E): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  /**
   * Clears all listeners for a given event or all events if none specified.
   */
  removeAllListeners<E extends keyof AiMemoryEvents>(event?: E): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

