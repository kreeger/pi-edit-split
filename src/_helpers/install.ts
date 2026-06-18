#!/usr/bin/env tsx
import { copyFileSync, mkdirSync, readdirSync, statSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const extName = "pi-edit-split";
const srcDir = resolve(__dirname, "..");
const targetDir = join(homedir(), ".pi", "agent", "extensions", extName);

function copyRecursive(src: string, dest: string) {
  const isDir = statSync(src).isDirectory();
  if (isDir) {
    mkdirSync(dest, { recursive: true });
    const entries = readdirSync(src);
    for (const entry of entries) {
      if (entry.endsWith(".test.ts")) continue;
      copyRecursive(resolve(src, entry), join(dest, entry));
    }
  } else {
    copyFileSync(src, dest);
  }
}

mkdirSync(targetDir, { recursive: true });

const files = readdirSync(srcDir);
for (const file of files) {
  if (file === "_helpers" || file.endsWith(".test.ts")) continue;
  copyRecursive(resolve(srcDir, file), join(targetDir, file));
}

console.log(`Installed pi-edit-split to ${targetDir}`);
