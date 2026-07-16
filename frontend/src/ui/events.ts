/** Tiny typed event bus for UI effects (animations, sound, confetti). */

type EventMap = {
  "key-tap": void;
  shake: void;
  "tile-color": { guessIndex: number; tile: number; color: 0 | 1 | 2 };
  win: { guessIndex: number };
  paid: { txHash: string };
  revealed: { word: string; guesses: unknown[] };
  "new-round": void;
};

type Handler<K extends keyof EventMap> = (payload: EventMap[K]) => void;

const handlers = new Map<keyof EventMap, Set<Handler<any>>>();

export const events = {
  on<K extends keyof EventMap>(event: K, handler: Handler<K>): () => void {
    if (!handlers.has(event)) handlers.set(event, new Set());
    handlers.get(event)!.add(handler);
    return () => handlers.get(event)!.delete(handler);
  },
  emit<K extends keyof EventMap>(event: K, payload?: EventMap[K]): void {
    handlers.get(event)?.forEach((h) => h(payload));
  },
};
