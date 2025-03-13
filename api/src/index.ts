import { EventEmitter } from "stream";
import Fastify, { FastifyReply, FastifyRequest } from 'fastify'

import { connectController, getDefaultStates } from "./gamepad/lib";
import { ButtonStates, ControllerEvent, Input, State } from "./gamepad/types";
import { actions, handleInputEvent, runAction } from "./actions";
import { controllers } from "../config.js";

const xboxDevPath = '/dev/input/by-path/xbox-main'
const psPath = '/dev/input/by-path/ps-white'

const fastify = Fastify({
  logger: true
});

export const main: () => Promise<void> = () => new Promise(async (resolve, reject) => {
  const controller = new EventEmitter();
  const mainController = controllers.xbox;

  let buttonStates: ButtonStates = getDefaultStates();

  controller.on('disconnect', () => {
    // This is incredibly cheap, just a file access check
    console.log('Controller disconnected. Retrying in 1s');
    setTimeout(() => connectController(controller, mainController.path), 10000);
  });
  controller.on('connect', (id) => {
    // Reset the button states
    buttonStates = getDefaultStates() as any;
    console.log('Controller Connected', id);
  });
  controller.on('input', (event: ControllerEvent) => {
    if (buttonStates[event.input].state === event.state) return;
    console.log('button', event.input, 'state', event.state);
    buttonStates[event.input].state = event.state;
    handleInputEvent(buttonStates);
  });

  await connectController(controller, mainController.path);

  fastify.get('/', async (req: FastifyRequest, res: FastifyReply) => {
    res.headers({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
    });

    res.type('application/json').code(200);
    return buttonStates;
  });

  fastify.get('/off', async (req: FastifyRequest, res: FastifyReply) => {
    res.headers({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
    });
    await runAction(actions.tv_standby);
    res.type('application/json').code(200);
    return { message: 'TV Standby Done' };
  });

  fastify.get('/fix', async (req: FastifyRequest, res: FastifyReply) => {
    res.headers({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
    });

    await actions.fixController.start(controllers.xbox);

    res.type('application/json').code(200);
    return { message: 'Re-pair Done' };
  });

  fastify.listen({
    port: 4000,
    host: '0.0.0.0'
  });
  console.log('Server running at port 4000');
});

if (require.main === module) {
  main()
}
