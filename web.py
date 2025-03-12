from gevent import monkey, spawn as gspawn;
monkey.patch_all()
import logging
from geventwebsocket import WebSocketError
from bottle import request, Bottle, abort, route, run

from joystick import watch_gamepad
from actions import steam_status

logger = logging.getLogger("WEB")
logger.setLevel(logging.INFO)

app = Bottle()

wsock = None
message = None
def send_message(msg):
  global message
  message = msg
  if wsock:
    wsock.send(message)

@app.route('/websocket')
def handle_websocket():
  global wsock
  wsock = request.environ.get('wsgi.websocket')
  if not wsock:
    abort(400, 'Expected WebSocket request.')

  while True:
    try:
      message = wsock.receive()
      wsock.send("Your message was: %r" % message)
    except WebSocketError:
      break
    except KeyboardInterrupt:
      break

@route('/')
def index():
  logging.info("Getting Steam Status")
  message = steam_status()
  return f"action {message}"

if __name__ == '__main__':
  logging.info("Start Gamepad Watch")
  gspawn(watch_gamepad)
  run(host='0.0.0.0', port=8080, server='gevent')
