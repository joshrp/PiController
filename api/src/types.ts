

export type ControllerConfig = {
  // MAC address of the controller from bluetoothctl
  mac: string;
  // Path to the event file for the controller
  eventPath: string;
  // Path in public/static to use for the icon
  image: string;
  // Path to the upower device for the controller
  upowerPath: string;
  // Controller name for display / logging only
  name: string
  // Whether to perform a safe disconnect (if supported)
  safeDisconnect: boolean;
}

export interface DeviceResp extends ControllerConfig {
  info?: DeviceInfo;
  connected?: boolean;
}

export type DeviceInfo = {
  blt: BltInfo,
  upower: BltInfo,
  udev: BltInfo
}

export type BltInfo = {
  [key: string]: string;
}
