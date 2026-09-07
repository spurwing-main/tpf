import { execFileSync } from "node:child_process";

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function getRepository(remote) {
  const match = remote.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (!match) throw new Error("The origin must be a GitHub repository.");
  return { owner: match[1], repository: match[2] };
}

const remote = git("remote", "get-url", "origin");
const { owner, repository } = getRepository(remote);
const ref = process.argv[2] || git("rev-parse", "HEAD");
const dirty = git("status", "--porcelain");
const tag = `<script src="https://cdn.jsdelivr.net/gh/${owner}/${repository}@${ref}/loader.js"></script>`;

console.log(`\n${tag}\n`);
if (dirty) console.warn("The work tree has changes. Commit and push the files before release.\n");
