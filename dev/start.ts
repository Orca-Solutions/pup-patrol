/**
 * `npm run dev`: the local creek and Vite together. Stopping either stops both.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const children: ChildProcess[] = [
  spawn(process.execPath, [join(root, "dev/creek.ts")], { cwd: root, stdio: "inherit" }),
  spawn(process.execPath, [join(root, "node_modules/vite/bin/vite.js")], { cwd: root, stdio: "inherit" })
];

let stopping = false;
function stop(code: number): void {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.exitCode === null) child.kill("SIGTERM");
  process.exitCode = code;
}
for (const child of children) child.on("exit", code => stop(code ?? 0));
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
