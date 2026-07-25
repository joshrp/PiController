/**
 * Replays real captured HID reports through the decoder.
 *
 * The fixture holds one representative report per input, taken from labelled
 * captures of an actual controller in both lizard and steamlink modes. Each
 * case feeds idle, then the held report, and asserts exactly which inputs
 * reacted - so a binding that overlaps something it shouldn't shows up as an
 * extra event rather than as mystery behaviour on the Pi.
 *
 *   npx tsx src/gamepad/steam-controller.test.ts
 */

import { readFileSync } from "node:fs";
import * as path from "node:path";

import { Input, State } from "evdev-gamepad";

import { SteamControllerDevice, SteamInput } from "./steam-controller";

type Fixture = {
  modes: {
    [mode: string]: { idle: string; held: { [label: string]: string } };
  };
};

const fixture: Fixture = JSON.parse(
  readFileSync(path.join(__dirname, "steam-controller.fixture.json"), "utf8")
);

/** What each captured segment should produce. */
const EXPECTED: { [label: string]: string[] } = {
  A: ["South=Pressed"],
  B: ["East=Pressed"],
  X: ["West=Pressed"],
  Y: ["North=Pressed"],
  L1: ["LeftBumper=Pressed"],
  R1: ["RightBumper=Pressed"],
  L2: ["LeftTrigger=Pressed"],
  R2: ["RightTrigger=Pressed"],
  L4: ["L4=Pressed"],
  L5: ["L5=Pressed"],
  R4: ["R4=Pressed"],
  R5: ["R5=Pressed"],
  START: ["Start=Pressed"],
  BACK: ["Back=Pressed"],
  PLATFORM: ["Platform=Pressed"],
  DPAD_UP: ["DPadY=Up"],
  DPAD_DOWN: ["DPadY=Down"],
  DPAD_LEFT: ["DPadX=Left"],
  DPAD_RIGHT: ["DPadX=Right"],
  LEFT_STICK_CLICK: ["LeftThumb=Pressed"],
  RIGHT_STICK_CLICK: ["RightThumb=Pressed"],

  // The regression cases: moving a stick or touching a pad sets activity flags
  // in the same bytes the buttons live in, and must produce nothing at all.
  LEFT_STICK_UP: [],
  LEFT_STICK_RIGHT: [],
  RIGHT_STICK_UP: [],
  RIGHT_STICK_RIGHT: [],
  LEFT_PAD: [],
  RIGHT_PAD: [],
};

let failures = 0;

function check(name: string, actual: string[], expected: string[]) {
  const ok = JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
  if (!ok) {
    failures++;
    console.log(`FAIL  ${name}\n        got  ${JSON.stringify(actual)}\n        want ${JSON.stringify(expected)}`);
  } else {
    console.log(`ok    ${name}`);
  }
}

function harness() {
  const device = new SteamControllerDevice({ path: "/dev/null" });
  const events: string[] = [];
  device.on("state-change" as any, (e: any) => events.push(`${e.input}=${e.state}`));
  return {
    device,
    events,
    feed(hex: string) {
      (device as any).handleReport(Buffer.from(hex.replace(/ /g, ""), "hex"));
    },
  };
}

for (const mode of Object.keys(fixture.modes)) {
  const { idle, held } = fixture.modes[mode];
  console.log(`\n--- ${mode} ---`);

  for (const label of Object.keys(held)) {
    const expected = EXPECTED[label];
    if (!expected) {
      failures++;
      console.log(`FAIL  ${mode}/${label}: no expectation defined`);
      continue;
    }

    const { events, feed } = harness();
    feed(idle);
    events.length = 0;
    feed(held[label]);
    const onPress = [...events];

    // Holding must not re-emit, and releasing must undo exactly what it did.
    events.length = 0;
    feed(held[label]);
    const onHold = [...events];
    events.length = 0;
    feed(idle);
    const onRelease = [...events];

    check(`${mode}/${label} press`, onPress, expected);
    check(`${mode}/${label} hold is silent`, onHold, []);
    check(
      `${mode}/${label} release`,
      onRelease,
      expected.map((e) => {
        const [input] = e.split("=");
        const resting =
          input === Input.DPadX || input === Input.DPadY
            ? State.Neutral
            : State.Released;
        return `${input}=${resting}`;
      })
    );
  }
}

// A report from the wrong node must be rejected outright, not decoded into
// button presses. This is the guard against the failure mode where the udev
// symlink lands on a different hidraw interface.
{
  const { events, feed } = harness();
  feed(fixture.modes.lizard.idle);
  const wrongNode = fixture.modes.lizard.held.A.replace(/^45/, "22");
  feed(wrongNode);
  check("report with the wrong signature is rejected", events, []);

  // ...and the same bytes with the right signature still decode normally,
  // proving the rejection is the signature and not the payload.
  const { events: ok, feed: feedOk } = harness();
  feedOk(fixture.modes.lizard.idle);
  ok.length = 0;
  feedOk(fixture.modes.lizard.held.A);
  check("same payload with a valid signature decodes", ok, ["South=Pressed"]);
}

// The paddles have to survive round-tripping through buttonStates as well.
{
  const { device, feed } = harness();
  feed(fixture.modes.lizard.idle);
  feed(fixture.modes.lizard.held.L4);
  check(
    "L4 tracked in buttonStates",
    [(device.buttonStates as any)[SteamInput.L4].state],
    [State.Pressed]
  );
}

console.log(failures ? `\n${failures} failure(s)` : "\nall passed");
process.exit(failures ? 1 : 0);
