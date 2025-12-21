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
  const _stdio = options.stdio || "inherit";
  const mergedEnv = {
    ...process.env,
    ...Object.fromEntries(Object.entries(options.env || {}).map(([k, v]) => [k, String(v)])),
  };

  // Use Bun.spawn if available, otherwise fallback to Node's child_process for Vitest compatibility
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

    if (options.filter && proc.stdout && proc.stderr) {
      // We need to consume the streams and print filtered lines
      // Pipe proc.stdout -> filter -> process.stdout
      pipeWithFilter(proc.stdout, process.stdout, options.filter);
      pipeWithFilter(proc.stderr, process.stderr, options.filter);
    }

    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      const stderr = options.stdio === "pipe" ? await new Response(proc.stderr).text() : "";
      throw new Error(
        `Command '${cmd} ${args.join(" ")}' failed with code ${exitCode}${stderr ? `: ${stderr}` : ""}`,
      );
    }
    return;
  }

  // Fallback for Vitest/Node
  return new Promise<void>((resolve, reject) => {
    (async () => {
      // ... Node implementation doesn't support filter yet for brevity, assuming Bun environment
      const { spawn } = await import("node:child_process");
      const proc = spawn(cmd, args, {
        stdio: options.stdio || "inherit",
        cwd: options.cwd || process.cwd(),
        env: mergedEnv,
      });
      // ...
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

    // Split by newlines but keep the last incomplete chunk in buffer
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (filter(line)) {
        writable.write(`${line}\n`);
      }
    }
  }
  if (buffer && filter(buffer)) {
    writable.write(buffer);
  }
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
