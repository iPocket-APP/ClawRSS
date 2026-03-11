import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const cliPath = path.resolve("bin/clawrss.js");

test("setup CLI writes plugin config and agent allowlist", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "clawrss-setup-cli-"));
  const configPath = path.join(tempDir, "openclaw.json");

  const result = spawnSync(process.execPath, [
    cliPath,
    "setup",
    "--workspace",
    "clawrss-demo-a",
    "--config",
    configPath,
    "--skip-install",
    "--json",
  ], {
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.installStatus, "skipped");
  assert.equal(summary.workspace, "clawrss-demo-a");

  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  assert.equal(config.plugins.entries.clawrss.enabled, true);
  assert.equal(config.plugins.entries.clawrss.config.dbPath, "~/.openclaw/clawrss-sync.db");
  assert.equal(config.plugins.entries.clawrss.config.pushRelayBaseURL, "https://push.ipocket.xyz");
  assert.equal(config.plugins.entries.clawrss.config.pushAppID, "clawrss-demo-a");
  assert.equal(config.plugins.entries.clawrss.config.pushTimeoutMs, 10000);
  assert.equal(Array.isArray(config.agents.list[0].tools.alsoAllow), true);
  assert.equal(config.agents.list[0].tools.alsoAllow.includes("openclaw_rss_pull"), true);
});

test("setup CLI preserves existing config and can skip push fields", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "clawrss-setup-cli-"));
  const configPath = path.join(tempDir, "openclaw.json");
  fs.writeFileSync(configPath, JSON.stringify({
    gateway: {
      reload: {
        mode: "hybrid"
      }
    },
    plugins: {
      entries: {
        clawrss: {
          config: {
            defaultLimit: 100
          }
        }
      }
    },
    agents: {
      list: [
        {
          tools: {
            alsoAllow: ["web_search"]
          }
        }
      ]
    }
  }, null, 2));

  const result = spawnSync(process.execPath, [
    cliPath,
    "setup",
    "--workspace",
    "clawrss-demo-b",
    "--config",
    configPath,
    "--skip-install",
    "--without-push",
    "--json",
  ], {
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);

  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  assert.equal(config.gateway.reload.mode, "hybrid");
  assert.equal(config.plugins.entries.clawrss.enabled, true);
  assert.equal(config.plugins.entries.clawrss.config.defaultLimit, 100);
  assert.equal(config.plugins.entries.clawrss.config.dbPath, "~/.openclaw/clawrss-sync.db");
  assert.equal("pushRelayBaseURL" in config.plugins.entries.clawrss.config, false);
  assert.equal(config.agents.list[0].tools.alsoAllow.includes("web_search"), true);
  assert.equal(config.agents.list[0].tools.alsoAllow.includes("openclaw_rss_upsert_feed"), true);
});
