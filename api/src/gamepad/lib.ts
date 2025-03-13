import { exec } from "node:child_process";
import { promisify } from "node:util";
import { EventEmitter } from "stream";
import { createReadStream, accessSync } from "node:fs";

import { XboxMapping } from "./XboxMapping";
import { ButtonState, ButtonStates, EvdevEvent, Input, MappingClass, State } from "./types";
import * as evTypes from "./ev_types";

export async function connectController(controller: EventEmitter, path: string) {
  let controllerAttributes: Record<string, string> = {};
  try {
    accessSync(path);
  } catch (e) {
    console.debug('Controller no access to', path);
    controller.emit('disconnect');
    return false;
  }

  try {
    const info = await promisify(exec)(`udevadm info -a -n ${path}`);
    controllerAttributes = parseUdevInfo(info.stdout);
  } catch (e) {
    console.error('Error getting udev info', e);
    controller.emit('disconnect');
    return false;
  }

  const stream = createReadStream(path, {
    flags: "r",
    autoClose: true
  });

  let mapping: MappingClass | null = null;
  stream.on('open', (fd) => {
    const mapping_id = `${controllerAttributes["id/vendor"]}_${controllerAttributes["id/product"]}`;
    if (!mappings[mapping_id]) {
      controller.emit('disconnect');
      stream.close();
      return;
    }
    mapping = mappings[mapping_id];
    console.log('mapping_id', mapping_id);
    controller.emit('connect', mapping_id);
  });

  stream.on('data', (buf: any) => {
    const chunk = 24;
    // Don't know how to map events yet. Should be set on Open event
    if (mapping === null) return;

    for (let i = 0, j = buf.length; i < j; i += chunk) {
      const event = parseBuffer(buf.slice(i, i + chunk));
      const type = mapping.getType(event.type);
      if (type == null) continue; // SYS events etc.

      const resp = mapping[type](event);
      if (resp)
        controller.emit('input', resp);
    }
  }).on('error', (e) => {
    console.error('stream error', e);
    controller.emit('disconnect');
    stream.close();
  });

  return true;
}

const is64Bit = process.arch.includes('64');
const parseBuffer = (buf: Buffer): EvdevEvent => {
  const ev: EvdevEvent = {
    time: { tv_sec: null, tv_usec: null },
    type: null,
    code: null,
    value: null
  }
  let low = 0;
  let offset = 0;
  if (is64Bit) {
    low = buf.readInt32LE(0);
    ev.time.tv_sec = buf.readInt32LE(4) * 4294967296.0 + low;
    if (low < 0) ev.time.tv_sec += 4294967296;
    low = buf.readInt32LE(8);
    ev.time.tv_usec = buf.readInt32LE(12) * 4294967296.0 + low;
    if (low < 0) ev.time.tv_usec += 4294967296;
    offset = 16;
  } else {
    ev.time.tv_sec = buf.readInt32LE(0);
    ev.time.tv_usec = buf.readInt32LE(4);
    offset = 8;
  }

  ev.type = evTypes.EV_TYPE[buf.readUInt16LE(offset)] || null;
  ev.value = buf.readInt32LE(offset + 4);

  const code = buf.readUInt16LE(offset + 2);
  if (evTypes.codes[ev.type]) {
    ev.code = evTypes.codes[ev.type][code] || null;
  }
  return ev;
};

/**
 *
 * @param info stdout from a udevadm info command
 * @returns an object containing all ATTRS{} names and values
 */
const parseUdevInfo = (info: string) => {
  const lines = info.split('\n');
  const attributes: Record<string, string> = {};
  for (const line of lines) {
    const match = line.match(/ATTRS\{([^\}]+)\}=+"([^"]+)"/);
    if (match) {
      attributes[match[1]] = match[2];
    }
  }
  return attributes;
};

const mappings: Record<string, MappingClass> = {
  "045e_0b20": new XboxMapping()
}

export function getDefaultStates(): ButtonStates {
  return {
    [Input.South]: { input: Input.South, state: State.Released },
    [Input.East]: { input: Input.East, state: State.Released },
    [Input.West]: { input: Input.West, state: State.Released },
    [Input.North]: { input: Input.North, state: State.Released },
    [Input.Back]: { input: Input.Back, state: State.Released },
    [Input.Platform]: { input: Input.Platform, state: State.Released },
    [Input.Start]: { input: Input.Start, state: State.Released },
    [Input.LeftThumb]: { input: Input.LeftThumb, state: State.Released },
    [Input.RightThumb]: { input: Input.RightThumb, state: State.Released },
    [Input.LeftBumper]: { input: Input.LeftBumper, state: State.Released },
    [Input.RightBumper]: { input: Input.RightBumper, state: State.Released },
    [Input.DPadX]: { input: Input.DPadX, state: State.Neutral },
    [Input.DPadY]: { input: Input.DPadY, state: State.Neutral },
    [Input.RightTrigger]: { input: Input.RightTrigger, state: State.Neutral },
    [Input.LeftTrigger]: { input: Input.LeftTrigger, state: State.Neutral },
    [Input.LeftStickX]: { input: Input.LeftStickX, state: State.Neutral },
    [Input.LeftStickY]: { input: Input.LeftStickY, state: State.Neutral },
    [Input.RightStickX]: { input: Input.RightStickX, state: State.Neutral },
    [Input.RightStickY]: { input: Input.RightStickY, state: State.Neutral },
    [Input.Unknown]: { input: Input.Unknown, state: State.Neutral },
  };

}
