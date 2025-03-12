import subprocess
import logging
from gevent import spawn as gspawn
from lookups import Inputs, States, Button
import typing

logger = logging.getLogger("ACTIONS")
logger.setLevel(logging.INFO)

def handle_inputs(button_states: typing.Dict[Inputs, Button]):
    ## These are the actions to take
    if button_states[Inputs.Start].state == States.Released and button_states[Inputs.Start].last_length > 1:
      logger.info("Start button held for 1s")
      return
    # Triggers Held
    # if button_states[Inputs.LeftTrigger].state == States.Pressed and button_states[Inputs.RightTrigger].state == States.Pressed:


    # Bumpers Held
    if button_states[Inputs.LeftBumper].state == States.Pressed and button_states[Inputs.RightBumper].state == States.Pressed:
      # if button_states[Inputs.Xbox].state == States.Pressed:
      #   logger.info("[ACTION] [Firefox] [START]")
      #   start_firefox("http://127.0.0.1:8080")
      if button_states[Inputs.RightThumb].state == States.Pressed:
        logger.info("[TV On] [START]")
        set_active_input()
        logger.info("[TV On] [DONE]")
        return
      if button_states[Inputs.LeftThumb].state == States.Pressed:
        logger.info("[TV Standby] [START]")
        tv_standby()
        logger.info("[TV Standby] [DONE]")
        return
      if button_states[Inputs.Xbox].state == States.Pressed:
        def hdmi():
          logger.info("[Start Steam] [HDMI] [START]")
          set_active_input()
          logger.info("[Start Steam] [HDMI] [DONE]")
        gspawn(hdmi)
        logger.info("[Start Steam] [START]")
        start_steam()
        logger.info("[Start Steam] [DONE]")
        return
      if button_states[Inputs.Back].state == States.Pressed and button_states[Inputs.Start].state == States.Pressed:
        logger.info("[Stop Steam] [START]")
        stop_steam()
        logger.info("[Stop Steam] [DONE]")
        return


firefox_proc = None
def start_firefox(url):
  global firefox_proc

  if firefox_proc is not None:
    ret = firefox_proc.poll()
    if ret is not None:
      logger.warning(f"Firefox exited with {ret}. Relaunching")
    else:
      firefox_proc.terminate()
      firefox_proc.wait()
  firefox_proc = subprocess.Popen(["firefox", url])

def set_active_input():
  # use cec-client and pipe 'as' to it
  p = subprocess.Popen(['cec-client', '-s'], stdout=subprocess.PIPE, stdin=subprocess.PIPE, stderr=subprocess.STDOUT)
  stdout = p.communicate(input=b'on')[0]
  logger.debug(stdout.decode())
  p = subprocess.Popen(['cec-client', '-s'], stdout=subprocess.PIPE, stdin=subprocess.PIPE, stderr=subprocess.STDOUT)
  stdout = p.communicate(input=b'as')[0]
  logger.debug(stdout.decode())

def tv_standby():
  p = subprocess.Popen(['cec-client', '-s'], stdout=subprocess.PIPE, stdin=subprocess.PIPE, stderr=subprocess.STDOUT)
  stdout = p.communicate(input=b'standby 0')[0]
  logger.debug(stdout.decode())

steam_proc = None
def start_steam():
  global steam_proc
  if steam_proc is not None:
    ret = steam_proc.poll()
    if ret is not None:
      logger.warning(f"Steam exited with {ret}. Relaunching")
    else:
      logger.info("Steam is already running")
      return
  steam_proc = subprocess.Popen(["steamlink"])

def stop_steam():
  global steam_proc
  if steam_proc is None:
    return
  logger.warning("Stopping Steam")
  steam_proc.terminate()
  steam_proc.wait()
  steam_proc = None

def steam_status():
  global steam_proc
  if steam_proc is None:
    return "Steam Link is not running"
  ret = steam_proc.poll()
  if ret is None:
    return "Steam Link is running"
  return f"Steam Link exited with {ret}"
