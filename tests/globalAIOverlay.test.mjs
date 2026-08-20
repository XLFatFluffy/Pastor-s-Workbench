import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);

test("global AI overlay exposes persistent conversation UI", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const js = fs.readFileSync(path.join(root, "globalAI.js"), "utf8");
  const service = fs.readFileSync(path.join(root, "aiService.js"), "utf8");
  assert.match(html, /global-ai-launcher/);
  assert.match(html, /global-ai-scrim/);
  assert.match(html, /global-ai/);
  assert.match(js, /Conversations/);
  assert.match(js, /New chat/);
  assert.match(js, /data-conversation/);
  assert.match(js, /Ctrl|metaKey/);
  assert.match(service, /createAIConversation/);
  assert.match(service, /getAIMessages/);
  assert.match(service, /saveAIMessage/);
});
