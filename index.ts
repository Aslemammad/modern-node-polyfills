import { resolve, join } from "node:path";
import { builtinModules } from "node:module";
import { resolve as resolveExports } from "resolve.exports";
import { loadPackageJSON, resolveModule } from "local-pkg";
import { createRequire } from "module";
import createInjectPlugin, { RollupInjectOptions } from "./plugin";
import { parse as _parse } from "acorn";
import { build } from "esbuild";

const require = createRequire(import.meta.url);

async function polyfillPath(module: string) {
  if (module.startsWith("node:")) {
    module = module.replace("node:", "");
  }

  if (!builtinModules.includes(module))
    throw new Error(`Node.js does not have ${module} in its builtin modules`);

  const jspmPath = resolve(
    require.resolve(`@jspm/core/nodelibs/${module}`),
    "../../.."
  );
  const jspmPackageJson = await loadPackageJSON(jspmPath);
  const exportPath = resolveExports(jspmPackageJson, `./nodelibs/${module}`, {
    browser: true,
  });

  const exportFullPath = resolveModule(join(jspmPath, exportPath || ""));

  if (!exportPath || !exportFullPath) {
    throw new Error(
      "resolving failed, please try creating an issue in github.com/aslemammad/modern-node-polyfills"
    );
  }
  return exportFullPath;
}

async function polyfillContent(module: string) {
  const exportFullPath = await polyfillPath(module);

  const content = (
    await build({
      write: false,
      format: "esm",
      bundle: true,
      entryPoints: [exportFullPath],
    })
  ).outputFiles[0]!.text;

  return content;
}

type Globals = { __filename?: string; __dirname?: string };

async function inject(
  content: string,
  options: RollupInjectOptions
): Promise<string> {
  const injectPlugin = createInjectPlugin(options);

  const parse: typeof _parse = (input, opts) =>
    _parse(input, { ...opts, ecmaVersion: "latest" });

  const result = injectPlugin.transform!.call(
    { warn: console.warn, parse } as any,
    content,
    ''
  );
  return result?.code || content;
}

async function polyfillGlobals(
  content: string,
  { __filename = "/", __dirname = "/" }: Globals = {}
) {
  return inject(content, {
    expressions: {
      __filename,
      __dirname,
    },
    modules: {
      process: await polyfillPath("process"),
      Buffer: [await polyfillPath("buffer"), "Buffer"],
      global: "modern-node-polyfills/global",
      setImmediate: [await polyfillPath("timers"), "setImmediate"],
      clearImmediate: [await polyfillPath("timers"), "clearImmediate"]
    },
  });
}

export { polyfillPath, polyfillContent, inject, polyfillGlobals };
