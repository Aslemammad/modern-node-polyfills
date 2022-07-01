import { resolve, join } from "node:path";
import { builtinModules } from "node:module";
import { resolve as resolveExports } from "resolve.exports";
import { loadPackageJSON, resolveModule } from "local-pkg";
import { createRequire } from 'module'
import injectPlugin, { RollupInjectOptions } from "@rollup/plugin-inject";
import { build } from "esbuild";

const require = createRequire(import.meta.url)

async function polyfillPath(module: string) {
  if (module.startsWith("node:")) {
    module = module.replace("node:", "");
  }

  if (!builtinModules.includes(module))
    throw new Error(`Node.js does not have ${module} in its builtin modules`);

  const jspmPath = resolve(
    require.resolve("@jspm/core/nodelibs/fs"),
    "../../.."
  );
  const jspmPackageJson = await loadPackageJSON(jspmPath);
  const exportPath = resolveExports(jspmPackageJson, "./nodelibs/fs", {
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
  ).outputFiles[0].text;

  return content;
}
// console.log(import.meta.url);
function inject(content: string, options: RollupInjectOptions) {
  const { transform } = injectPlugin(
    options ?? {
      modules: {
        process: "process",
        Buffer: ["buffer", "Buffer"],
        global: './global',
        __filename: '/',
        __dirname: '/',
      },
    }
  );
}

export { polyfillPath, polyfillContent };
