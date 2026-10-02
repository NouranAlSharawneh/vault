import { ArrowRight, FolderOpen, Laptop, Plus, Search } from "lucide-react";
import { useId } from "react";
import { GitNotice } from "@/components/git-notice/git-notice.component";
import { Button, Card, ListRow, Option, PathText, SectionLabel, Spinner } from "@/components/ui";
import { REPO_LIST_LIMIT } from "@/constants";
import { cx } from "@/helpers";
import { fire } from "@/lib/api";
import { StepFooter } from "../step-footer/step-footer.component";
import { useRepoPicker } from "./hooks/use-repo-picker.hook";
import type { RepoPickerProps } from "./repo-picker.types";

export function RepoPicker({ onDone, onBack, preferLocal }: RepoPickerProps) {
  const p = useRepoPicker(onDone, preferLocal);
  const nameErrorId = useId();

  return (
    <Card className="p-7">
      <h2 className="font-serif text-2xl font-medium text-ink">Where should the vault live?</h2>
      <p className="mt-1.5 text-sm text-ink-3">
        One repo holds everything. You can move it later — it's just files.
      </p>

      {p.signedIn ? (
        // The group spaces its options; an Option carries no margin of its own.
        <div role="radiogroup" aria-label="Vault repository" className="mt-6 space-y-2">
          <Option
            selected={p.choice === "new"}
            onClick={() => p.setChoice("new")}
            badge={p.tokenUser ? undefined : "recommended"}
            detail={
              p.choice === "new" && (
                <>
                  <div className="flex items-center gap-1 font-mono text-xs">
                    <span className="text-ink-4">{p.login}/</span>
                    <input
                      className="input input-sm w-44 font-mono"
                      aria-label="New repository name"
                      aria-invalid={!!p.nameError}
                      aria-describedby={p.nameError ? nameErrorId : undefined}
                      value={p.newName}
                      onChange={(e) => p.setNewName(e.target.value)}
                    />
                  </div>
                  {p.nameError && (
                    <div
                      id={nameErrorId}
                      className="mt-1 flex items-center gap-2 text-xs text-cherry"
                      role="alert"
                    >
                      {p.nameError}
                      {p.existing && (
                        <Button variant="link" onClick={() => p.setChoice(p.existing!.fullName)}>
                          Use it
                        </Button>
                      )}
                    </div>
                  )}
                </>
              )
            }
          >
            <div className="flex items-center gap-2">
              <Plus size={14} className="text-ink-3" />
              <span className="font-medium">Create a new private repo</span>
            </div>
          </Option>
          <Option selected={p.choice === "local"} onClick={() => p.setChoice("local")}>
            <div className="flex items-center gap-2">
              <Laptop size={14} className="text-ink-3" />
              <span className="font-medium">Keep it on this Mac for now</span>
            </div>
            <div className="mt-1 text-xs text-ink-3">
              A local git repo. Connect GitHub from Settings whenever you like.
            </div>
          </Option>
          <SectionLabel className="pt-4">Or use one you have</SectionLabel>
          <div className="relative">
            <Search size={12} className="absolute top-2 left-2.5 text-ink-4" />
            <input
              className="input input-sm pl-7"
              aria-label="Filter your repositories"
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
              <div className="flex items-center gap-2 p-3 text-xs text-ink-4">
                {/* An empty account, or a token that sees nothing, is not a filter miss. */}
                {p.filter.trim()
                  ? "No repos match."
                  : p.tokenUser
                    ? "This token can’t push to any repo. Check its repository access on GitHub."
                    : "No repos you can push to yet."}
                <Button variant="link" className="ml-auto shrink-0" onClick={p.retryList}>
                  Refresh
                </Button>
              </div>
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
                    "h-3 w-3 shrink-0 rounded-full border",
                    p.choice === r.fullName
                      ? "border-cherry bg-cherry ring-2 ring-paper ring-inset"
                      : // A radio you can see before it's chosen: line-2 was 1.4:1.
                        "border-ink-4",
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
          {/* Everything captured lands here, clipboard included: a public repo publishes it. */}
          {p.selectedRepo && !p.selectedRepo.private && (
            <div className="mt-2 text-xs text-warn-2" role="note">
              {p.selectedRepo.fullName} is public — everything you capture will be visible to
              anyone.
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
        <FolderOpen size={12} className="shrink-0" />
        <span className="shrink-0 whitespace-nowrap">{p.folderLabel}</span>
        <PathText path={p.localPath} className="text-ink-2" />
        <Button variant="link" className="ml-auto shrink-0" onClick={() => fire(p.chooseFolder())}>
          Change
        </Button>
      </div>
      <GitNotice hideWhenReady className="mt-4" />
      {p.submitError && (
        <div className="mt-3 text-xs text-cherry" role="alert">
          {p.submitError}
        </div>
      )}
      <StepFooter onBack={onBack}>
        <Button
          variant="primary"
          size="lg"
          loading={p.busy}
          disabled={!p.canSubmit}
          onClick={() => fire(p.submit())}
        >
          Continue <ArrowRight size={14} />
        </Button>
      </StepFooter>
    </Card>
  );
}
