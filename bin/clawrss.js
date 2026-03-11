#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const PACKAGE_NAME = "@ipocket/clawrss";
const PLUGIN_ID = "clawrss";
const DEFAULT_CONFIG_PATH = "~/.openclaw/openclaw.json";
const DEFAULT_DB_PATH = "~/.openclaw/clawrss-sync.db";
const DEFAULT_PUSH_RELAY_BASE_URL = "https://push.ipocket.xyz";
const DEFAULT_PUSH_TIMEOUT_MS = 10000;
const DEFAULT_AGENT_INDEX = 0;
const REQUIRED_AGENT_TOOLS = [
  "openclaw_push_get_status",
  "openclaw_push_notify",
  "openclaw_push_notify_digest",
  "openclaw_rss_delete_feed",
  "openclaw_rss_mark",
  "openclaw_rss_list_feeds",
  "openclaw_rss_ingest",
  "openclaw_rss_get_digest",
  "openclaw_rss_pull",
  "openclaw_rss_pull_digests",
  "openclaw_rss_save_digest",
  "openclaw_rss_upsert_feed",
];

function usage() {
  return [
    "Usage:",
    "  clawrss setup --workspace <workspaceID> [options]",
    "",
    "Options:",
    "  --workspace, --namespace <id>   Workspace ID used for pushAppID and future tool calls",
    "  --config <path>                 OpenClaw config file path (default: ~/.openclaw/openclaw.json)",
    "  --db-path <path>                SQLite path for ClawRSS sync data (default: ~/.openclaw/clawrss-sync.db)",
    "  --relay-base-url <url>          Push relay base URL (default: https://push.ipocket.xyz)",
    "  --push-app-id <id>              Override pushAppID (default: workspace ID)",
    "  --push-target-url <url>         Set legacy single-device push target URL",
    "  --push-timeout-ms <ms>          Push timeout in milliseconds (default: 10000)",
    "  --agent-index <n>               agents.list index to patch (default: 0)",
    "  --npm-spec <spec>               Override npm spec passed to openclaw plugins install",
    "  --skip-install                  Skip openclaw plugins install",
    "  --without-push                  Do not write relay push settings",
    "  --restart                       Run openclaw gateway restart after writing config",
    "  --json                          Print machine-readable JSON summary",
    "  --help                          Show this help",
  ].join("\n");
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function readPackageVersion() {
  const packagePath = path.resolve(path.dirname(process.argv[1]), "..", "package.json");
  const raw = fs.readFileSync(packagePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed.version !== "string" || !parsed.version.trim()) {
    fail(`Unable to read version from ${packagePath}.`);
  }
  return parsed.version.trim();
}

function expandHome(input) {
  if (typeof input !== "string" || !input.startsWith("~")) return input;
  return path.join(os.homedir(), input.slice(1));
}

function parseInteger(input, field) {
  const value = Number(input);
  if (!Number.isInteger(value) || value <= 0) {
    fail(`Invalid ${field}: expected a positive integer.`);
  }
  return value;
}

function parseArgs(argv) {
  const options = {
    configPath: DEFAULT_CONFIG_PATH,
    dbPath: DEFAULT_DB_PATH,
    relayBaseURL: DEFAULT_PUSH_RELAY_BASE_URL,
    pushTimeoutMs: DEFAULT_PUSH_TIMEOUT_MS,
    agentIndex: DEFAULT_AGENT_INDEX,
    restart: false,
    skipInstall: false,
    withoutPush: false,
    json: false,
  };

  let command = "";

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!command && !token.startsWith("--")) {
      command = token;
      continue;
    }

    switch (token) {
      case "--workspace":
      case "--namespace":
        options.workspace = argv[++index];
        break;
      case "--config":
        options.configPath = argv[++index];
        break;
      case "--db-path":
        options.dbPath = argv[++index];
        break;
      case "--relay-base-url":
        options.relayBaseURL = argv[++index];
        break;
      case "--push-app-id":
        options.pushAppID = argv[++index];
        break;
      case "--push-target-url":
        options.pushTargetURL = argv[++index];
        break;
      case "--push-timeout-ms":
        options.pushTimeoutMs = parseInteger(argv[++index], "pushTimeoutMs");
        break;
      case "--agent-index":
        options.agentIndex = parseInteger(argv[++index], "agentIndex");
        break;
      case "--npm-spec":
        options.npmSpec = argv[++index];
        break;
      case "--restart":
        options.restart = true;
        break;
      case "--skip-install":
        options.skipInstall = true;
        break;
      case "--without-push":
        options.withoutPush = true;
        break;
      case "--json":
        options.json = true;
        break;
      case "--help":
        options.help = true;
        break;
      default:
        fail(`Unknown argument: ${token}`);
    }
  }

  return { command, options };
}

function ensureObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function mergeUniqueStrings(existing, additions) {
  const result = [];
  for (const entry of [...existing, ...additions]) {
    if (typeof entry !== "string" || !entry.trim()) continue;
    if (result.includes(entry)) continue;
    result.push(entry);
  }
  return result;
}

function loadConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    return {};
  }
  const raw = fs.readFileSync(configPath, "utf8").trim();
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(`Invalid JSON in ${configPath}: ${message}`);
  }
}

function writeConfig(configPath, config) {
  const directory = path.dirname(configPath);
  fs.mkdirSync(directory, { recursive: true });
  const tmpPath = `${configPath}.tmp`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  fs.renameSync(tmpPath, configPath);
}

function patchConfig(config, options) {
  const next = ensureObject(config);
  next.plugins = ensureObject(next.plugins);
  next.plugins.entries = ensureObject(next.plugins.entries);
  const effectivePushAppID = options.pushAppID || options.workspace;

  const pluginEntry = ensureObject(next.plugins.entries[PLUGIN_ID]);
  pluginEntry.enabled = true;
  pluginEntry.config = ensureObject(pluginEntry.config);
  pluginEntry.config.dbPath = options.dbPath;

  if (!options.withoutPush) {
    pluginEntry.config.pushRelayBaseURL = options.relayBaseURL;
    pluginEntry.config.pushAppID = effectivePushAppID;
    pluginEntry.config.pushTimeoutMs = options.pushTimeoutMs;
  }

  if (typeof options.pushTargetURL === "string" && options.pushTargetURL.trim()) {
    pluginEntry.config.pushTargetURL = options.pushTargetURL.trim();
  }

  next.plugins.entries[PLUGIN_ID] = pluginEntry;

  next.agents = ensureObject(next.agents);
  next.agents.list = ensureArray(next.agents.list);

  while (next.agents.list.length <= options.agentIndex) {
    next.agents.list.push({});
  }

  const agentEntry = ensureObject(next.agents.list[options.agentIndex]);
  agentEntry.tools = ensureObject(agentEntry.tools);
  agentEntry.tools.alsoAllow = mergeUniqueStrings(
    ensureArray(agentEntry.tools.alsoAllow),
    REQUIRED_AGENT_TOOLS
  );
  next.agents.list[options.agentIndex] = agentEntry;

  return next;
}

function runOpenClaw(args) {
  const result = spawnSync("openclaw", args, {
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.error) {
    const message = result.error instanceof Error ? result.error.message : String(result.error);
    fail(`Failed to run 'openclaw ${args.join(" ")}': ${message}`);
  }

  return result;
}

function pluginInstalled() {
  const result = runOpenClaw(["plugins", "info", PLUGIN_ID]);
  return result.status === 0;
}

function installPlugin(npmSpec) {
  const result = runOpenClaw(["plugins", "install", npmSpec]);
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    fail(`openclaw plugins install failed.\n${output}`);
  }
}

function restartGateway() {
  const result = runOpenClaw(["gateway", "restart"]);
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    fail(`openclaw gateway restart failed.\n${output}`);
  }
}

function printSummary(summary, asJSON) {
  if (asJSON) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log("ClawRSS setup completed.");
  console.log(`- plugin id: ${summary.pluginID}`);
  console.log(`- installed: ${summary.installStatus}`);
  console.log(`- config path: ${summary.configPath}`);
  console.log(`- workspace: ${summary.workspace}`);
  console.log(`- dbPath: ${summary.dbPath}`);
  if (summary.pushRelayBaseURL) {
    console.log(`- pushRelayBaseURL: ${summary.pushRelayBaseURL}`);
  }
  if (summary.pushAppID) {
    console.log(`- pushAppID: ${summary.pushAppID}`);
  }
  console.log(`- agent index updated: ${summary.agentIndex}`);
  console.log(`- restart requested: ${summary.restartRequested ? "yes" : "no"}`);
  console.log(`- note: ${summary.note}`);
}

function main() {
  const { command, options } = parseArgs(process.argv.slice(2));

  if (options.help || !command) {
    console.log(usage());
    process.exit(options.help ? 0 : 1);
  }

  if (command !== "setup") {
    fail(`Unknown command: ${command}`);
  }

  if (typeof options.workspace !== "string" || !options.workspace.trim()) {
    fail("Missing required --workspace value.");
  }

  options.workspace = options.workspace.trim();
  options.configPath = expandHome(options.configPath);
  options.dbPath = options.dbPath.trim();
  options.relayBaseURL = typeof options.relayBaseURL === "string" ? options.relayBaseURL.trim() : "";
  options.pushAppID = typeof options.pushAppID === "string" ? options.pushAppID.trim() : "";

  const version = readPackageVersion();
  const npmSpec = options.npmSpec?.trim() || `${PACKAGE_NAME}@${version}`;

  let installStatus = "skipped";
  if (!options.skipInstall) {
    if (pluginInstalled()) {
      installStatus = "already_installed";
    } else {
      installPlugin(npmSpec);
      installStatus = "installed";
    }
  }

  const config = loadConfig(options.configPath);
  const nextConfig = patchConfig(config, options);
  writeConfig(options.configPath, nextConfig);

  if (options.restart) {
    restartGateway();
  }

  printSummary({
    pluginID: PLUGIN_ID,
    installStatus,
    npmSpec,
    configPath: options.configPath,
    workspace: options.workspace,
    dbPath: options.dbPath,
    pushRelayBaseURL: options.withoutPush ? "" : options.relayBaseURL,
    pushAppID: options.withoutPush ? "" : (options.pushAppID || options.workspace),
    agentIndex: options.agentIndex,
    restartRequested: options.restart,
    note: options.restart
      ? "Gateway restart was requested explicitly."
      : "Config was written. Plugin changes may still trigger an automatic gateway restart depending on gateway.reload.mode.",
  }, options.json);
}

main();
