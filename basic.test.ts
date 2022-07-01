import { readFile } from "fs/promises";
import { expect, test } from "vitest";

import { polyfillPath, polyfillContent } from "./index";

test("polyfillPath", async () => {
  expect(await readFile(await polyfillPath("fs"), "utf8")).toMatchSnapshot();
  expect(
    await readFile(await polyfillPath("node:fs"), "utf8")
  ).toMatchSnapshot();
  expect(await readFile(await polyfillPath("http"), "utf8")).toMatchSnapshot();
  expect(polyfillPath("wrong")).rejects.toThrowError()
});

test("polyfillContent", async () => {
  expect(await polyfillContent('fs')).to.not.contain('import')
  expect(await polyfillContent('fs')).to.contain('export')
  expect(await polyfillContent('fs')).toMatchSnapshot()
});

test("polyfillContent", async () => {


})
