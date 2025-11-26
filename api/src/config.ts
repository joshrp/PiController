
/**
 * Path is wherever udev rules put it. See ./sys/
 * mac is the bluetooth address of the controller
 * upowerPath is the path used by upower to get battery level. See `upower --dump`
 */

import { ControllerConfig } from "./types";
import { BaseMapping, MappingClass, Mappings } from "evdev-gamepad";

export type ControllerCombined = ControllerConfig & {
  mapping: MappingClass
}
export const controllers: ControllerCombined[] = [
  {
    name: "Xbox",
    image: 'xbox-series-s.png',
    eventPath: '/dev/input/by-path/xbox-main',
    mac: "EC:83:50:F4:0E:56",
    safeDisconnect: false,
    mapping: new BaseMapping(),
    upowerPath: '/org/freedesktop/UPower/devices/gaming_input_dev_EC_83_50_F4_0E_56'
  },
  {
    name: "PS White",
    mapping: new Mappings.PS5Mapping(),
    image: 'ps5-white.png',
    eventPath: '/dev/input/by-path/ps-white',
    mac: "D0:BC:C1:CE:CB:58",
    safeDisconnect: true,
    upowerPath: '/org/freedesktop/UPower/devices/battery_ps_controller_battery_d0obcoc1oceocbo58'
  },
  {
    name: "PS Black",
    mapping: new Mappings.PS5Mapping(),
    image: 'ps5-black.png',
    eventPath: '/dev/input/by-path/ps-black',
    mac: "14:3A:9A:21:C3:20",
    safeDisconnect: true,
    upowerPath: '/org/freedesktop/UPower/devices/battery_ps_controller_battery_14o3ao9ao21oc3o20'
  },
  {
    name: "Switch Pro",
    mapping: new Mappings.SwitchProMapping(),
    image: 'switch-pro.png',
    safeDisconnect: false,
    eventPath: '/dev/input/by-path/ps-black',
    mac: "EC:C4:0D:D8:E6:01",
    upowerPath: ''
  }
]
