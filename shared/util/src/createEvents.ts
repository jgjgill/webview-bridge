interface EventsMap {
  [event: string]: any;
}

export interface DefaultEvents extends EventsMap {
  [event: string]: (...args: any) => void;
}

export interface EventEmitter<Events extends EventsMap = DefaultEvents> {
  emit<K extends keyof Events>(
    this: this,
    event: K,
    ...args: Parameters<Events[K]>
  ): void;

  events: Partial<{ [E in keyof Events]: Events[E][] }>;
  on<K extends keyof Events>(this: this, event: K, cb: Events[K]): () => void;
}

export const createEvents = <
  Events extends EventsMap = DefaultEvents,
>(): EventEmitter<Events> => ({
  events: {},
  emit(event, ...args) {
    const callbacks = this.events[event] || [];
    for (let i = 0, length = callbacks.length; i < length; i++) {
      callbacks[i](...args);
    }
  },
  on(event, cb) {
    this.events[event]?.push(cb) || (this.events[event] = [cb]);
    return () => {
      this.events[event] = this.events[event]?.filter((i) => cb !== i);
    };
  },
});

export interface CreateResolverOptions {
  emitter: EventEmitter<DefaultEvents>;
  evaluate: () => void;
  eventId: string;
  failHandler?: Error | false;
  methodName: string;
  onFallback?: () => void;
}

export const createResolver = ({
  emitter,
  evaluate,
  eventId,
  failHandler = false,
  methodName,
  onFallback,
}: CreateResolverOptions) => {
  return new Promise((resolve, reject) => {
    const unbind = emitter.on(
      `${methodName}-${eventId}`,
      (data, throwOccurred: boolean) => {
        unbind();

        if (throwOccurred) {
          if (failHandler instanceof Error) {
            onFallback?.();
            reject(failHandler);
          } else {
            resolve(void 0);
          }
        } else {
          resolve(data);
        }
      },
    );
    evaluate();
  });
};
