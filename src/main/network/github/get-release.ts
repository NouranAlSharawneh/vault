import { githubApi } from "../axios";
import type { RawRelease } from "./github.types";

/** The release tagged `tag` in `fullName`, with its assets. */
export async function getRelease(fullName: string, tag: string): Promise<RawRelease> {
  const { data } = await githubApi().get<RawRelease>(
    `/repos/${fullName}/releases/tags/${encodeURIComponent(tag)}`,
  );

  return data;
}
