import { ArrowRight, FolderOpen, Plus, Search } from "lucide-react";
import { Button, Card, Option, SectionLabel, Spinner } from "@/components/ui";
import { cx } from "@/helpers";
import { useRepoPicker } from "./hooks/use-repo-picker.hook";
import type { RepoPickerProps } from "./repo-picker.types";

export function RepoPicker({ onDone }: RepoPickerProps) {
  const p = useRepoPicker(onDone);

  return (
    <Card className="p-7">
      <h2 className="font-serif text-2xl font-medium text-ink">Where should the vault live?</h2>
      <p className="mt-1 text-sm text-ink-3">
        One repo holds everything. You can move it later — it's just files.
      </p>

      {p.signedIn ? (
        <>
          <Option
            selected={p.choice === "new"}
            onClick={() => p.setChoice("new")}
            badge="recommended"
          >
            <div className="flex items-center gap-2">
              <Plus size={13} className="text-ink-3" />
              <span className="font-medium">Create a new private repo</span>
            </div>
            {p.choice === "new" && (
              <div className="mt-2 flex items-center gap-1 font-mono text-xs">
                <span className="text-ink-4">{p.login}/</span>
                <input
                  className="input input-sm w-44 font-mono"
                  value={p.newName}
                  onChange={(e) => p.setNewName(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
            {p.nameError && <div className="mt-1 text-xs text-cherry">{p.nameError}</div>}
          </Option>
          <SectionLabel className="mt-5">Or use one you have</SectionLabel>
          <div className="relative mt-2">
            <Search size={12} className="absolute top-2 left-2.5 text-ink-4" />
            <input
              className="input input-sm pl-7"
              placeholder="Filter your repos…"
              value={p.filter}
              onChange={(e) => p.setFilter(e.target.value)}
            />
          </div>
          <div className="mt-2 max-h-48 divide-y divide-line overflow-y-auto rounded-md border border-line">
            {p.repos === null && !p.error && (
              <div className="flex items-center gap-2 p-3 text-xs text-ink-4">
                <Spinner /> Loading repos…
              </div>
            )}
            {p.repos !== null && p.filtered.length === 0 && (
              <div className="p-3 text-xs text-ink-4">No repos match.</div>
            )}
            {p.filtered.map((r) => (
              <button
                key={r.fullName}
                onClick={() => p.setChoice(r.fullName)}
                className={cx(
                  "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-paper-2",
                  p.choice === r.fullName && "bg-cherry-tint",
                )}
              >
                <span
                  className={cx(
                    "h-3 w-3 rounded-full border",
                    p.choice === r.fullName
                      ? "border-cherry bg-cherry ring-2 ring-paper ring-inset"
                      : "border-line-2",
                  )}
                />
                <span className="truncate font-mono">{r.fullName}</span>
                <span className="ml-auto shrink-0 text-xs text-ink-4">
                  {r.private ? "private" : "public"}
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-md border border-line bg-paper-2 p-3 text-sm text-ink-2">
          Not signed in — the vault will be a local git repository. You can connect GitHub any time
          from Settings.
        </div>
      )}

      <div className="mt-5 flex items-center gap-2 text-xs text-ink-3">
        <FolderOpen size={12} />
        <span>clones to</span>
        <span className="truncate font-mono text-ink-2">{p.localPath}</span>
        <button
          className="ml-auto shrink-0 text-cherry hover:underline"
          onClick={() => void p.chooseFolder()}
        >
          Change
        </button>
      </div>
      {p.error && <div className="mt-3 text-xs text-cherry">{p.error}</div>}
      <div className="mt-5 flex justify-end">
        <Button
          variant="primary"
          loading={p.busy}
          disabled={!p.canSubmit}
          onClick={() => void p.submit()}
        >
          Continue <ArrowRight size={13} />
        </Button>
      </div>
    </Card>
  );
}
