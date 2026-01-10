/**
 * @fileoverview Shell command utilities with cross-runtime compatibility.
 *
 * @description
 * Helpers to run external commands, capture output and pipe with optional filtering.
 */
import { spawn } from "./runtime";

export async function run(
  cmd: string,
  args: string[],
  options: {
    env?: Record<string, string>;
    cwd?: string;
    stdio?: "inherit" | "pipe" | "ignore";
    filter?: (line: string) => boolean;
    captureOutput?: boolean;
  } = {},
): Promise<{ stdout: string; stderr: string } | undefined> {
  const mergedEnv = {
    ...process.env,
    ...Object.fromEntries(Object.entries(options.env || {}).map(([k, v]) => [k, String(v)])),
  };

  const shouldPipe = options.stdio === "pipe" || !!options.filter || options.captureOutput;

  let stdioMode: "pipe" | "inherit" | "ignore" = options.stdio || "inherit";
  if (shouldPipe) {
    stdioMode = "pipe";
  }

  const { exited, stdout, stderr } = await spawn(cmd, args, {
    stdout: stdioMode,
    stderr: stdioMode,
    stdin: "inherit",
    cwd: options.cwd || process.cwd(),
    env: mergedEnv,
  });

  let capturedStdout = "";
  let capturedStderr = "";

  const pipes: Promise<void>[] = [];
  if (stdioMode === "pipe" && stdout && stderr) {
    const filter = options.filter || (() => true);

    if (options.captureOutput) {
      pipes.push(
        (async () => {
          capturedStdout = await new Response(stdout).text();
        })(),
      );
      pipes.push(
        (async () => {
          capturedStderr = await new Response(stderr).text();
        })(),
      );
    } else {
      pipes.push(pipeWithFilter(stdout, process.stdout, filter));
      pipes.push(pipeWithFilter(stderr, process.stderr, filter));
    }
  }

  const [exitCode] = await Promise.all([exited, ...pipes]);

  if (exitCode !== 0) {
    throw new Error(`Command '${cmd} ${args.join(" ")}' failed with code ${exitCode}`);
  }

  if (options.captureOutput) {
    return { stdout: capturedStdout, stderr: capturedStderr };
  }
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
  const result = await run(cmd, args, {
    stdio: "pipe",
    captureOutput: true,
  });
  return result?.stdout.trim() ?? "";
}
