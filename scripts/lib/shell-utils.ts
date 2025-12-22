export async function run(
  cmd: string,
  args: string[],
  options: {
    env?: Record<string, string>;
    cwd?: string;
    stdio?: "inherit" | "pipe" | "ignore";
    filter?: (line: string) => boolean;
  } = {},
): Promise<void> {
  const mergedEnv = {
    ...process.env,
    ...Object.fromEntries(Object.entries(options.env || {}).map(([k, v]) => [k, String(v)])),
  };

  if (typeof Bun !== "undefined") {
    const shouldPipe = options.stdio === "pipe" || !!options.filter;
    const stdioMode = shouldPipe ? "pipe" : options.stdio || "inherit";

    const proc = Bun.spawn([cmd, ...args], {
      stdout: stdioMode,
      stderr: stdioMode,
      stdin: "inherit",
      cwd: options.cwd || process.cwd(),
      env: mergedEnv,
    });

    const pipes: Promise<void>[] = [];
    if (stdioMode === "pipe" && proc.stdout && proc.stderr) {
      // Use identity filter if none provided
      const filter = options.filter || (() => true);
      pipes.push(pipeWithFilter(proc.stdout, process.stdout, filter));
      pipes.push(pipeWithFilter(proc.stderr, process.stderr, filter));
    }

    const [exitCode] = await Promise.all([proc.exited, ...pipes]);

    if (exitCode !== 0) {
      // If we piped, we might want to capture some stderr for the error message
      // but pipeWithFilter already relayed it to parent.
      throw new Error(`Command '${cmd} ${args.join(" ")}' failed with code ${exitCode}`);
    }
    return;
  }

  // Fallback for Vitest/Node
  return new Promise<void>((resolve, reject) => {
    (async () => {
      const { spawn } = await import("node:child_process");
      const proc = spawn(cmd, args, {
        stdio: options.stdio || "inherit",
        cwd: options.cwd || process.cwd(),
        env: mergedEnv,
      });

      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Command '${cmd} ${args.join(" ")}' failed with code ${code}`));
      });

      proc.on("error", reject);
    })().catch(reject);
  });
}

async function pipeWithFilter(
  readable: ReadableStream,
  writable: NodeJS.WriteStream,
  filter: (line: string) => boolean,
) {
  const reader = readable.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Flush both newline and carriage-return delimited chunks so TTY renderers
    // (e.g., cli-progress) are not buffered until completion.
    while (true) {
      const nextBreak = buffer.search(/[\r\n]/);
      if (nextBreak === -1) break;

      const char = buffer[nextBreak];
      const isCRLF = char === "\r" && buffer[nextBreak + 1] === "\n";
      const chunk = buffer.slice(0, nextBreak);
      buffer = buffer.slice(nextBreak + (isCRLF ? 2 : 1));

      if (char === "\n" || isCRLF) {
        if (filter(chunk)) writable.write(`${chunk}\n`);
      } else {
        // Preserve carriage-return updates for progress bars
        if (chunk.length === 0) {
          writable.write("\r");
        } else if (filter(chunk)) {
          writable.write(`${chunk}\r`);
        }
      }
    }
  }
  if (buffer && filter(buffer)) writable.write(buffer);
}

export async function execCapture(cmd: string, args: string[]): Promise<string> {
  if (typeof Bun !== "undefined") {
    const proc = Bun.spawn([cmd, ...args], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      const error = await new Response(proc.stderr).text();
      throw new Error(`Command failed: ${error || output}`);
    }

    return output.trim();
  }

  // Fallback for Vitest/Node
  return new Promise<string>((resolve, reject) => {
    (async () => {
      const { spawn } = await import("node:child_process");
      const proc = spawn(cmd, args, {
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      proc.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        if (code === 0) resolve(stdout.trim());
        else reject(new Error(`Command failed: ${stderr || stdout}`));
      });

      proc.on("error", reject);
    })().catch(reject);
  });
}
