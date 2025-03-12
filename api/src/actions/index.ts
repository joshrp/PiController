import { parseKVLinesInfo, parseUdevInfo, runCmd } from "./lib";
import { ProcessessList } from "./types";
import { DeviceInfo } from "../types";

// Global to keep track of running processes
export const processesList: ProcessessList = {};

export const actions = {
  set_active_input: {
    start: async () => {
      const cmd = ["sh", "-c", "echo 'as' | cec-client -s -d 1"];
      await (runCmd("cec-client", cmd, "TV ON", processesList)?.complete);
      // await runCmd("wmctrl", ["wmctrl", "-a", "Steam"], "Focus Steam", processesList)?.complete;

    },
  },
  set_focus: {
    start: async (app: string) => {
      const cmd = ["wmctrl", "-a", app];
      await runCmd("wmctrl", cmd, "Focus " + app, processesList)?.complete;
    },
  },
  tv_standby: {
    start: async () => {
      const cmd = ["sh", "-c", "echo 'standby 0' | cec-client -s -d 1"];
      await (runCmd("cec-client", cmd, "TV OFF", processesList)?.complete);
    },
  },
  moonlight: {
    start: async () => {
      const proc = runCmd("moonlight", ["/home/josh/projects/moonlight-qt/app/moonlight"], "Moonlight", processesList);

      await proc.started;
      proc.complete.then(() => {
        console.info("Moonlight process completed");
        delete processesList['moonlight'];
      });
    },
    stop: async () => {
      await processesList.moonlight?.kill();
    }
  },
  steamlink: {
    start: async () => { // Start Steam Link and focus its window
      const proc = runCmd("steamlink", ["steamlink"], "Steam Link", processesList);
      
      await proc.started;
      await runCmd("wmctrl", ["wmctrl", "-a", "Steam"], "Focus Steam", processesList)?.complete;
      
      proc.complete.then(() => {
        console.info("Steamlink process completed");
        delete processesList['steamlink'];
      });
    },
    stop: async () => {
      await processesList.steamlink?.kill();
    }
  },
  bluetooth_remove: {
    start: async (id) => {
      const cmd = "bluetoothctl -- remove " + id;
      await runCmd("bluetooth_remove", cmd.split(' '), "Bluetooth Remove", processesList)?.complete;
    }
  },
  bluetooth_disconnect: {
    start: async (id) => {
      const cmd = "bluetoothctl -- disconnect " + id;
      await runCmd("bluetooth_disconnect", cmd.split(' '), "Bluetooth Disconnect", processesList)?.complete;
    }
  },
  bluetooth_scan: {
    start: (id) => {
      return new Promise((resolve, reject) => { // Scan for a MAC address, resolve if found
        const proc = runCmd("bluetooth_scan", ["stdbuf", "--output=L", "bluetoothctl", "--timeout", "30", "scan", "on"], "Bluetooth Scan", processesList);
        if (!proc) return resolve(false);
        let found = false;
        proc.proc.stdout.on('data', (data) => {
          if (data.includes(id)) {
            found = true;
            proc.proc.kill();
          }
        })
        return proc.complete.then(() => {
          resolve(found);
        });
      });

    },
    stop: async () => {
      return processesList.bluetooth_scan?.kill();
    }
  },
  bluetooth_pair: {
    start: async (id) => { // Pair with a MAC address
      const key = "bluetooth_pair";
      const proc = runCmd(key, `bluetoothctl -- pair ${id}`.split(' '), "Bluetooth Pair", processesList);
      if (!proc) return;
      const { stdout } = await proc.complete;
      return stdout.includes("Pairing successful");
    },
  },
  fixController: { // Removes, scans, and pairs a bluetooth controller
    start: async (mac: string) => {
      if (processesList.bluetooth_scan) {
        console.info("Bluetooth actions already running");
        return;
      }

      await actions.bluetooth_remove.start(mac);
      console.info("Removed controller");
      const found = await actions.bluetooth_scan.start(mac);
      if (!found) {
        console.error("Controller not found");
        return false;
      }

      const paired = await actions.bluetooth_pair.start(mac);
      if (!paired) {
        console.error("Failed to pair controller");
        return false;
      } else {
        console.info("Paired controller");
        return true;
      }
    }
  },
  getDevices: {
    start: async () => {
      const cmd = "bluetoothctl -- devices Connected";
      const complete = await runCmd("bluetooth_devices", cmd.split(' '), "Bluetooth Devices", processesList)?.complete;
      if (!complete) return;
      const connected = [];
      for (const line of complete.stdout.split('\n')) {
        const match = /^Device ([\w:]+) .*$/i.exec(line);
        if (match) {
          console.log("Device", match[1]);
          connected.push(match[1]);
        }
      }
      return connected;
    }
  },
  getDeviceInfo: {
    start: async (mac: string, upowerPath: string, udevPath: string): Promise<DeviceInfo> => {
      const resp = {
        blt: null,
        upower: null,
        udev: null,
      }
      const btCmd = runCmd("bluetooth_get" + mac, ["bluetoothctl", "--", "info", mac], "Bluetooth Info", processesList)?.
        complete.then(info => {
          if (info?.stdout)
            resp.blt = parseKVLinesInfo(info.stdout);
        });

      const upowerCmd = runCmd("upower" + mac, ["upower", "-i", upowerPath], "Upower Info", processesList)?.
        complete.then(info => {
          if (info?.stdout)
            resp.upower = parseKVLinesInfo(info.stdout);
        });

      const udevCmd = runCmd("udev" + mac, ["udevadm", "info", "-a", "-n", udevPath], "Udev Info", processesList)?.
        complete.then(info => {
          if (info?.stdout)
            resp.udev = parseUdevInfo(info.stdout);
        });

      await Promise.all([btCmd, upowerCmd, udevCmd]);
      return resp as DeviceInfo;
    }
  },
};
