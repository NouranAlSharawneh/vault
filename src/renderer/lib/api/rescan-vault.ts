import { plural } from "@/helpers";
import { useToast } from "@/stores/toast";
import { api } from "./api";
import { fire } from "./fire";

/**
 * Rescan from any of the three places that offer it. The sidebar and Settings buttons used
 * to finish in silence while the palette said how many documents it found; a click that
 * changes nothing visible needs the same answer wherever it came from.
 */
export function rescanVault(): void {
  fire(
    api("vault:rescan").then((snap) =>
      useToast
        .getState()
        .show(`Rescanned the vault folder — found ${plural(snap.docs.length, "doc")}`),
    ),
    "Couldn’t rescan the vault folder",
  );
}
