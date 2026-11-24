import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

let server;
let baseUrl;

before(async () => {
  const probe = createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));

  baseUrl = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ["server.mjs"], {
    cwd: new URL(".", import.meta.url),
    env: { ...process.env, PORT: String(port) },
    stdio: "ignore",
  });

  for (let attempt = 0; attempt < 50; attempt++) {
    if (server.exitCode !== null) throw new Error("Server stopped before startup");
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch { /* Wait for the listener. */ }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Server did not start");
});

after(() => server?.kill());

async function triage(body) {
  const response = await fetch(`${baseUrl}/api/triage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  return { status: response.status, data: await response.json() };
}

test("accepts a valid model response", async () => {
  const response = await triage(JSON.stringify({ text: "Когда доставка?" }));
  assert.equal(response.status, 200);
  assert.equal(response.data.status, "ready");
  assert.equal(response.data.topic, "delivery");
  assert.ok(response.data.draft.trim());
});

test("rejects empty, missing, non-string and malformed input", async () => {
  for (const body of ["{", "{}", "null", '{"text":42}', '{"text":"  "}']) {
    assert.deepEqual(await triage(body), {
      status: 400,
      data: { status: "invalid_input" },
    });
  }
});

test("sends model failures to manual review within the timeout", async () => {
  for (const marker of ["[timeout]", "[error]", "[bad-json]", "[bad-topic]", "[empty-draft]"]) {
    const started = performance.now();
    assert.deepEqual(await triage(JSON.stringify({ text: marker })), {
      status: 200,
      data: { status: "manual_review", topic: null, draft: null },
    });
    if (marker === "[timeout]") assert.ok(performance.now() - started < 900);
  }
});

test("clears the previous draft on manual review", async () => {
  const html = await readFile(new URL("./index.html", import.meta.url), "utf8");
  const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, "Page script is present");

  const fields = {
    "#message": { value: "Доставка" },
    "#notice": { textContent: "" },
    "#topic": { textContent: "" },
    "#draft": { textContent: "" },
  };
  const button = { disabled: false };
  let submit;
  const form = {
    querySelector: () => button,
    addEventListener: (name, handler) => {
      assert.equal(name, "submit");
      submit = handler;
    },
  };
  let modelReply = { status: "ready", topic: "delivery", draft: "Прежний черновик" };
  runInNewContext(script, {
    document: { querySelector: (selector) => selector === "form" ? form : fields[selector] },
    fetch: async () => ({ ok: true, json: async () => modelReply }),
  });

  const event = { preventDefault() {} };
  await submit(event);
  assert.match(fields["#draft"].textContent, /Прежний черновик/);

  fields["#message"].value = "[error]";
  modelReply = { status: "manual_review", topic: null, draft: null };
  await submit(event);
  assert.equal(fields["#topic"].textContent, "");
  assert.equal(fields["#draft"].textContent, "");
  assert.match(fields["#notice"].textContent, /Разберите заявку вручную/);
});
