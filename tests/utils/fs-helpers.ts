import fs from "node:fs";
import path from "node:path";

export async function listTree(root: string): Promise<string[]> {
  const out: string[] = [];
  function walk(dir: string) {
    for (const e of fs.readdirSync(dir)) {
      const abs = path.join(dir, e);
      const st = fs.statSync(abs);
      if (st.isDirectory()) walk(abs);
      else out.push(abs);
    }
  }
  if (fs.existsSync(root)) {
    walk(root);
  }
  out.sort((a, b) => a.localeCompare(b));
  return out.map((p) => p.replaceAll(path.sep, "/"));
}

export function ensureEmptyDir(dir: string) {
  if (fs.existsSync(dir)) {
    for (const e of fs.readdirSync(dir)) {
      const abs = path.join(dir, e);
      const st = fs.statSync(abs);
      if (st.isDirectory()) {
        removeDir(abs);
      } else {
        fs.unlinkSync(abs);
      }
    }
  } else {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function removeDir(dir: string) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir)) {
    const abs = path.join(dir, e);
    const st = fs.statSync(abs);
    if (st.isDirectory()) removeDir(abs);
    else fs.unlinkSync(abs);
  }
  fs.rmdirSync(dir);
}
