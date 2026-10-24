import assert from "node:assert/strict";
import path from "node:path";
import tabSpinner, {
	APP_TITLE,
	DEFAULT_FRAMES,
	DEFAULT_INTERVAL_MS,
	busyTitle,
	plainTitle,
	resolveFrames,
	resolveIntervalMs,
} from "../index.ts";

// resolveFrames
assert.deepEqual(resolveFrames({}), DEFAULT_FRAMES);
assert.deepEqual(resolveFrames({ PI_TAB_SPINNER_FRAMES: "⏳, ⌛" }), ["⏳", "⌛"]);
assert.deepEqual(resolveFrames({ PI_TAB_SPINNER_FRAMES: "  " }), DEFAULT_FRAMES);

// resolveIntervalMs
assert.equal(resolveIntervalMs({}), DEFAULT_INTERVAL_MS);
assert.equal(resolveIntervalMs({ PI_TAB_SPINNER_INTERVAL_MS: "300" }), 300);
assert.equal(resolveIntervalMs({ PI_TAB_SPINNER_INTERVAL_MS: "1" }), 20);
assert.equal(resolveIntervalMs({ PI_TAB_SPINNER_INTERVAL_MS: "999999" }), 5000);
assert.equal(resolveIntervalMs({ PI_TAB_SPINNER_INTERVAL_MS: "abc" }), DEFAULT_INTERVAL_MS);

// plainTitle matches the title pi's core writes (APP_TITLE - session - dir)
assert.equal(plainTitle("empty", "my-session"), `${APP_TITLE} - my-session - empty`);
assert.equal(plainTitle("empty"), `${APP_TITLE} - empty`);
assert.equal(plainTitle("empty", null), `${APP_TITLE} - empty`);

// busyTitle prefixes the plain title with the frame
assert.equal(busyTitle("🌑", "empty", "my-session"), `🌑 ${APP_TITLE} - my-session - empty`);
assert.equal(busyTitle("🌑", "empty"), `🌑 ${APP_TITLE} - empty`);

// Extension behaviour against a fake pi and a fake ctx.
{
	process.env.PI_TAB_SPINNER_INTERVAL_MS = "20";
	process.env.PI_TAB_SPINNER_FRAMES = "A,B";

	const handlers = new Map<string, (event: unknown, ctx: unknown) => Promise<void>>();
	const titles: string[] = [];
	const pi = {
		on(name: string, handler: (event: unknown, ctx: unknown) => Promise<void>) {
			handlers.set(name, handler);
		},
		getSessionName: () => "sess",
	};
	const ctx = {
		hasUI: true,
		ui: {
			setTitle: (title: string) => {
				titles.push(title);
			},
		},
	};

	tabSpinner(pi as never);
	assert.deepEqual([...handlers.keys()], ["agent_start", "agent_settled", "session_shutdown"]);

	await handlers.get("agent_start")!({}, ctx);
	const first = titles.at(-1)!;
	assert.match(first, new RegExp(`^[AB] ${APP_TITLE} - sess - `));
	await new Promise((resolve) => setTimeout(resolve, 90));
	const animated = new Set(titles);
	assert.ok(animated.size >= 2, "spinner should cycle frames while the run is active");
	assert.ok(titles.some((title) => title.startsWith("A ")) && titles.some((title) => title.startsWith("B ")));

	await handlers.get("agent_settled")!({}, ctx);
	const settled = titles.at(-1)!;
	assert.equal(settled, plainTitle(path.basename(process.cwd()), "sess"));
	assert.ok(!settled.startsWith("A ") && !settled.startsWith("B "));

	// No writes after settling: the timer must be gone.
	const count = titles.length;
	await new Promise((resolve) => setTimeout(resolve, 80));
	assert.equal(titles.length, count);

	// Print and JSON modes have no UI, so the extension must stay silent there.
	await handlers.get("agent_start")!({}, { hasUI: false, ui: { setTitle: () => assert.fail("no UI, no write") } });
	await handlers.get("agent_settled")!({}, { hasUI: false, ui: { setTitle: () => assert.fail("no UI, no write") } });

	delete process.env.PI_TAB_SPINNER_INTERVAL_MS;
	delete process.env.PI_TAB_SPINNER_FRAMES;
}

console.log("all tests passed");
