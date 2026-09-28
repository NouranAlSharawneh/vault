import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { VAULT_DIR } from "@shared/constants";
import { splitFrontmatter } from "@shared/frontmatter";
import { unslug } from "@shared/helpers";
import type { Frontmatter, SavedView, Template } from "@shared/types";
import type { GitService } from "../git/git.service";

/**
 * Saved searches and note templates: the two things the user keeps in `.vault/` rather
 * than in a document. Both are committed like anything else, so they sync between
 * machines, and both are read defensively — a hand-edited file must never stop the app
 * from opening.
 */
export class ViewsStore {
  constructor(
    private readonly root: string,
    private readonly git: GitService,
    private readonly onCommitted: () => void,
  ) {}

  private path(): string {
    return join(this.root, VAULT_DIR, "views.yml");
  }

  async list(): Promise<SavedView[]> {
    try {
      return await this.read();
    } catch {
      return [];
    }
  }

  /**
   * The saved views, or a throw when the file is there but unreadable. Writes go through
   * this: reading a hand-broken file as "no views" and then writing one view back threw
   * every other view away.
   */
  private async read(): Promise<SavedView[]> {
    let text: string;
    try {
      text = await fs.readFile(this.path(), "utf8");
    } catch {
      return [];
    }
    let data: { views?: SavedView[] } | SavedView[] | null;
    try {
      data = parseYaml(text) as typeof data;
    } catch {
      throw new Error(`${VAULT_DIR}/views.yml can’t be read — fix or delete it first`);
    }
    const arr = Array.isArray(data) ? data : (data?.views ?? []);

    return arr.filter((v) => v && typeof v.name === "string" && typeof v.query === "string");
  }

  async save(view: SavedView): Promise<SavedView[]> {
    const views = (await this.read()).filter((v) => v.name !== view.name);
    views.push(view);
    await this.write(views, `view: ${view.name}`);

    return views;
  }

  async remove(name: string): Promise<SavedView[]> {
    const views = (await this.read()).filter((v) => v.name !== name);
    await this.write(views, `remove view: ${name}`);

    return views;
  }

  private async write(views: SavedView[], message: string): Promise<void> {
    await fs.mkdir(dirname(this.path()), { recursive: true });
    await fs.writeFile(this.path(), stringifyYaml({ views }));
    await this.git.commitPaths([`${VAULT_DIR}/views.yml`], message);
    this.onCommitted();
  }

  async templates(): Promise<Template[]> {
    const dir = join(this.root, VAULT_DIR, "templates");
    try {
      const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".md"));
      const out: Template[] = [];
      for (const f of files) {
        const { yaml, body } = splitFrontmatter(await fs.readFile(join(dir, f), "utf8"));
        let frontmatter: Partial<Frontmatter> = {};
        try {
          const parsed = yaml ? (parseYaml(yaml) as Record<string, unknown>) : {};
          if (parsed && typeof parsed === "object") frontmatter = parsed as Partial<Frontmatter>;
        } catch {
          /* a template with broken yaml is still usable as a body */
        }
        out.push({ name: unslug(f.replace(/\.md$/, "")), frontmatter, body });
      }

      return out;
    } catch {
      return [];
    }
  }
}
