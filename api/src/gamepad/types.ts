
export type EvdevEvent = {
  time: {
    tv_sec: number,
    tv_usec: number
  },
  type: string,
  code: string,
  value: number
}
export type ControllerEvent = {
  type: "button" | "stick",
  input: Input,
  state: State,
}

export interface MappingClass {
  getType: (type: string) => "ABS" | "KEY" | "REL" | null;
  ABS: (event: EvdevEvent) => ControllerEvent | null;
  KEY: (event: EvdevEvent) => ControllerEvent | null;
  REL?: (event: EvdevEvent) => ControllerEvent | null;
}

export enum Input {
  South = 'South',
  East = 'East',
  West = 'West',
  North = 'North',
  Back = 'Back',
  Platform = 'Xbox',
  Start = 'Start',
  LeftThumb = 'LeftThumb',
  RightThumb = 'RightThumb',
  LeftBumper = 'LeftBumper',
  RightBumper = 'RightBumper',
  DPadX = 'DPadX',
  DPadY = 'DPadY',
  RightTrigger = 'RightTrigger',
  LeftTrigger = 'LeftTrigger',
  LeftStickX = 'LeftStickX',
  LeftStickY = 'LeftStickY',
  RightStickX = 'RightStickX',
  RightStickY = 'RightStickY',
  Unknown = 'Unknown'
}

export enum State {
  Released = 'Released',
  Neutral = 'Neutral',
  Pressed = 'Pressed',
  Left = 'Left',
  Right = 'Right',
  Up = 'Up',
  Down = 'Down'
}

export type ButtonState = { state: State, input: Input }
export type ButtonStates = Record<Input, ButtonState>
