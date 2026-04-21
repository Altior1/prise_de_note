/**
 * @jest-environment node
 */
import { describe, test, expect, jest } from "@jest/globals";
import { resolveStorage } from "../lib/boot.js";

describe("resolveStorage", () => {
  test("settings null renvoie null et n'appelle pas createStorage", () => {
    const createStorage = jest.fn();
    expect(resolveStorage(null, { createStorage })).toBeNull();
    expect(createStorage).not.toHaveBeenCalled();
  });

  test("settings sans notesDir renvoie null", () => {
    const createStorage = jest.fn();
    expect(resolveStorage({}, { createStorage })).toBeNull();
    expect(createStorage).not.toHaveBeenCalled();
  });

  test("notesDir null renvoie null", () => {
    const createStorage = jest.fn();
    expect(
      resolveStorage({ schemaVersion: 1, notesDir: null }, { createStorage }),
    ).toBeNull();
    expect(createStorage).not.toHaveBeenCalled();
  });

  test("notesDir chaîne vide renvoie null", () => {
    const createStorage = jest.fn();
    expect(
      resolveStorage({ schemaVersion: 1, notesDir: "" }, { createStorage }),
    ).toBeNull();
    expect(createStorage).not.toHaveBeenCalled();
  });

  test("notesDir valide appelle createStorage(dir) et renvoie son résultat", () => {
    const sentinel = { marker: "storage" };
    const createStorage = jest.fn(() => sentinel);
    const result = resolveStorage(
      { schemaVersion: 1, notesDir: "/tmp/x" },
      { createStorage },
    );
    expect(createStorage).toHaveBeenCalledTimes(1);
    expect(createStorage).toHaveBeenCalledWith("/tmp/x");
    expect(result).toBe(sentinel);
  });
});
