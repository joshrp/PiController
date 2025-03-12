import enum
from evdev import ecodes

Inputs = enum.Enum(
    "Inputs",
    "A B X Y Back Xbox Start LeftThumb RightThumb LeftBumper RightBumper DPadX DPadY LeftStickX LeftStickY RightStickX RightStickY LeftTrigger RightTrigger",
)

States = enum.Enum("States", "Pressed Released Left Right Up Down Neutral")

class Button:
    def __init__(self, btn: Inputs, state: States, at: float):
        self.btn = btn
        self.state = state
        self.at = at
        self.last_length = 0

evdev_button_map = {
    304: Inputs.A,
    305: Inputs.B,
    307: Inputs.X,
    308: Inputs.Y,
    314: Inputs.Back,
    316: Inputs.Xbox,
    315: Inputs.Start,
    317: Inputs.LeftThumb,
    318: Inputs.RightThumb,
    310: Inputs.LeftBumper,
    311: Inputs.RightBumper,
}
evdev_axis_map = {
  ecodes.ABS_X: Inputs.LeftStickX,  # 0 - 65,536   the middle is 32768
  ecodes.ABS_Y: Inputs.LeftStickY,
  ecodes.ABS_Z: Inputs.RightStickX,
  ecodes.ABS_RZ: Inputs.RightStickY,
  ecodes.ABS_BRAKE: Inputs.LeftTrigger,  # 0 - 1023
  ecodes.ABS_GAS: Inputs.RightTrigger,
  ecodes.ABS_HAT0X: Inputs.DPadX,  # -1 - 1
  ecodes.ABS_HAT0Y: Inputs.DPadY,
}

# pygame_button_map = {
#     0: Inputs.A,
#     1: Inputs.B,
#     2: Inputs.X,
#     3: Inputs.Y,
#     4: Inputs.Back,
#     5: Inputs.Xbox,
#     6: Inputs.Start,
#     7: Inputs.LeftStick,
#     8: Inputs.RightStick,
#     9: Inputs.LeftBumper,
#     10: Inputs.RightBumper,
#     11: Inputs.DPadUp,
#     12: Inputs.DPadDown,
#     13: Inputs.DPad,
#     14: Inputs.DPad,
# }

# axis = {
#   0: Inputs.LeftStick,
#   1: Inputs.LeftStick,
#   2: Inputs.RightStick,
#   3: Inputs.RightStick,
#   4: Inputs.LeftTrigger,
#   5: Inputs.RightTrigger,
# }

