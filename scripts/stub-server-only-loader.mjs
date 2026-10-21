import { register } from "node:module";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const stub = join(tmpdir(), "server-only-empty.mjs");
writeFileSync(stub, "export {};\n");
const stubUrl = JSON.stringify(pathToFileURL(stub).href);

register(
  "data:text/javascript," +
    encodeURIComponent(`
  export async function resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { shortCircuit: true, url: ${stubUrl} };
    }
    return nextResolve(specifier, context);
  }
`),
  pathToFileURL("./"),
);
