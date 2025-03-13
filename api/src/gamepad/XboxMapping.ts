import { ControllerEvent, EvdevEvent, Input, State } from "./types";

export class XboxMapping {
  STICK_DEADZONE = 10000;
  STICK_TOLERANCE = 20000;
  STICK_MAX = 65536;
  STICK_CENTRE = 65536 / 2
  TRIGGER_TOLERANCE = 300;

  ABS(event: EvdevEvent): ControllerEvent | null {
    const input = this.getAxis(event.code);
    if (input === Input.Unknown) {
      console.log('Unknown input', event.code);
      return null;
    }

    if (input === Input.DPadX || input === Input.DPadY) {
      let state = State.Neutral;
      if (event.value == -1)
        state = input === Input.DPadX ? State.Left : State.Up;
      if (event.value == 1)
        state = input === Input.DPadX ? State.Right : State.Down;
      return {
        type: 'button',
        input: input,
        state: state
      }
    }

    if (input === Input.LeftTrigger || input === Input.RightTrigger) {
      const state = event.value > this.TRIGGER_TOLERANCE ? State.Pressed : State.Released;
      return {
        type: 'button',
        input: input,
        state: state
      }
    }
    // Only the sticks left
    // Check the deadzone so we're not spamming
    if (Math.abs(event.value - this.STICK_CENTRE) < this.STICK_DEADZONE)
      return;

    if (Math.abs(event.value - this.STICK_CENTRE) < this.STICK_TOLERANCE)
      return{
        type: 'stick',
        input: input,
        state: State.Neutral
      };

    let state = event.value > this.STICK_CENTRE ? State.Down : State.Up;
    if (input === Input.LeftStickX || input === Input.RightStickX)
      state = event.value > this.STICK_CENTRE ? State.Right : State.Left;

    return {
      type: 'stick',
      input: input,
      state: state
    }
  }
  getAxis(code: EvdevEvent["code"]): Input {
    switch (code) {
      case 'ABS_Z':
        return Input.RightStickX;
      case 'ABS_RZ':
        return Input.RightStickY;
      case 'ABS_X':
        return Input.LeftStickX;
      case 'ABS_Y':
        return Input.LeftStickY;
      case 'ABS_GAS':
        return Input.RightTrigger;
      case 'ABS_BRAKE':
        return Input.LeftTrigger;
      case 'ABS_HAT0X':
        return Input.DPadX;
      case 'ABS_HAT0Y':
        return Input.DPadY;
      default:
        return Input.Unknown;
    }
  }
  KEY(event: EvdevEvent): ControllerEvent | null {
    const input = this.getButton(event.code);
    if (input === Input.Unknown) {
      console.log('Unknown input', event.code);
      return null;
    }
    const state = event.value === 1 ? State.Pressed : State.Released;
    return {
      type: 'button',
      input: input,
      state: state
    }
  }
  getButton(code: EvdevEvent["code"]): Input {
    if (!this.button_map[code])
      return Input.Unknown;
    return this.button_map[code];
  }

  getType(type: string): "ABS" | "KEY" | null{
    switch (type) {
      case 'EV_KEY':
        return 'KEY';
      case 'EV_ABS':
        return 'ABS';
      default:
        return null;
    }
  }

  button_map = {
    BTN_A: Input.South,
    BTN_B: Input.East,
    BTN_X: Input.West,
    BTN_Y: Input.North,
    BTN_TL: Input.LeftBumper,
    BTN_TR: Input.RightBumper,
    BTN_SELECT: Input.Back,
    BTN_START: Input.Start,
    BTN_THUMBL: Input.LeftThumb,
    BTN_THUMBR: Input.RightThumb,
    BTN_MODE: Input.Platform
  }
}
