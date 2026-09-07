import { context } from "esbuild";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";

const port = Number.parseInt(process.env.PORT || "5500", 10);
const build = await context({
  entryPoints: ["src/index.js"],
  bundle: true,
  format: "esm",
  sourcemap: "inline",
  write: false,
});

async function getBundle() {
  const result = await build.rebuild();
  return result.outputFiles[0].text;
}

createServer(async (request, response) => {
  const path = new URL(request.url || "/", `http://${request.headers.host}`).pathname;
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Cache-Control", "no-store");

  if (request.method === "OPTIONS") {
    response.writeHead(204, { "Access-Control-Allow-Methods": "GET, OPTIONS" });
    response.end();
    return;
  }

  if (["/", "/bundle.js", "/dist/bundle.js"].includes(path)) {
    try {
      response.writeHead(200, { "Content-Type": "application/javascript" });
      response.end(await getBundle());
    } catch (error) {
      console.error("[dev] The build failed.", error);
      response.writeHead(500, { "Content-Type": "application/javascript" });
      response.end(`console.error(${JSON.stringify("[site] The local build failed.")});`);
    }
    return;
  }

  if (path === "/loader.js") {
    try {
      response.writeHead(200, { "Content-Type": "application/javascript" });
      response.end(await readFile(new URL("./loader.js", import.meta.url), "utf8"));
    } catch (error) {
      console.error("[dev] The loader read failed.", error);
      response.writeHead(500);
      response.end();
    }
    return;
  }

  response.writeHead(404);
  response.end("Not found");
}).listen(port, () => {
  console.log(`The local bundle is at http://localhost:${port}/bundle.js`);
});
