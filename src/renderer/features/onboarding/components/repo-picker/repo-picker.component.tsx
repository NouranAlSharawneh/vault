import { ArrowRight, FolderOpen, Plus, Search } from "lucide-react";
import { Button, Card, ListRow, Option, SectionLabel, Spinner } from "@/components/ui";
import { REPO_LIST_LIMIT } from "@/constants";
import { cx } from "@/helpers";
import { fire } from "@/lib/api";
import { useRepoPicker } from "./hooks/use-repo-picker.hook";
import type { RepoPickerProps } from "./repo-picker.types";

export function RepoPicker({ onDone, onBack }: RepoPickerProps) {
  const p = useRepoPicker(onDone);

  return (
    <Card className="p-7">
      <h2 className="font-serif text-2xl font-medium text-ink">Where should the vault live?</h2>
      <p className="mt-1 text-sm text-ink-3">
        One repo holds everything. You can move it later — it's just files.
      </p>

      {p.signedIn ? (
        <div role="radiogroup" aria-label="Vault repository">
          <Option
            selected={p.choice === "new"}
            onClick={() => p.setChoice("new")}
            badge={p.tokenUser ? undefined : "recommended"}
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
            {p.listError && (
              <div className="flex items-center gap-2 p-3 text-xs">
                <span className="text-cherry">
                  Couldn’t load your repos ({p.listError}). You can still create a new one above.
                </span>
                <Button variant="link" className="ml-auto shrink-0" onClick={p.retryList}>
                  Try again
                </Button>
              </div>
            )}
            {p.repos === null && !p.listError && (
              <div className="flex items-center gap-2 p-3 text-xs text-ink-4">
                <Spinner /> Loading repos…
              </div>
            )}
            {p.repos !== null && p.filtered.length === 0 && (
              <div className="p-3 text-xs text-ink-4">No repos match.</div>
            )}
            {p.filtered.map((r) => (
              <ListRow
                key={r.fullName}
                kind="option"
                role="radio"
                aria-checked={p.choice === r.fullName}
                selected={p.choice === r.fullName}
                onClick={() => p.setChoice(r.fullName)}
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
              </ListRow>
            ))}
          </div>
          {p.matchCount > REPO_LIST_LIMIT && (
            <div className="mt-1.5 text-xs text-ink-4">
              Showing {REPO_LIST_LIMIT} of {p.matchCount.toLocaleString()} — type to filter.
            </div>
          )}
        </div>
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
        <Button variant="link" className="ml-auto shrink-0" onClick={() => fire(p.chooseFolder())}>
          Change
        </Button>
      </div>
      {p.submitError && <div className="mt-3 text-xs text-cherry">{p.submitError}</div>}
      <div className="mt-5 flex items-center justify-between">
        <Button variant="subtle" onClick={onBack}>
          Back
        </Button>
        <Button
          variant="primary"
          loading={p.busy}
          disabled={!p.canSubmit}
          onClick={() => fire(p.submit())}
        >
          Continue <ArrowRight size={13} />
        </Button>
      </div>
    </Card>
  );
}
