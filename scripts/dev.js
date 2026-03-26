import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm.cmd" : "npm";

function prefixLines(stream, label, color) {
  let buffer = "";

  stream.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line) continue;
      process.stdout.write(`${color}[${label}]\x1b[0m ${line}\n`);
    }
  });

  stream.on("end", () => {
    if (buffer) {
      process.stdout.write(`${color}[${label}]\x1b[0m ${buffer}\n`);
    }
  });
}

function startProcess(label, color, args, cwd = process.cwd()) {
  const child = spawn(npmCommand, args, {
    cwd,
    stdio: ["inherit", "pipe", "pipe"],
  });

  prefixLines(child.stdout, label, color);
  prefixLines(child.stderr, label, color);

  child.on("error", (error) => {
    process.stderr.write(`${color}[${label}]\x1b[0m failed to start: ${error.message}\n`);
  });

  return child;
}

const children = [
  startProcess("web", "\x1b[36m", ["run", "dev:web"]),
  startProcess("api", "\x1b[33m", ["run", "dev:api"]),
];

let shuttingDown = false;

function shutdown(signal = "SIGTERM") {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    shutdown(signal);
  });
}

for (const child of children) {
  child.on("exit", (code, signal) => {
    if (!shuttingDown) {
      shutdown();
      const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`;
      process.stderr.write(`dev runner stopped after child exit: ${reason}\n`);
      process.exit(code ?? 0);
    }
  });
}
