import { spawn } from "node:child_process";

export async function run(
  cmd: string,
  args: string[],
  options: {
    env?: Record<string, string>;
    cwd?: string;
    stdio?: "inherit" | "pipe" | "ignore";
  } = {},
): Promise<void> {
  const mergedEnv = { ...process.env, ...options.env };

  return new Promise<void>((resolve, reject) => {
    const proc = spawn(cmd, args, {
      stdio: options.stdio || "inherit",
      cwd: options.cwd || process.cwd(),
      env: mergedEnv,
    });

    proc.on("close", (code: number) => {
      if (code === 0) resolve();
      else reject(new Error(`Command '${cmd} ${args.join(" ")}' failed with code ${code}`));
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}

export async function execCapture(cmd: string, args: string[]): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const proc = spawn(cmd, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`Command failed: ${stderr || stdout}`));
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}
