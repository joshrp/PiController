const EvdevReader = require('evdev');
import DeviceReader from 'evdev/lib/Device';
import { accessSync, ReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
// const console = pino({
//   transport: {
//     target: 'pino-pretty',
//     options: {
//       colorize: true,
//       ignore: 'pid,hostname'
//     }
//   }
// })


const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const xboxDevPath = '/dev/input/by-path/xbox-main'
class NotPresentError extends Error {
  constructor() {
    super('Controller not present');
  }
}

async function getController(reader): Promise<DeviceReader> {
  console.info(`Polling for controller at ${xboxDevPath}`);

  let controller;
  while (controller === undefined) {
    try {
      await new Promise(async (resolve, reject) => {
        try { accessSync(xboxDevPath); }
        catch (e) {
          return reject(new NotPresentError());
        }
        console.info('Controller found');
        controller = reader.open(xboxDevPath);
        controller.on('open', () => {
          resolve(controller);
        });
      });
    } catch (e) {
      if (e instanceof NotPresentError) {
        console.warn('Retrying in 1s');
        await sleep(1002);
      } else {
        console.log('Catch error')
        console.error(e);
        throw e;
      }
    }
    console.log('Retrying');
  }
  console.log('Controller Found', controller.id);
  return controller;
}
export const main: () => Promise<void> = () => new Promise(async (resolve, reject) => {
  const reader = new EvdevReader();

  let controller: DeviceReader | undefined;
  const resetController = async () => { controller = await getController(reader); }
  await resetController();

  console.info('Controller connected', controller?.id);
  // reader.on("EV_KEY", function (data) {
  //   if (data.code == 'BTN_A') resolve();
  //   console.info("key : ", data.code, data.value);
  // }).on("EV_ABS", function (data) {
  //   console.info("Absolute axis : ", data.code, data.value);
  // }).on("error", function (e) {
  //   console.info("Error on Controller: ", arguments);
  //   resetController()
  // })
  // controller?.stream.on('error', (e) => {
  //   console.error('Controller error', e);
  //   // resetController();
  // });

  // controller?.stream.on('close', () => {
  //   console.error('Controller closed');
  // });
});

if (require.main === module) {

  main().catch((e) => {
    console.log('Error in main');
    console.error(e);
    process.exit(1);
  }).then(() => {
    console.log('Exiting');
    process.exit(0);
  });
}

enum Input {
  A = 'A',
  B = 'B',
  X = 'X',
  Y = 'Y',
  Back = 'Back',
  Xbox = 'Xbox',
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
  RightStickY = 'RightStickY'
}

enum State {
  Released = 'Released',
  Neutral = 'Neutral',
  Pressed = 'Pressed'
}

const CENTER_TOLERANCE = 20000;
const STICK_MAX = 65536;
const STICK_CENTRE = STICK_MAX / 2;

const buttonStates = {
  [Input.A]: { button: Input.A, state: State.Released, value: 0 },
  [Input.B]: { button: Input.B, state: State.Released, value: 0 },
  [Input.X]: { button: Input.X, state: State.Released, value: 0 },
  [Input.Y]: { button: Input.Y, state: State.Released, value: 0 },
  [Input.Back]: { button: Input.Back, state: State.Released, value: 0 },
  [Input.Xbox]: { button: Input.Xbox, state: State.Released, value: 0 },
  [Input.Start]: { button: Input.Start, state: State.Released, value: 0 },
  [Input.LeftThumb]: { button: Input.LeftThumb, state: State.Released, value: 0 },
  [Input.RightThumb]: { button: Input.RightThumb, state: State.Released, value: 0 },
  [Input.LeftBumper]: { button: Input.LeftBumper, state: State.Released, value: 0 },
  [Input.RightBumper]: { button: Input.RightBumper, state: State.Released, value: 0 },
  [Input.DPadX]: { button: Input.DPadX, state: State.Neutral, value: 0 },
  [Input.DPadY]: { button: Input.DPadY, state: State.Neutral, value: 0 },
  [Input.RightTrigger]: { button: Input.RightTrigger, state: State.Neutral, value: 0 },
  [Input.LeftTrigger]: { button: Input.LeftTrigger, state: State.Neutral, value: 0 },
  [Input.LeftStickX]: { button: Input.LeftStickX, state: State.Neutral, value: 0 },
  [Input.LeftStickY]: { button: Input.LeftStickY, state: State.Neutral, value: 0 },
  [Input.RightStickX]: { button: Input.RightStickX, state: State.Neutral, value: 0 },
  [Input.RightStickY]: { button: Input.RightStickY, state: State.Neutral, value: 0 },
};
