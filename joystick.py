import logging
import multiprocessing
import multiprocessing.spawn
from evdev import InputDevice, categorize, ecodes
from gevent import sleep
from lookups import Inputs, States, evdev_button_map, evdev_axis_map, Button
from actions import handle_inputs

CENTER_TOLERANCE = 20000
STICK_MAX = 65536
STICK_CENTRE = STICK_MAX / 2

logger = logging.getLogger("JOYSTICK")
logger.setLevel(logging.DEBUG)

button_states = {
    Inputs.A: Button(Inputs.A, States.Released, 0),
    Inputs.B: Button(Inputs.B, States.Released, 0),
    Inputs.X: Button(Inputs.X, States.Released, 0),
    Inputs.Y: Button(Inputs.Y, States.Released, 0),
    Inputs.Back: Button(Inputs.Back, States.Released, 0),
    Inputs.Xbox: Button(Inputs.Xbox, States.Released, 0),
    Inputs.Start: Button(Inputs.Start, States.Released, 0),
    Inputs.LeftThumb: Button(Inputs.LeftThumb, States.Released, 0),
    Inputs.RightThumb: Button(Inputs.RightThumb, States.Released, 0),
    Inputs.LeftBumper: Button(Inputs.LeftBumper, States.Released, 0),
    Inputs.RightBumper: Button(Inputs.RightBumper, States.Released, 0),
    Inputs.DPadX: Button(Inputs.DPadX, States.Neutral, 0),
    Inputs.DPadY: Button(Inputs.DPadY, States.Neutral, 0),
    Inputs.RightTrigger: Button(Inputs.RightTrigger, States.Neutral, 0),
    Inputs.LeftTrigger: Button(Inputs.LeftTrigger, States.Neutral, 0),
    Inputs.LeftStickX: Button(Inputs.LeftStickX, States.Neutral, 0),
    Inputs.LeftStickY: Button(Inputs.LeftStickY, States.Neutral, 0),
    Inputs.RightStickX: Button(Inputs.RightStickX, States.Neutral, 0),
    Inputs.RightStickY: Button(Inputs.RightStickY, States.Neutral, 0),
}

def button_event(btn: Inputs, state: States, at: float):
    if button_states[btn].state == state:
        return
    length = 0

    if (button_states[btn].at > 0):
        length = at - button_states[btn].at

    button_states[btn].state = state
    button_states[btn].at = at
    button_states[btn].last_length = length

    logger.debug (f"{state.name.ljust(10)} - {btn.name}")
    multiprocessing.Process(target=handle_inputs, args=[button_states]).start()

def get_gamepad():
    gamepad = None
    logger.info("Searching for gamepad every second")

    while gamepad is None:
        try:
            gamepad = InputDevice("/dev/input/by-path/xbox-main")
            logger.info(f"Gamepad found {gamepad.name}")
        except FileNotFoundError:
            sleep(1)
        except PermissionError:
            logger.error("Permission denied, sleeping for 5")
            sleep(5)
    return gamepad

def watch_gamepad():
    logger.info("Starting Gamepad Watcher")
    gamepad = None
    while True:
        if gamepad is None:
            gamepad = get_gamepad()
        try:
            for event in gamepad.read_loop():
                if event is None:
                    continue
                if event.type == ecodes.EV_KEY:
                    type = evdev_button_map[event.code]
                    if type not in button_states:
                        logger.error(f"Unknown button {type}, category {categorize(event)}")
                        continue

                    new_state = States.Pressed if event.value == 1 else States.Released
                    button_event(type, new_state, event.timestamp())

                # read stick axis movement
                if event.type == ecodes.EV_ABS:
                    axis = evdev_axis_map[event.code]
                    if (axis == Inputs.LeftTrigger or axis == Inputs.RightTrigger):
                        new_state = States.Pressed if event.value > 0.6 else States.Released

                        button_event(axis, new_state, event.timestamp())
                        continue

                    if axis == Inputs.DPadX or axis == Inputs.DPadY:
                        if event.code == ecodes.ABS_HAT0X:
                            new_state = States.Left if event.value == -1 else States.Right if event.value == 1 else States.Neutral
                        if event.code == ecodes.ABS_HAT0Y:
                            new_state = States.Up if event.value == -1 else States.Down if event.value == 1 else States.Neutral
                    else:
                        in_neutral = abs(event.value - STICK_CENTRE) < CENTER_TOLERANCE
                        is_left_or_up = event.value < STICK_CENTRE
                        if axis == Inputs.LeftStickX or axis == Inputs.RightStickX:
                            new_state = States.Neutral if in_neutral else States.Left if is_left_or_up else States.Right
                        if axis == Inputs.LeftStickY or axis == Inputs.RightStickY:
                            new_state = States.Neutral if in_neutral else States.Up if is_left_or_up else States.Down

                    button_event(axis, new_state, event.timestamp())
        except KeyboardInterrupt:
            logger.warning("Exiting")
            return
        except OSError as e:
            if e.errno == 19:
                logger.warning("Gamepad disconnected")
                gamepad = None
                continue
            logger.error(f"Error: {e}")
