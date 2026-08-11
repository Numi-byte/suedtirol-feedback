import { spawn } from "node:child_process";

const applications = ["client", "protected"];
const children = applications.map((application) =>
  spawn("npm", ["run", "dev", "--prefix", application], {
    stdio: "inherit",
    shell: process.platform === "win32",
  }),
);

function stopChildren(signal) {
  children.forEach((child) => child.kill(signal));
}

process.on("SIGINT", () => stopChildren("SIGINT"));
process.on("SIGTERM", () => stopChildren("SIGTERM"));

children.forEach((child) => {
  child.on("exit", (code) => {
    if (code && process.exitCode === undefined) process.exitCode = code;
  });
});
