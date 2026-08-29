/* Copyright (c) 2026 lemonhub-io; SPDX-License-Identifier: AGPL-3.0-or-later */

import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const root = process.cwd();
const ignoredDirectories = new Set([".git", "dist", "node_modules"]);
const extensions = new Set([".css", ".html", ".md", ".mjs", ".ts"]);
const requiredHeader = "Copyright (c) 2026 lemonhub-io; SPDX-License-Identifier: AGPL-3.0-or-later";

function isEligible(path, contents) {
  const file = path.split("/").at(-1) ?? "";
  const extension = file.includes(".") ? `.${file.split(".").at(-1)}` : "";
  const lines = contents.split("\n").length;
  return (extensions.has(extension) || file === "tsconfig.json") && lines > 10;
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) files.push(...(await walk(path)));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }
  return files;
}

const failures = [];
for (const path of await walk(root)) {
  const contents = await readFile(path, "utf8");
  if (!isEligible(path, contents)) continue;
  if (!contents.split("\n", 3).join("\n").includes(requiredHeader)) {
    failures.push(`${relative(root, path)}: missing copyright and SPDX header`);
  }
}

const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
if (packageJson.author !== "lemonhub-io") failures.push("package.json: author must be lemonhub-io");
if (packageJson.copyright !== "Copyright (c) 2026 lemonhub-io") {
  failures.push("package.json: missing copyright declaration");
}
if (packageJson.license !== "AGPL-3.0-or-later") {
  failures.push("package.json: license must be AGPL-3.0-or-later");
}

if (failures.length) {
  console.error("Copyright check failed:\n" + failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log("Copyright and license declarations are valid.");
