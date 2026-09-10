import { useState } from "react";
import { Button, Empty } from "@/components/ui";
import { useApp } from "@/stores/app";
import { useDocument } from "./hooks/use-document.hook";
import { ProjectSidebar } from "./components/project-sidebar/project-sidebar.component";
import { DocumentList } from "./components/document-list/document-list.component";
import { DocumentReader } from "./components/document-reader/document-reader.component";

/** Three panes: navigation · document list · reader. */
export function Main() {
  const index = useApp((s) => s.index);
  const config = useApp((s) => s.config);
  const [project, setProject] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const doc = useDocument(selected);

  if (!config) {
    return (
      <Empty
        title="No vault connected"
        action={
          <Button variant="primary" onClick={() => (window.location.hash = "onboarding")}>
            Set up Vault
          </Button>
        }
      />
    );
  }
  const docs = (index?.docs ?? []).filter((d) => !project || d.projectSlug === project);

  return (
    <div className="flex h-full">
      <ProjectSidebar index={index} config={config} project={project} onSelect={setProject} />
      <DocumentList docs={docs} selected={selected} onSelect={setSelected} />
      <DocumentReader doc={doc} />
    </div>
  );
}
