import { Redis } from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

let publisher: Redis | null = null;
let subscriber: Redis | null = null;
let cacheClient: Redis | null = null;

function getPublisher(): Redis {
  if (!publisher) {
    publisher = new Redis(REDIS_URL);
  }
  return publisher;
}

function getSubscriber(): Redis {
  if (!subscriber) {
    subscriber = new Redis(REDIS_URL);
  }
  return subscriber;
}

function getCacheClient(): Redis {
  if (!cacheClient) {
    cacheClient = new Redis(REDIS_URL);
  }
  return cacheClient;
}

export function publishMessage(channel: string, message: string): void {
  getPublisher().publish(channel, message);
}

export function subscribeToChannel(
  channel: string,
  callback: (message: string) => void,
): void {
  const sub = getSubscriber();

  sub
    .subscribe(channel)
    .then((count) => {
      console.log(
        `Subscribed to ${count} channel(s). Listening on "${channel}".`,
      );
    })
    .catch((err: unknown) => {
      console.error(`Failed to subscribe to channel ${channel}:`, err);
    });

  sub.on("message", (chan: string, message: string) => {
    if (chan === channel) {
      callback(message);
    }
  });
}

export async function getCache(key: string): Promise<string | null> {
  return await getCacheClient().get(key);
}

export async function setCache(
  key: string,
  value: string,
  ttlSeconds?: number,
): Promise<void> {
  const client = getCacheClient();
  if (ttlSeconds) {
    await client.set(key, value, "EX", ttlSeconds);
  } else {
    await client.set(key, value);
  }
}

export async function deleteCache(key: string): Promise<void> {
  await getCacheClient().del(key);
}
