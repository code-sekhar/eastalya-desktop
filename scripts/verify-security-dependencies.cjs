const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createRequire } = require("node:module");
const { pathToFileURL } = require("node:url");

async function verify() {
  let count = 0;
  const babel = await import("@babel/core");
  const result = babel.transformSync("const answer = 42;", {
    babelrc: false,
    configFile: false,
  });
  assert.match(result.code, /answer/);
  count++;
  const css = require("postcss")
    .parse(".eastalya { color: #6d28d9; }")
    .toString();
  assert.match(css, /#6d28d9/);
  count++;
  const serialize = createRequire(require.resolve("copy-webpack-plugin"))(
    "serialize-javascript",
  );
  const serialized = serialize({
    text: "</script>",
    pattern: /a/g,
    date: new Date(0),
  });
  assert.ok(!serialized.includes("</script>"));
  count++;
  // Angular 22 no longer depends on SockJS or pacote. Check the retained
  // query-parser security pin instead of testing packages outside the graph.
  const qs = require("qs");
  assert.deepEqual(qs.parse("interest=cosmos"), { interest: "cosmos" });
  assert.equal(qs.parse("__proto__[polluted]=true").polluted, undefined);
  count++;
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "eastalya-toolchain-"),
  );
  let pool;
  let server;
  try {
    const worker = path.join(directory, "worker.cjs");
    await fs.writeFile(worker, "module.exports = value => value * 2;\n");
    const Piscina = require("piscina");
    pool = new Piscina({ filename: worker, minThreads: 1, maxThreads: 1 });
    assert.equal(await pool.run(21), 42);
    count++;
    await fs.writeFile(
      path.join(directory, "index.html"),
      "<!DOCTYPE html><title>Eastalya toolchain check</title>",
    );
    const viteRequire = createRequire(require.resolve("@angular/build"));
    const { createServer } = await import(
      pathToFileURL(viteRequire.resolve("vite")).href
    );
    server = await createServer({
      root: directory,
      configFile: false,
      logLevel: "silent",
      server: { host: "127.0.0.1", port: 0 },
    });
    await server.listen();
    const address = server.httpServer.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Eastalya toolchain check/);
    count++;
  } finally {
    if (server) await server.close();
    if (pool) await pool.destroy();
    await fs.rm(directory, { recursive: true });
  }
  assert.equal(require("shell-quote").quote(["safe value"]), "'safe value'");
  count++;
  console.log(
    `Angular security dependency compatibility checks: ${count} passed`,
  );
}
verify().catch((error) => {
  console.error("Angular security dependency compatibility check failed:", error);
  process.exitCode = 1;
});
