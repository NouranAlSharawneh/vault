import { errorMessage } from "@/helpers";
import { useToast } from "@/stores/toast";

/**
 * Start something that may fail, and say so where the user can see it if it does.
 *
 * `void somePromise()` reads like a decision but is only a silence: a rejected invoke
 * becomes an unhandled rejection in a console nobody has open, and the control the user
 * clicked appears to do nothing at all. That was most of what the audit found by hand.
 *
 * The console line is deliberate as well as the toast — the end-to-end run fails on
 * console errors, so a failure here is a failing test rather than a shrug.
 */
export function fire(promise: Promise<unknown>, whenItFails?: string): void {
  promise.catch((e: unknown) => {
    const message = whenItFails ?? errorMessage(e);
    console.error(message, e);
    useToast.getState().show(message);
  });
}

/**
 * For the handful of calls whose failure genuinely does not concern the user — telling a
 * window to resize itself, asking a sheet to hide when it may already be gone. Still
 * recorded, never shown.
 */
export function fireQuietly(promise: Promise<unknown>, what: string): void {
  promise.catch((e: unknown) => console.warn(`${what}:`, e));
}
