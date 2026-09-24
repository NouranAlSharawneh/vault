import { describe, expect, it } from "vitest";
import { resolveAssetRequest } from "@main/app/protocol/resolve-asset-request";
import { insideVault } from "@main/services/fs/paths";

const ROOT = "/vault";
const ask = (href: string, present: string[] = []): ReturnType<typeof resolveAssetRequest> =>
  resolveAssetRequest(ROOT, new URL(href), (p) => present.includes(p), insideVault);

describe("marasca://asset", () => {
  it("serves a file inside the vault with its media type", () => {
    const where = ask("marasca://asset/atlas-api/assets/diagram.png", [
      "/vault/atlas-api/assets/diagram.png",
    ]);

    expect(where).toEqual({ path: "/vault/atlas-api/assets/diagram.png", mime: "image/png" });
  });

  it("decodes the path, so a space in a filename still resolves", () => {
    const where = ask("marasca://asset/inbox/assets/my%20shot.png", [
      "/vault/inbox/assets/my shot.png",
    ]);

    expect(where).toEqual({ path: "/vault/inbox/assets/my shot.png", mime: "image/png" });
  });

  it("refuses a path that climbs out of the vault", () => {
    // Percent-encoded, so the URL parser's own normalisation leaves the `..` for us —
    // this is the shape that actually reaches the handler, and the containment check
    // is the only thing standing in front of the user's home folder.
    expect(ask("marasca://asset/%2e%2e%2f%2e%2e%2fetc%2fpasswd.png")).toEqual({ deny: 403 });
    expect(ask("marasca://asset/inbox/..%2f..%2fsecrets.png")).toEqual({ deny: 403 });
  });

  it("never sees plain `../` — the URL parser resolves it into the vault first", () => {
    // Worth pinning: it looks like an escape but arrives as `/etc/passwd.png`, an
    // ordinary in-vault path that simply is not there.
    expect(ask("marasca://asset/../../etc/passwd.png")).toEqual({ deny: 404 });
  });

  it("refuses anything in the repo's own .git folder", () => {
    // It is inside the vault and `config` has no extension, but the rule is explicit:
    // nothing under .git is ever served, whatever it is called.
    expect(ask("marasca://asset/.git/hooks/evil.svg", ["/vault/.git/hooks/evil.svg"])).toEqual({
      deny: 403,
    });
  });

  it("refuses a file type it does not know how to serve", () => {
    expect(ask("marasca://asset/inbox/notes.md", ["/vault/inbox/notes.md"])).toEqual({ deny: 403 });
    expect(ask("marasca://asset/inbox/run.sh", ["/vault/inbox/run.sh"])).toEqual({ deny: 403 });
  });

  it("ignores a request aimed at some other host", () => {
    const where = resolveAssetRequest(
      ROOT,
      new URL("marasca://elsewhere/inbox/a.png"),
      () => true,
      insideVault,
    );

    expect(where).toEqual({ deny: 404 });
  });

  it("serves nothing when no vault is open", () => {
    expect(
      resolveAssetRequest(undefined, new URL("marasca://asset/a.png"), () => true, insideVault),
    ).toEqual({ deny: 404 });
  });

  it("finds a trashed doc's image where the doc used to live", () => {
    // Trashing moves the document but deliberately leaves `assets/` behind, so the
    // reader for a trashed doc asks for a path that only exists one folder up.
    const where = ask("marasca://asset/.trash/atlas/assets/shot.png", [
      "/vault/atlas/assets/shot.png",
    ]);

    expect(where).toEqual({ path: "/vault/atlas/assets/shot.png", mime: "image/png" });
  });

  it("prefers the trashed copy when the image went into the trash too", () => {
    const where = ask("marasca://asset/.trash/atlas/assets/shot.png", [
      "/vault/.trash/atlas/assets/shot.png",
      "/vault/atlas/assets/shot.png",
    ]);

    expect(where).toEqual({ path: "/vault/.trash/atlas/assets/shot.png", mime: "image/png" });
  });

  it("is a 404, not a 403, when the path is allowed but the file is gone", () => {
    expect(ask("marasca://asset/inbox/assets/missing.png")).toEqual({ deny: 404 });
  });
});
