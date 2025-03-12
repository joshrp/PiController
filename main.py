

from pygame import joystick, event
import pygame
import lookups
from lookups import Inputs

button_states = {}
axis_states = {}
def getJoystick():
  global button_states
  global axis_states
  joystick.init()
  pygame.display.init()
  joysticks = [
      joystick.Joystick(x) for x in range(pygame.joystick.get_count())
  ]

  button_states = {
    Inputs.A: False,
    Inputs.B: False,
    Inputs.X: False,
    Inputs.Y: False,
    Inputs.Back: False,
    Inputs.Xbox: False,
    Inputs.Start: False,
    Inputs.LeftStick: False,
    Inputs.RightStick: False,
    Inputs.LeftBumper: False,
    Inputs.RightBumper: False,
    Inputs.DPadUp: False,
    Inputs.DPadDown: False,
    Inputs.DPadLeft: False,
    Inputs.DPadRight: False,
  }

  axis_states = {
    Inputs.LeftTrigger: False,
    Inputs.RightTrigger: False,
  }
  return joysticks[0]

def getJoystickEvents(controller):
  yield {
    Inputs.A: False,
  }
  controller.init()
  try:
    e = event.wait()

    while e.type != pygame.QUIT:
      if e.type == pygame.JOYBUTTONDOWN:
        print(f"Button {e.button}  {lookups.buttons[e.button]} pressed")
      elif e.type == pygame.JOYBUTTONUP:
        print(f"Button {e.button}  {lookups.buttons[e.button]} released")
      elif e.type == pygame.JOYAXISMOTION:
        axis = lookups.axis[e.axis]
        if axis == Inputs.LeftTrigger or axis == Inputs.RightTrigger:
          if e.value > 0.8 and axis_states[axis] != True:
            axis_states[axis] = True
            print(f"Trigger {lookups.axis[e.axis]} pressed {e.value}")
          elif e.value < 0.8 and axis_states[axis] != False:
            axis_states[axis] = False
            print(f"Trigger {lookups.axis[e.axis]} released {e.value}")
        else:  # TODO::
          if e.value > 0.5 and axis_states[e.axis] != True:
            axis_states[e.axis] = True
            print(f"Axis {e.axis} pressed")
          elif e.value < -0.5 and axis_states[e.axis] != False:
            axis_states[e.axis] = False
            print(f"Axis {e.axis} released")
      elif e.type == pygame.JOYHATMOTION:
        print(f"DPad {e.value}")

      yield button_states, axis_states
      e = event.wait()
  except KeyboardInterrupt:
    return

