import { spawn } from "child_process";
import { Process, ProcessessList } from "./types";
import { BltInfo } from "../types";

/**
 * Fairly general command runner.
 * Keeps track of unique running processes via cmdKey parameter.
 * Returns a promise that resolves when the process has been successfully STARTED
 * Enters a record into processesList with the cmdKey as the key that contains:
 *  - promise: the promise that resolves when the process has exited
 *  - proc: the ChildProcess object for reading stdout, stderr, etc.
 * @param cmdKey unique key for the process, to stop overlaps
 * @param cmd array that can be passed to child_process.spawn (0 = command name)
 * @param name Human name for logs
 * @returns
 */
export const runCmd = (cmdKey: string, cmd: string[], name: string, processesList: ProcessessList): Process | null => {
  const clearProc = () => {
    delete processesList[cmdKey];
  }
  if (processesList[cmdKey]) {
    const exitCode = processesList[cmdKey].exitCode;
    if (exitCode !== null) {
      console.log('Seems to have exited, clearing')
      clearProc();
    } else {
      console.info(`[${name}] [ALREADY RUNNING]`);
      return null;
    }
  }
  console.log(`[${name}] [CMD]: ${cmd.join(' ')}`);

  const started = createPromise();
  const complete = createPromise();
  const childProc = spawn(cmd[0], cmd.slice(1), {
    env: {
      "DISPLAY": ":0",
      "HOME": "/home/josh",
      "USER": "josh",
    }
  });
  const proc = {
    complete: complete.promise as Promise<{ stdout: string, stderr: string }>,
    proc: childProc,
    started: started.promise as Promise<void>
  }
  processesList[cmdKey] = proc.proc;

  proc.proc.on('error', (err) => {
    console.error(`[${name}] [ERROR]: ${err}`);
    clearProc();
    complete.reject();
    if (!started.resolved())
      started.reject();

  }).on('exit', (code) => {
    console.debug(`[${name}] [DONE] exited with code ${code}`);
    clearProc();
    complete.resolve({ stdout, stderr });
    if (!started.resolved())
      started.reject();

  }).on('spawn', () => {
    console.debug(`[${name}] [SPAWN]`);
    started.resolve();
  });

  let stdout = "", stderr = "";
  proc.proc.stdout.on('data', (data) => {
    console.debug(`[${name}] [STDOUT]: ${data}`);
    stdout += data;
  });
  proc.proc.stderr.on('data', (data) => {
    console.debug(`[${name}] [STDERR]: ${data}`);
    stderr += data;
  });

  return proc;
}

export function parseKVLinesInfo(info: string): BltInfo {
  const resp = {};
  for (const line of info.split('\n')) {
    const keyEnd = line.indexOf(':')
    if (keyEnd === -1) continue;
    const key = line.slice(0, keyEnd).trim();
    const value = line.slice(keyEnd + 1).trim();
    resp[key] = value;
  }
  return resp;
}
/**
 * Example output from `bluetoothctl -- info <id>`:
Device EC:83:50:F4:0E:56 (public)
        Name: Xbox Wireless Controller
        Alias: Xbox Wireless Controller
        Appearance: 0x03c4
        Icon: input-gaming
        Paired: yes
        Bonded: yes
        Trusted: no
        Blocked: no
        Connected: yes
        LegacyPairing: no
        UUID: Vendor specific           (00000001-5f60-4c4f-9c83-a7953298d40d)
        UUID: Generic Access Profile    (00001800-0000-1000-8000-00805f9b34fb)
        UUID: Generic Attribute Profile (00001801-0000-1000-8000-00805f9b34fb)
        UUID: Device Information        (0000180a-0000-1000-8000-00805f9b34fb)
        UUID: Battery Service           (0000180f-0000-1000-8000-00805f9b34fb)
        UUID: Human Interface Device    (00001812-0000-1000-8000-00805f9b34fb)
        Modalias: usb:v045Ep0B20d0515
        ManufacturerData Key: 0x0006
        ManufacturerData Value:
  00                                               .
        Battery Percentage: 0x41 (65)
 */



/**
 *
 * @param info stdout from a udevadm info command
 * @returns an object containing all ATTRS{} names and values
 */
export const parseUdevInfo = (info: string) => {
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

// Make a promise in the style of the old Deffered pattern
const createPromise = () => {
  let resolve, reject;
  let resolved = false, rejected = false;
  const promise = new Promise((res, rej) => {
    resolve = (a) => {
      resolved = true;
      res(a);
    };
    reject = (e) => {
      rejected = true;
      rej(e);
    };
  });
  return { promise, resolve, reject, resolved: () => { return resolved; }, rejected: () => { return rejected; } };
}
