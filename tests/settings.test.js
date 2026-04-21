/**
 * @jest-environment node
 */
import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { readSettings, writeSettings } from "../lib/settings.js";

let tmpDir;
let settingsPath;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "settings-test-"));
  settingsPath = path.join(tmpDir, "settings.json");
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

describe("readSettings", () => {
  test("fichier absent renvoie les défauts sans créer le fichier", async () => {
    const result = await readSettings(settingsPath);
    expect(result).toEqual({ schemaVersion: 1, notesDir: null });
    expect(await fileExists(settingsPath)).toBe(false);
  });

  test("fichier valide avec les deux champs est renvoyé tel quel", async () => {
    await fs.writeFile(
      settingsPath,
      JSON.stringify({ schemaVersion: 1, notesDir: "/home/user/notes" }),
      "utf-8",
    );
    const result = await readSettings(settingsPath);
    expect(result).toEqual({ schemaVersion: 1, notesDir: "/home/user/notes" });
  });

  test("fichier valide sans schemaVersion voit la version injectée", async () => {
    await fs.writeFile(
      settingsPath,
      JSON.stringify({ notesDir: "/tmp/x" }),
      "utf-8",
    );
    const result = await readSettings(settingsPath);
    expect(result.schemaVersion).toBe(1);
    expect(result.notesDir).toBe("/tmp/x");
  });

  test("JSON corrompu renvoie les défauts, warn, et ne modifie pas le fichier", async () => {
    const corrupted = "{ this is : not json ]";
    await fs.writeFile(settingsPath, corrupted, "utf-8");
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const result = await readSettings(settingsPath);

    expect(result).toEqual({ schemaVersion: 1, notesDir: null });
    expect(warnSpy).toHaveBeenCalled();
    const onDisk = await fs.readFile(settingsPath, "utf-8");
    expect(onDisk).toBe(corrupted);

    warnSpy.mockRestore();
  });

  test("champ inconnu est préservé dans la sortie", async () => {
    await fs.writeFile(
      settingsPath,
      JSON.stringify({ schemaVersion: 1, notesDir: null, foo: "bar" }),
      "utf-8",
    );
    const result = await readSettings(settingsPath);
    expect(result.foo).toBe("bar");
  });
});

describe("writeSettings", () => {
  test("écriture sur fichier absent crée un fichier avec schemaVersion et patch", async () => {
    await writeSettings(settingsPath, { notesDir: "/some/dir" });
    const onDisk = JSON.parse(await fs.readFile(settingsPath, "utf-8"));
    expect(onDisk).toEqual({ schemaVersion: 1, notesDir: "/some/dir" });
  });

  test("écriture sur fichier existant merge les champs non mentionnés", async () => {
    await fs.writeFile(
      settingsPath,
      JSON.stringify({ schemaVersion: 1, notesDir: "/old", extra: "keep" }),
      "utf-8",
    );
    await writeSettings(settingsPath, { notesDir: "/new" });
    const onDisk = JSON.parse(await fs.readFile(settingsPath, "utf-8"));
    expect(onDisk.notesDir).toBe("/new");
    expect(onDisk.extra).toBe("keep");
    expect(onDisk.schemaVersion).toBe(1);
  });

  test("écriture atomique ne laisse pas de .tmp après succès", async () => {
    await writeSettings(settingsPath, { notesDir: "/a" });
    const files = await fs.readdir(tmpDir);
    expect(files.some((f) => f.endsWith(".tmp"))).toBe(false);
  });

  test("write puis read renvoie la valeur écrite avec schemaVersion 1", async () => {
    await writeSettings(settingsPath, { notesDir: "C:\\foo" });
    const result = await readSettings(settingsPath);
    expect(result.notesDir).toBe("C:\\foo");
    expect(result.schemaVersion).toBe(1);
  });

  test("patch schemaVersion 999 est ignoré : la version écrite reste 1", async () => {
    await writeSettings(settingsPath, { schemaVersion: 999, notesDir: "/x" });
    const onDisk = JSON.parse(await fs.readFile(settingsPath, "utf-8"));
    expect(onDisk.schemaVersion).toBe(1);
    expect(onDisk.notesDir).toBe("/x");
  });

  test("patch avec notesDir non string ni null lève un TypeError", async () => {
    await expect(
      writeSettings(settingsPath, { notesDir: 42 }),
    ).rejects.toThrow(TypeError);
  });

  test("filePath dans un dossier inexistant crée le dossier et écrit", async () => {
    const nested = path.join(tmpDir, "nested", "deep", "settings.json");
    await writeSettings(nested, { notesDir: "/x" });
    const onDisk = JSON.parse(await fs.readFile(nested, "utf-8"));
    expect(onDisk).toEqual({ schemaVersion: 1, notesDir: "/x" });
  });
});

describe("interaction read + write", () => {
  test("après un fichier corrompu, writeSettings écrase et readSettings relit bien", async () => {
    const corrupted = "not json at all {{{";
    await fs.writeFile(settingsPath, corrupted, "utf-8");
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const readBefore = await readSettings(settingsPath);
    expect(readBefore).toEqual({ schemaVersion: 1, notesDir: null });

    const untouched = await fs.readFile(settingsPath, "utf-8");
    expect(untouched).toBe(corrupted);

    await writeSettings(settingsPath, { notesDir: "/x" });
    const readAfter = await readSettings(settingsPath);
    expect(readAfter).toEqual({ schemaVersion: 1, notesDir: "/x" });

    warnSpy.mockRestore();
  });
});
