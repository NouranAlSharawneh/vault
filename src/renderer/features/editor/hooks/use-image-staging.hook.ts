import { useCallback } from "react";
import { errorMessage } from "@/helpers";
import { api } from "@/lib/api";
import { useToast } from "@/stores/toast";
import { ASSET_MAX_BYTES } from "@shared/constants";

/**
 * An image pasted or dropped into the text, handed to main to keep until the save copies
 * it into the document's `assets/`. Answers the name to link it by, or says why not.
 */
export function useImageStaging() {
  const show = useToast((s) => s.show);

  return useCallback(
    async (file: File): Promise<string | null> => {
      if (file.size > ASSET_MAX_BYTES) {
        show(`${file.name || "That image"} is over GitHub’s 100 MB limit, so it wasn’t added`);

        return null;
      }
      // A screenshot on the clipboard can come without an extension; its type has one.
      const name = /\.\w+$/.test(file.name) ? file.name : `image.${file.type.split("/")[1]}`;
      try {
        return await api("editor:stageImage", name, new Uint8Array(await file.arrayBuffer()));
      } catch (e) {
        show(`Couldn’t add ${file.name || "that image"}: ${errorMessage(e)}`);

        return null;
      }
    },
    [show],
  );
}
