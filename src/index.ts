import { OpenClawRSSDatabase, resolveDBPath } from "./db.js";
import { PushRelayClient } from "./push/client.js";
import { deleteFeedDefinition, runDeleteFeed } from "./tools/deleteFeed.js";
import { getDigestDefinition, runGetDigest } from "./tools/getDigest.js";
import { ingestDefinition, runIngest } from "./tools/ingest.js";
import { listFeedsDefinition, runListFeeds } from "./tools/listFeeds.js";
import { markDefinition, runMark } from "./tools/mark.js";
import { pullDefinition, runPull } from "./tools/pull.js";
import { pullDigestsDefinition, runPullDigests } from "./tools/pullDigests.js";
import { pushGetStatusDefinition, runPushGetStatus } from "./tools/pushGetStatus.js";
import { pushNotifyDigestDefinition, runPushNotifyDigest } from "./tools/pushNotifyDigest.js";
import { pushNotifyDefinition, runPushNotify } from "./tools/pushNotify.js";
import { saveDigestDefinition, runSaveDigest } from "./tools/saveDigest.js";
import { upsertFeedDefinition, runUpsertFeed } from "./tools/upsertFeed.js";

const PLUGIN_ID = "openclaw-rss";

type PluginApi = {
  config?: {
    plugins?: {
      entries?: Record<string, { config?: Record<string, unknown> }>
    }
  };
  registerTool: (definition: {
    name: string;
    description: string;
    parameters: unknown;
    execute: (id: string, params: any) => Promise<unknown> | unknown;
  }) => void;
};

function readPluginConfig(api: PluginApi): {
  dbPath: string;
  defaultLimit: number;
  pushTargetURL: string;
  pushRelayBaseURL: string;
  pushAppID: string;
  pushTimeoutMs: number;
} {
  const raw = api.config?.plugins?.entries?.[PLUGIN_ID]?.config ?? {};
  const dbPathRaw = typeof raw.dbPath === "string" ? raw.dbPath : "~/.openclaw/clawrss-sync.db";
  const defaultLimitRaw = Number(raw.defaultLimit);
  const pushTimeoutRaw = Number(raw.pushTimeoutMs);

  return {
    dbPath: resolveDBPath(dbPathRaw),
    defaultLimit: Number.isFinite(defaultLimitRaw) && defaultLimitRaw > 0
      ? Math.min(defaultLimitRaw, 500)
      : 50,
    pushTargetURL: typeof raw.pushTargetURL === "string" ? raw.pushTargetURL.trim() : "",
    pushRelayBaseURL: typeof raw.pushRelayBaseURL === "string" ? raw.pushRelayBaseURL.trim() : "",
    pushAppID: typeof raw.pushAppID === "string" && raw.pushAppID.trim() ? raw.pushAppID.trim() : "claw-rss",
    pushTimeoutMs: Number.isFinite(pushTimeoutRaw) && pushTimeoutRaw > 0
      ? Math.min(Math.trunc(pushTimeoutRaw), 60000)
      : 10000,
  };
}

export default function register(api: PluginApi) {
  const {
    dbPath,
    defaultLimit,
    pushTargetURL,
    pushRelayBaseURL,
    pushAppID,
    pushTimeoutMs,
  } = readPluginConfig(api);
  const db = new OpenClawRSSDatabase(dbPath);
  const relayClient = new PushRelayClient({
    targetURL: pushTargetURL,
    relayBaseURL: pushRelayBaseURL,
    appID: pushAppID,
    timeoutMs: pushTimeoutMs,
  });

  api.registerTool({
    ...upsertFeedDefinition,
    async execute(_id, params) {
      return runUpsertFeed(db, params ?? {});
    }
  });

  api.registerTool({
    ...ingestDefinition,
    async execute(_id, params) {
      return runIngest(db, params ?? {});
    }
  });

  api.registerTool({
    ...pullDefinition,
    async execute(_id, params) {
      return runPull(db, params ?? {}, defaultLimit);
    }
  });

  api.registerTool({
    ...saveDigestDefinition,
    async execute(_id, params) {
      return runSaveDigest(db, params ?? {});
    }
  });

  api.registerTool({
    ...pullDigestsDefinition,
    async execute(_id, params) {
      return runPullDigests(db, params ?? {}, defaultLimit);
    }
  });

  api.registerTool({
    ...getDigestDefinition,
    async execute(_id, params) {
      return runGetDigest(db, params ?? {});
    }
  });

  api.registerTool({
    ...deleteFeedDefinition,
    async execute(_id, params) {
      return runDeleteFeed(db, params ?? {});
    }
  });

  api.registerTool({
    ...listFeedsDefinition,
    async execute(_id, params) {
      return runListFeeds(db, params ?? {});
    }
  });

  api.registerTool({
    ...markDefinition,
    async execute(_id, params) {
      return runMark(db, params ?? {});
    }
  });

  api.registerTool({
    ...pushNotifyDefinition,
    async execute(_id, params) {
      return runPushNotify(relayClient, params ?? {});
    }
  });

  api.registerTool({
    ...pushNotifyDigestDefinition,
    async execute(_id, params) {
      return runPushNotifyDigest(db, relayClient, params ?? {});
    }
  });

  api.registerTool({
    ...pushGetStatusDefinition,
    async execute(_id, params) {
      return runPushGetStatus(relayClient, params ?? {});
    }
  });
}

export const id = PLUGIN_ID;
