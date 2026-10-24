# pi-tab-spinner

[pi](https://github.com/earendil-works/pi-coding-agent) extension that spins an
icon at the start of the terminal tab title while the agent works, and removes
the icon when the run settles.

```
🌒 π - Fix login race - customer-web   ← busy, animating
π - Fix login race - customer-web      ← idle
```

Run several pi sessions in several tabs and the tab bar tells you which ones are
still working without switching to them.

## Why the title and not a progress bar

pi can report progress with OSC 9;4 (`terminal.showTerminalProgress` in
`/settings`). Ghostty draws that as a thin bar under the tab bar, visible only
while the tab is focused, so it does not help when you are looking at another
tab. The tab title, by contrast, is rendered for every tab at once, which is
what this extension writes.

## Install

```bash
pi install npm:pi-tab-spinner
```

Then restart pi (or `/reload`). Update later with `pi update npm:pi-tab-spinner`.

Or try it without touching your settings:

```bash
pi -e npm:pi-tab-spinner
```

## Configure

| Environment variable | Default | Meaning |
|---|---|---|
| `PI_TAB_SPINNER_FRAMES` | `🌑,🌒,🌓,🌔,🌕,🌖,🌗,🌘` | Comma-separated frames, cycled in order |
| `PI_TAB_SPINNER_INTERVAL_MS` | `120` | Milliseconds per frame, clamped to 20-5000 |

Examples:

```bash
# hourglass, flipping slowly
export PI_TAB_SPINNER_FRAMES="⏳,⌛"
export PI_TAB_SPINNER_INTERVAL_MS=600

# braille dots, the quietest option
export PI_TAB_SPINNER_FRAMES="⠋,⠙,⠹,⠸,⠼,⠴,⠦,⠧,⠇,⠏"
export PI_TAB_SPINNER_INTERVAL_MS=80
```

The frames are read at the start of every run, so nothing needs a restart after
you change them.

## How it works

- `agent_start` starts a timer that rewrites the terminal title with
  `ctx.ui.setTitle()`, which pi sends as OSC 0. OSC 0 is the escape sequence
  that sets the terminal window title; Ghostty, iTerm2, Kitty, WezTerm, and
  Terminal.app all show it on the tab.
- `agent_settled` stops the timer and restores the idle title. `agent_settled`
  fires when pi has no automatic continuation left, so retries, recovery,
  compaction, and queued messages all finish first. `agent_end` is not used,
  because a retry can follow it.
- `session_shutdown` also restores the title, so quitting pi never leaves a
  frozen spinner behind.
- The idle title is `π - <session name> - <directory>`, or `π - <directory>`
  when the session has no name, matching what pi itself writes at startup.
- Print, JSON, and other headless modes report `hasUI: false`, and the extension
  writes nothing there.

## Develop

```bash
git clone https://github.com/ymy88/pi-tab-spinner
cd pi-tab-spinner
npm test    # node --experimental-strip-types, no dependencies to install
```

## License

MIT
