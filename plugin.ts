/* The MIT License (MIT)

Copyright (c) 2019 RollupJS Plugin Contributors
(https://github.com/rollup/plugins/graphs/contributors)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE. */

// @ts-nocheck
import { RollupInjectOptions as _RollupInjectOptions } from "@rollup/plugin-inject";
import {
  attachScopes,
  createFilter,
  makeLegalIdentifier,
} from "@rollup/pluginutils";
import { walk } from "estree-walker";
import MagicString from "magic-string";
import { sep } from "path";

export type RollupInjectOptions = Pick<
  _RollupInjectOptions & {
    expressions?: { [str: string]: string };
  },
  "modules" | "expressions"
>;

const escape = (str: string) => str.replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&");

const isReference = (node, parent) => {
  if (node.type === "MemberExpression") {
    return !node.computed && isReference(node.object, node);
  }

  if (node.type === "Identifier") {
    // TODO is this right?
    if (parent.type === "MemberExpression")
      return parent.computed || node === parent.object;

    // disregard the `bar` in { bar: foo }
    if (parent.type === "Property" && node !== parent.value) return false;

    // disregard the `bar` in `class Foo { bar () {...} }`
    if (parent.type === "MethodDefinition") return false;

    // disregard the `bar` in `export { foo as bar }`
    if (parent.type === "ExportSpecifier" && node !== parent.local)
      return false;

    // disregard the `bar` in `import { bar as foo }`
    if (parent.type === "ImportSpecifier" && node === parent.imported) {
      return false;
    }

    return true;
  }

  return false;
};

const flatten = (startNode) => {
  const parts = [];
  let node = startNode;

  while (node.type === "MemberExpression") {
    parts.unshift(node.property.name);
    node = node.object;
  }

  const { name } = node;
  parts.unshift(name);

  return { name, keypath: parts.join(".") };
};

export default function inject(options: RollupInjectOptions) {
  if (!options) throw new Error("Missing options");

  let { modules = {}, expressions = {} } = options;

  const modulesMap = new Map(Object.entries(modules));
  const expressionsMap = new Map(Object.entries(expressions));

  // Fix paths on Windows
  if (sep !== "/") {
    modulesMap.forEach((mod, key) => {
      modulesMap.set(
        key,
        Array.isArray(mod)
          ? [mod[0].split(sep).join("/"), mod[1]]
          : mod.split(sep).join("/")
      );
    });
  }

  const firstpass = new RegExp(
    `(?:${Array.from(modulesMap.keys())
      .concat(Array.from(expressionsMap.keys()))
      .map(escape)
      .join("|")})`,
    "g"
  );

  return {
    name: "inject",

    transform(code, id) {
      if (code.search(firstpass) === -1) return null;

      if (sep !== "/") id = id.split(sep).join("/"); // eslint-disable-line no-param-reassign

      let ast = null;
      try {
        ast = this.parse(code);
      } catch (err) {
        this.warn({
          code: "PARSE_ERROR",
          message: `rollup-plugin-inject: failed to parse ${id}. Consider restricting the plugin to particular files via options.include`,
        });
      }
      if (!ast) {
        return null;
      }

      const imports = new Set();
      ast.body.forEach((node) => {
        if (node.type === "ImportDeclaration") {
          node.specifiers.forEach((specifier) => {
            imports.add(specifier.local.name);
          });
        }
      });

      // analyse scopes
      let scope = attachScopes(ast, "scope");

      const magicString = new MagicString(code);

      const newImports = new Map();

      function handleReference(node, name, keypath) {
        let mod = modulesMap.get(keypath);
        let expr = expressionsMap.get(keypath);
        if (expr) {
          magicString.overwrite(node.start, node.end, JSON.stringify(expr), {
            storeName: true,
          });
          return;
        }

        if (mod && !imports.has(name) && !scope.contains(name)) {
          if (typeof mod === "string") mod = [mod, "default"];

          // prevent module from importing itself
          if (mod[0] === id) return false;

          const hash = `${keypath}:${mod[0]}:${mod[1]}`;

          const importLocalName =
            name === keypath ? name : makeLegalIdentifier(`$inject_${keypath}`);

          if (!newImports.has(hash)) {
            // escape apostrophes and backslashes for use in single-quoted
            // string literal
            const modName = mod[0].replace(/[''\\]/g, "\\$&");
            if (mod[1] === "*") {
              newImports.set(
                hash,
                `import * as ${importLocalName} from '${modName}';`
              );
            } else {
              newImports.set(
                hash,
                `import { ${mod[1]} as ${importLocalName} } from '${modName}';`
              );
            }
          }

          if (name !== keypath) {
            magicString.overwrite(node.start, node.end, importLocalName, {
              storeName: true,
            });
          }

          return true;
        }

        return false;
      }

      walk(ast, {
        enter(node, parent) {
          if (node.scope) {
            scope = node.scope; // eslint-disable-line prefer-destructuring
          }

          // special case – shorthand properties. because node.key ===
          // node.value, we can't differentiate once we've descended into the
          // node
          if (node.type === "Property" && node.shorthand) {
            const { name } = node.key;
            handleReference(node, name, name);
            this.skip();
            return;
          }

          if (isReference(node, parent)) {
            const { name, keypath } = flatten(node);
            const handled = handleReference(node, name, keypath);
            if (handled) {
              this.skip();
            }
          }
        },
        leave(node) {
          if (node.scope) {
            scope = scope.parent;
          }
        },
      });

      if (newImports.size === 0) {
        return {
          code: magicString.toString(),
        };
      }
      const importBlock = Array.from(newImports.values()).join("\n\n");

      magicString.prepend(`${importBlock}\n\n`);

      return {
        code: magicString.toString(),
      };
    },
  };
}
