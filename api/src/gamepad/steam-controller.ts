/**
 * Steam Controller (2026) adapter.
 *
 * The controller's gamepad inputs never reach evdev: the kernel has no driver
 * for this hardware, so /dev/input only ever carries the keyboard/mouse
 * emulation. The real buttons arrive as vendor HID reports on /dev/hidraw*,
 * which this class reads directly.
 *
 * It fills the same role as `Device` from evdev-gamepad and extends it, so the
 * public surface - `buttonStates`, `macros`, `connect()`, and the `connect` /
 * `disconnect` / `state-change` / `macro` events - behaves identically. Only
 * the parsing differs: instead of 24-byte evdev structs it decodes bit flags
 * out of HID reports, keyed by report length.
 *
 * Reports arrive at roughly 300 Hz whether anything is pressed or not, so the
 * mapped bytes are compared against the previous report and identical ones are
 * dropped before any decoding happens. Consumers only ever see real changes.
 *
 * Analog sticks are not mapped: the byte offsets for them have not been worked
 * out yet, so the four stick axes stay Neutral. Nothing in PiController's
 * macros uses them today. To add them, decode a signed 16-bit little-endian
 * value from the 46-byte report and emit Left/Right/Up/Down around a deadzone,
 * mirroring `BaseMapping.StickEvent` in evdev-gamepad.
 */

import { createReadStream, type ReadStream } from "node:fs";

import { Device, Input, State } from "evdev-gamepad";

/** Bigger than the largest report we expect, so a read never truncates one. */
const MAX_REPORT_BYTES = 64;

/** Evdev nodes need a moment to become readable after creation; so do these. */
const OPEN_GRACE_MS = 500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type SteamBinding = {
  input: Input;
  /** Length of the HID report carrying this bit; reports are keyed by length. */
  length: number;
  /** Byte offset within that report. */
  offset: number;
  /** Bit mask within that byte. */
  mask: number;
  /**
   * Direction this bit stands for, on inputs that behave like an axis. Bits
   * sharing an input must either all set this or all omit it.
   */
  state?: State;
  /** Set when the bit reads 1 at rest and clears when the input is pressed. */
  invert?: boolean;
};

/**
 * The four rear paddles have no member in evdev-gamepad's `Input` enum, which
 * cannot be extended from outside the package. They are carried as extra keys
 * on `buttonStates` - a plain object at runtime - so they take part in state
 * tracking and macro matching exactly like the mapped inputs:
 *
 *   cont.macros['Something'] = { exclusive: true, inputs: [
 *     { input: SteamInput.L4, state: State.Pressed },
 *   ]};
 */
export const SteamInput = {
  L4: "L4" as Input,
  L5: "L5" as Input,
  R4: "R4" as Input,
  R5: "R5" as Input,
};

/**
 * Verified against labelled captures of a real controller taken in both modes
 * (steamlink running and not). The 46-byte report is a single type - byte 0 is
 * always 0x45 and byte 1 is a packet counter - and bytes 2-4 hold the digital
 * buttons identically in both modes.
 *
 * Bytes 10-17 carry the analog sticks as signed 16-bit little-endian pairs:
 * left X at 10, left Y at 12, right X at 14, right Y at 16. They are not bound
 * here (see the note at the top of the file), but nothing else reads them, so
 * stick movement cannot disturb the buttons.
 *
 * Names in the comments are the physical buttons; `input` is what PiController
 * sees.
 */
export const STEAM_CONTROLLER_BINDINGS: SteamBinding[] = [
  // Face buttons, laid out Xbox-style, so A/B/X/Y are South/East/West/North.
  { input: Input.South, length: 46, offset: 2, mask: 0x01 }, // A
  { input: Input.East, length: 46, offset: 2, mask: 0x02 }, // B
  { input: Input.West, length: 46, offset: 2, mask: 0x04 }, // X
  { input: Input.North, length: 46, offset: 2, mask: 0x08 }, // Y

  { input: Input.Start, length: 46, offset: 2, mask: 0x40 },
  { input: Input.Back, length: 46, offset: 3, mask: 0x40 },
  { input: Input.Platform, length: 46, offset: 4, mask: 0x01 },

  { input: Input.LeftThumb, length: 46, offset: 3, mask: 0x80 }, // LEFT_STICK click
  { input: Input.RightThumb, length: 46, offset: 2, mask: 0x20 }, // RIGHT_STICK click

  { input: Input.LeftBumper, length: 46, offset: 4, mask: 0x08 }, // L1
  { input: Input.RightBumper, length: 46, offset: 3, mask: 0x02 }, // R1

  { input: Input.RightTrigger, length: 46, offset: 4, mask: 0x80 }, // R2
  // Byte 5 is a flags byte, not analog travel: bit 3 is L2, while the other
  // bits mark stick and pad activity and the rear paddles. Only bit 3 belongs
  // to the trigger - a wider mask fires it whenever a paddle is brushed.
  { input: Input.LeftTrigger, length: 46, offset: 5, mask: 0x08 },

  // Four discrete D-pad bits folded back into the two axes evdev reports.
  { input: Input.DPadX, state: State.Left, length: 46, offset: 3, mask: 0x10 },
  { input: Input.DPadX, state: State.Right, length: 46, offset: 3, mask: 0x08 },
  { input: Input.DPadY, state: State.Up, length: 46, offset: 3, mask: 0x20 },
  { input: Input.DPadY, state: State.Down, length: 46, offset: 3, mask: 0x04 },

  { input: SteamInput.L4, length: 46, offset: 4, mask: 0x02 },
  { input: SteamInput.L5, length: 46, offset: 4, mask: 0x04 },
  { input: SteamInput.R4, length: 46, offset: 2, mask: 0x80 },
  { input: SteamInput.R5, length: 46, offset: 3, mask: 0x01 },
];

/**
 * A report must carry this byte to be decoded at all.
 *
 * Every one of the 5458 captured 46-byte reports began with 0x45. Without the
 * check, pointing this class at the wrong hidraw node - easily done, since the
 * numbering moves between boots and the device exposes several - decodes
 * whatever that interface emits as button bits, and inputs appear to fire at
 * random. Failing loudly beats guessing.
 */
export const REPORT_SIGNATURES: {
  [length: number]: { offset: number; value: number };
} = {
  46: { offset: 0, value: 0x45 },
};

/**
 * Lengths the controller emits that this class deliberately ignores: the
 * keyboard and mouse lizard-mode reports. Listing them keeps the unknown-length
 * warning meaningful instead of firing on every normal run.
 */
const IGNORED_LENGTHS = [6, 9, 13, 15];

/** The bindings feeding one input, within one report length. */
type ReportGroup = {
  input: Input;
  bindings: SteamBinding[];
  /** Distinct byte offsets this group reads. */
  offsets: number[];
  /** Values at those offsets on the last report that changed them. */
  last: number[] | null;
};

/** Bindings for one report length, grouped by the input they feed. */
type ReportPlan = {
  /** Every distinct byte offset the plan reads, for the whole-report check. */
  offsets: number[];
  groups: ReportGroup[];
};

export class SteamControllerDevice extends Device {
  private hidPath: string;
  private hidStream: ReadStream | null = null;
  private plans: { [length: number]: ReportPlan } = {};
  private lastBytes: { [length: number]: number[] } = {};
  private restingStates: { [input: string]: State } = {};
  private warnedLengths: { [length: number]: boolean } = {};
  private signatures: { [length: number]: { offset: number; value: number } };
  private rejected = 0;

  constructor(options: {
    /** Path to the hidraw node, e.g. /dev/hidraw0. Absolute path recommended. */
    path: string;
    /** Defaults to the discovered Steam Controller map. */
    bindings?: SteamBinding[];
    /** Per-length report signatures; pass {} to decode without checking. */
    signatures?: { [length: number]: { offset: number; value: number } };
  }) {
    super({ path: options.path });

    this.hidPath = options.path;
    this.signatures = options.signatures || REPORT_SIGNATURES;

    const bindings = options.bindings || STEAM_CONTROLLER_BINDINGS;
    for (const binding of bindings) {
      if (binding.offset >= binding.length) {
        throw new Error(
          `Binding for ${binding.input} reads offset ${binding.offset} of a ` +
            `${binding.length}-byte report`
        );
      }
      if (!binding.mask) {
        throw new Error(`Binding for ${binding.input} has an empty mask`);
      }
      this.addBinding(binding);
    }

    // The paddles aren't in getDefaultStates(), so seed them here. Snapshot the
    // whole lot afterwards to restore on every reconnect.
    for (const binding of bindings) {
      if (!this.buttonStates[binding.input]) {
        this.buttonStates[binding.input] = {
          input: binding.input,
          state: State.Released,
        };
      }
    }
    for (const input in this.buttonStates) {
      this.restingStates[input] = this.buttonStates[input as Input].state;
    }
  }

  private addBinding(binding: SteamBinding) {
    const plan =
      this.plans[binding.length] ||
      (this.plans[binding.length] = { offsets: [], groups: [] });

    if (plan.offsets.indexOf(binding.offset) === -1) {
      plan.offsets.push(binding.offset);
    }

    for (const group of plan.groups) {
      if (group.input !== binding.input) continue;
      if ((group.bindings[0].state === undefined) !== (binding.state === undefined)) {
        throw new Error(
          `Bindings for ${binding.input} mix directional and plain bits`
        );
      }
      group.bindings.push(binding);
      if (group.offsets.indexOf(binding.offset) === -1) {
        group.offsets.push(binding.offset);
      }
      return;
    }
    plan.groups.push({
      input: binding.input,
      bindings: [binding],
      offsets: [binding.offset],
      last: null,
    });
  }

  async connect(): Promise<boolean> {
    if (Device.fileExists(this.hidPath) === false) {
      await Device.waitForFile(this.hidPath);
      await sleep(OPEN_GRACE_MS);
    }

    // One read() syscall per chunk, and the kernel hands back exactly one HID
    // report per read, so a buffer larger than the biggest report means each
    // 'data' chunk is one whole report with its framing intact.
    const stream = createReadStream(this.hidPath, {
      flags: "r",
      autoClose: true,
      highWaterMark: MAX_REPORT_BYTES,
    });
    this.hidStream = stream;

    stream.on("open", () => {
      console.debug(`Device file opened ${this.hidPath}. Resetting Buttons`);
      for (const input in this.restingStates) {
        this.buttonStates[input as Input].state = this.restingStates[input];
      }
      this.lastBytes = {};
      for (const length in this.plans) {
        for (const group of this.plans[length].groups) {
          group.last = null;
        }
      }
      this.emit("connect");
    });

    stream.on("data", (chunk: any) => {
      this.handleReport(chunk as Buffer);
    });

    let dropped = false;
    const connectionDropped = () => {
      if (dropped) return;
      dropped = true;

      this.emit("disconnect");
      stream.close();

      if (this.autoReconnect) {
        console.debug("Reconnecting in", this.reconnectDelay, "ms");
        setTimeout(() => this.connect(), this.reconnectDelay);
      }
    };

    stream
      .on("error", (e) => {
        console.error("Device file stream error", e);
        connectionDropped();
      })
      .on("close", connectionDropped)
      .on("end", connectionDropped);

    return true;
  }

  private handleReport(report: Buffer) {
    const plan = this.plans[report.length];
    if (!plan) {
      if (
        IGNORED_LENGTHS.indexOf(report.length) === -1 &&
        !this.warnedLengths[report.length]
      ) {
        this.warnedLengths[report.length] = true;
        console.warn(
          `[steam-controller] no bindings for ${report.length}-byte reports, ` +
            `ignoring them. If this is a length you mapped, the read is not ` +
            `landing on report boundaries.`
        );
      }
      return;
    }

    const signature = this.signatures[report.length];
    if (signature && report[signature.offset] !== signature.value) {
      this.rejected++;
      if (this.rejected === 1 || this.rejected % 1000 === 0) {
        console.error(
          `[steam-controller] ${this.hidPath}: ${report.length}-byte report has ` +
            `0x${report[signature.offset].toString(16)} at byte ${signature.offset}, ` +
            `expected 0x${signature.value.toString(16)} (${this.rejected} rejected). ` +
            `This is almost certainly the wrong hidraw node - check what ` +
            `${this.hidPath} resolves to.`
        );
      }
      return;
    }

    // At ~300 Hz the vast majority of reports carry no change at all, so the
    // mapped bytes are compared first and identical reports never get decoded.
    const previous = this.lastBytes[report.length];
    if (previous && !this.bytesChanged(report, plan.offsets, previous)) return;
    this.lastBytes[report.length] = this.readBytes(report, plan.offsets);

    // Each group is re-evaluated only when the bytes it reads move, never
    // because some other button in the same report changed. That isolation is
    // what lets one input be fed by two different reports: see the two L2
    // bindings, where whichever source is dormant simply stays quiet instead of
    // overwriting the live one with a stale reading.
    for (const group of plan.groups) {
      if (group.last && !this.bytesChanged(report, group.offsets, group.last)) {
        continue;
      }
      group.last = this.readBytes(report, group.offsets);
      this.applyState(group.input, this.resolveState(report, group.bindings));
    }
  }

  private bytesChanged(report: Buffer, offsets: number[], previous: number[]) {
    for (let i = 0; i < offsets.length; i++) {
      if (previous[i] !== report[offsets[i]]) return true;
    }
    return false;
  }

  private readBytes(report: Buffer, offsets: number[]): number[] {
    const values: number[] = [];
    for (let i = 0; i < offsets.length; i++) {
      values.push(report[offsets[i]]);
    }
    return values;
  }

  private isSet(report: Buffer, binding: SteamBinding): boolean {
    const set = (report[binding.offset] & binding.mask) !== 0;
    return binding.invert ? !set : set;
  }

  private resolveState(report: Buffer, bindings: SteamBinding[]): State {
    let active: SteamBinding | null = null;
    let count = 0;
    for (const binding of bindings) {
      if (!this.isSet(report, binding)) continue;
      active = binding;
      count++;
    }

    if (bindings[0].state === undefined) {
      return count > 0 ? State.Pressed : State.Released;
    }
    // Opposing directions held at once cancel, the way they would on an axis.
    return count === 1 && active && active.state ? active.state : State.Neutral;
  }

  private applyState(input: Input, state: State) {
    const current = this.buttonStates[input];
    if (!current || current.state === state) return;

    current.state = state;
    const event = { type: "button" as "button", input: input, state: state };
    this.emit("state-change", event);
    this.checkMacros(event);
  }

  /**
   * Only intended for test use
   * @private
   */
  __closeStream() {
    this.hidStream?.close();
  }
}
