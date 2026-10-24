/**
 * pi-tab-spinner
 *
 * Animates a spinner at the start of the terminal tab title while the agent
 * works, and removes the spinner when the run has settled. A glance at the tab
 * bar then shows which sessions are busy and which are idle.
 *
 * The title is written as OSC 0 (`ctx.ui.setTitle`). OSC 0 is the escape
 * sequence that sets the terminal window title, and Ghostty, iTerm2, Kitty,
 * WezTerm, and Terminal.app all render that title on the tab.
 */

import path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

/** Frames cycled through while the agent works, one frame per interval. */
export const DEFAULT_FRAMES = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"];

/** Milliseconds between two frames. */
export const DEFAULT_INTERVAL_MS = 120;

/** Prefix pi itself uses in the tab title (`APP_TITLE` in pi's core). */
export const APP_TITLE = "π";

export type Env = Record<string, string | undefined>;

/** Frames from `PI_TAB_SPINNER_FRAMES` (comma separated), else the defaults. */
export function resolveFrames(env: Env = process.env): string[] {
	const raw = env.PI_TAB_SPINNER_FRAMES;
	if (!raw) return DEFAULT_FRAMES;
	const frames = raw
		.split(",")
		.map((frame) => frame.trim())
		.filter(Boolean);
	return frames.length > 0 ? frames : DEFAULT_FRAMES;
}

/** Interval from `PI_TAB_SPINNER_INTERVAL_MS`, clamped to 20-5000 ms. */
export function resolveIntervalMs(env: Env = process.env): number {
	const raw = Number(env.PI_TAB_SPINNER_INTERVAL_MS);
	if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_INTERVAL_MS;
	return Math.min(Math.max(Math.round(raw), 20), 5000);
}

/** The title pi shows when the session is idle. */
export function plainTitle(dir: string, session?: string | null): string {
	return session ? `${APP_TITLE} - ${session} - ${dir}` : `${APP_TITLE} - ${dir}`;
}

/** The title shown while the session works. */
export function busyTitle(frame: string, dir: string, session?: string | null): string {
	return `${frame} ${plainTitle(dir, session)}`;
}

export default function tabSpinner(pi: ExtensionAPI) {
	let timer: ReturnType<typeof setInterval> | null = null;
	let frame = 0;

	const currentTitle = (prefix = "") => {
		const dir = path.basename(process.cwd());
		const session = pi.getSessionName();
		return prefix ? busyTitle(prefix, dir, session) : plainTitle(dir, session);
	};

	function stop(ctx: ExtensionContext) {
		if (timer) {
			clearInterval(timer);
			timer = null;
		}
		frame = 0;
		if (ctx.hasUI) ctx.ui.setTitle(currentTitle());
	}

	function start(ctx: ExtensionContext) {
		if (!ctx.hasUI) return;
		if (timer) clearInterval(timer);
		const frames = resolveFrames();
		frame = 0;
		const tick = () => {
			ctx.ui.setTitle(currentTitle(frames[frame % frames.length]));
			frame++;
		};
		tick();
		timer = setInterval(tick, resolveIntervalMs());
	}

	// agent_start: the run started, including the compaction check and
	// before_agent_start. agent_settled: pi has no automatic continuation left,
	// so the session is really idle again (agent_end alone can be followed by a
	// retry, recovery, or a queued message).
	pi.on("agent_start", async (_event, ctx) => start(ctx));
	pi.on("agent_settled", async (_event, ctx) => stop(ctx));
	pi.on("session_shutdown", async (_event, ctx) => stop(ctx));
}
