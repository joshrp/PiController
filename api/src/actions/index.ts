import { ChildProcess, exec, spawn } from "child_process";
import { Input, State, ButtonStates } from "../gamepad/types";
import { promisify } from "util";
import { createReadStream, createWriteStream, WriteStream } from "fs";
import Stream = require("stream");

export const handleInputEvent = (buttonStates: ButtonStates) => {
  if (buttonStates[Input.LeftBumper].state === State.Pressed && buttonStates[Input.RightBumper].state === State.Pressed) {
    if (buttonStates[Input.RightThumb].state === State.Pressed) {
      runAction(actions.set_active_input);
      return;
    }
    if (buttonStates[Input.LeftThumb].state === State.Pressed) {
      runAction(actions.tv_standby);
      return;
    }
    if (buttonStates[Input.Platform].state === State.Pressed) {
      runAction(actions.set_active_input);
      // DISPLAY=:0 wmctrl -a Steam
      runAction(actions.steamlink);
      return;
    }
    if (buttonStates[Input.DPadY].state === State.Down) {
      runAction(actions.debugDump);
      return;
    }
  }
}

interface Action<> {
  name: string;
  process: ChildProcess;
  start: (any) => Promise<any | void>;
  stop?: () => Promise<any | void>;
}

export const actions: Record<string, Action> = {
  set_active_input: {
    name: "TV ON",
    process: null,
    start: async () => {
      const cmd = "echo 'as' | cec-client -s -d 1";

      await new Promise((resolve, reject) => {
        actions.set_active_input.process = exec(cmd, (err, stdout, stderr) => {
          if (err) {
            reject(err);
          } else {
            actions.set_active_input.process = null;
            resolve({ stdout, stderr });
          }
        });
      });
    },
  },
  tv_standby: {
    name: "TV OFF",
    process: null,
    start: async () => {
      const cmd = "echo 'standby 0' | cec-client -s -d 1";
      const action = actions.tv_standby;
      return new Promise((resolve, reject) => {
        action.process = exec(cmd, (err, stdout, stderr) => {
          action.process = null;
          if (err) reject(err);
          else resolve({ stdout, stderr });
        });
      });
    },
  },
  steamlink: {
    name: "Steam Link",
    process: null,
    start: async () => {
      const cmd = "steamlink";
      const stmAc = actions.steamlink;

      stmAc.process = exec(cmd, {
        env: {
          "DISPLAY": ":0",
          "HOME": "/home/josh",
          "USER": "josh",
        }
      });
      stmAc.process.on('error', (err) => {
        console.error(`${stmAc.name} error: ${err}`);
      }).on('spawn', () => {
        console.log(`${stmAc.name} spawned`);
      }).on('exit', (code) => {
        console.log(`${stmAc.name} exited with code ${code}`);
        stmAc.process = null;
      });

      stmAc.process.stdout.on('data', (data) => {
        console.log(`[STDOUT][${stmAc.name}]: ${data}`);
      });
      stmAc.process.stderr.on('data', (data) => {
        console.error(`[STDERR][${stmAc.name}]: ${data}`);
      });
    },
    stop: () => {
      return new Promise((resolve, reject) => {
        actions.steamlink.process?.on('exit', resolve).kill();
      });
    }
  },
  debugDump: {
    name: "Debug Dump",
    process: null,
    start: async () => {
      const cmd = "env";
      const action = actions.debugDump;
      action.process = exec(cmd, {
        env: {
          "DISPLAY": ":0",
        }
      });
      action.process.on('error', (err) => {
        console.error(`${action.name} error: ${err}`);
      }).on('spawn', () => {
        console.log(`${action.name} spawned`);
      }).on('exit', (code) => {
        console.log(`${action.name} exited with code ${code}`);
        action.process = null;
      });

      action.process.stdout.on('data', (data) => {
        console.log(`[STDOUT][${action.name}]: ${data}`);
      });
      action.process.stderr.on('data', (data) => {
        console.error(`[STDERR][${action.name}]: ${data}`);
      });
    }
  },
  bluetooth_remove: {
    name: "Bluetooth Remove",
    process: null,
    start: (id) => {
      const cmd = "bluetoothctl -- remove " + id;
      console.log("[BLUETOOTH REMOVE START] ID:", id);
      const action = actions.bluetooth_remove;
      return new Promise((resolve, reject) => {
        action.process = exec(cmd, (err, stdout, stderr) => {
          action.process = null;
          if (err && err.code != 1) {
            reject(err);
            console.error(`${action.name} error: `, err);
          }
          else resolve({ stdout, stderr });
          console.log("[BLUETOOTH REMOVE DONE] ID:", id);
          action.process = null;
        });
      });
    }
  },
  bluetooth_scan: {
    name: "Bluetooth Scan",
    process: null,
    // Scan until we find a device we're looking for
    start: (id) => {
      console.log("[BLUETOOTH SCAN START]");

      const action = actions.bluetooth_scan;
      return new Promise((resolve, reject) => {
        action.process = spawn("stdbuf", ["--output=L", "bluetoothctl", "--", "scan", "on"])
          .on('error', (err) => {
            console.error(`[BLUETOOTH SCAN ERROR] error: `, err);
            action.process = null;
            reject();
          }).on('exit', (code) => {
            console.log(`[BLUETOOTH SCAN DONE] exited with code ${code}`);
            resolve(false);
            action.process = null;
          });

        action.process.stdout.on('data', (data) => {
          console.log(`[STDOUT][${action.name}]: ${data}`);
          if (data.includes(id)) {
            action.process.kill();
            resolve(true);
          }
        });

        action.process.stderr.on('data', (data) => {
          console.error(`[STDERR][${action.name}]: ${data}`);
        });
      });
    },
    stop: async () => {
      const action = actions.bluetooth_scan;
      if (action.process)
        return action.process.kill();
    }
  },
  bluetooth_pair: {
    name: "Bluetooth Pair",
    process: null,
    start: (id) => {
      const action = actions.bluetooth_pair;
      console.log("[BLUETOOTH PAIR START]");

      return new Promise((resolve, reject) => {
        action.process = spawn("bluetoothctl", ["--", "pair", id]);
        action.process.on('error', (err) => {
          console.error(`[${action.name}] error: ${err}`);
          action.process = null;
          reject();
        }).on('exit', (code) => {
          console.log(`[BLUETOOTH PAIR DONE] exited with code ${code}`);
          action.process = null;
        });

        action.process.stdout.on('data', (data) => {
          console.log(`[STDOUT][${action.name}]: ${data}`);
          if (data.includes("Pairing successful")) {
            resolve(true);
          }
        });
        action.process.stderr.on('data', (data) => {
          console.error(`[STDERR][${action.name}]: ${data}`);
        });
      });
    },
    stop: async () => {
      const action = actions.bluetooth_pair;
      return action.process.kill();
    }
  },

  fixController: {
    name: "Fix Controller",
    process: null,
    start: async (controller: { bth: string }) => {
      if (actions.bluetooth_scan.process
        || actions.bluetooth_pair.process
        || actions.bluetooth_remove.process) {
        console.info("Bluetooth actions already running");
        return;
      }
      await actions.bluetooth_remove.start(controller.bth);
      const timer = setTimeout(() => { actions.bluetooth_scan.stop() }, 30000);
      const found = await actions.bluetooth_scan.start(controller.bth);
      if (!found) {
        console.error("Controller not found");
        return;
      }

      await actions.bluetooth_pair.start(controller.bth);
      clearTimeout(timer);
      if (actions.bluetooth_scan.process)
        await actions.bluetooth_scan.stop();
    }
  }
};

export function runAction(action: Action, ...args) {
  if (action.process) {
    console.info(`[${action.name}] [ALREADY RUNNING]`);
    return;
  }
  console.info(`[${action.name}] [START]`);
  return action.start(args).then(() => {
    console.info(`[${action.name}] [DONE]`);
  }).catch((e) => {
    console.error(`[${action.name}] [ERROR]`, e);
  });
}

