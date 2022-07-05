import { build } from "esbuild";
import { readFile, writeFile, unlink } from "fs/promises";
import global from "global";
import { expect, test } from "vitest";

import {
  polyfillPath,
  polyfillContent,
  inject,
  polyfillGlobals,
} from "./index";

test("polyfillPath", async () => {
  expect(await readFile(await polyfillPath("fs"), "utf8")).toMatchSnapshot();
  expect(
    await readFile(await polyfillPath("node:fs"), "utf8")
  ).toMatchSnapshot();
  expect(await readFile(await polyfillPath("http"), "utf8")).toMatchSnapshot();
  expect(polyfillPath("wrong")).rejects.toThrowError();
});

test("polyfillContent", async () => {
  expect(await polyfillContent("fs")).to.not.contain("import");
  expect(await polyfillContent("fs")).to.contain("export");
  expect(await polyfillContent("fs")).toMatchSnapshot();
});

test("inject", async () => {
  expect(
    await inject("console.log(__filename);", {
      expressions: { __filename: "/" },
    })
  ).toMatchSnapshot();
});

test("polyfillGlobals", async () => {
  // write tests
  const content = await polyfillGlobals(`
    // console.log(__filename);
    console.log(global)
    console.log(process);
    console.log(Buffer);
    console.log(setImmediate);
    console.log(clearImmediate);
`);

  const { id, unsubscribe } = await createFile(content);

  await build({
    write: true,
    format: "esm",
    bundle: true,
    outfile: id,
    entryPoints: [id],
    allowOverwrite: true,
  });
  // @ts-ignore ignore navigator polyfill for now!
  globalThis.navigator = {};

  await expect(import(id)).resolves.not.toThrow();
  await unsubscribe();
  console.log(await polyfillPath("fs"))
});

let _id = 0;
async function createFile(
  content: string
): Promise<{ id: string; unsubscribe: () => Promise<void> }> {
  const id = "." + String(_id++) + ".js";
  await writeFile(id, content);

  return { id, unsubscribe: () => unlink(id) };
}

