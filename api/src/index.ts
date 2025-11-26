import Fastify, { FastifyReply, FastifyRequest } from 'fastify';

import { Device, Input, State } from "evdev-gamepad";
import { actions, processesList } from "./actions";
import { controllers } from "./config";
import { DeviceResp } from "./types";

import cors from '@fastify/cors';

export const main: () => Promise<void> = () => new Promise(async (resolve, reject) => {
  // For each controller, create a Device and set up macros
  // All controllers use the same macro scheme for now
  for (const controller of controllers) {
    console.log(`Setting up controller: ${controller.name} at ${controller.eventPath}`);
    const cont = new Device({
      path: controller.eventPath,
      mapping: controller.mapping
    });

    const escapeSeq = [{ input: Input.LeftBumper, state: State.Pressed }, { input: Input.RightBumper, state: State.Pressed }];

    const steamMode = { input: Input.DPadY, state: State.Up };
    const moonlightMode = { input: Input.DPadX, state: State.Left };
    const tvMode = { input: Input.DPadY, state: State.Down };
    const controllerMode = { input: Input.DPadX, state: State.Right };

    const onSeq = { input: Input.South, state: State.Pressed };
    const offSeq = { input: Input.West, state: State.Pressed };
    const switchTo = { input: Input.North, state: State.Pressed };

    cont.macros['TV_ON'] = {
      exclusive: true,
      inputs: [...escapeSeq, tvMode, onSeq]
    }

    cont.macros['TV_OFF'] = {
      exclusive: true,
      inputs: [...escapeSeq, tvMode, offSeq]
    }

    cont.macros['Steamlink'] = {
      exclusive: true,
      inputs: [...escapeSeq, steamMode, onSeq]
    }

    cont.macros['SteamlinkOff'] = {
      exclusive: true,
      inputs: [...escapeSeq, steamMode, offSeq]
    }

    cont.macros['SteamLinkSwitch'] = {
      exclusive: true,
      inputs: [...escapeSeq, steamMode, switchTo]
    }

    cont.macros['MoonlightSwitch'] = {
      exclusive: true,
      inputs: [...escapeSeq, moonlightMode, switchTo]
    }

    cont.macros['MoonlightOn'] = {
      exclusive: true,
      inputs: [...escapeSeq, moonlightMode, onSeq]
    }

    cont.macros['MoonlightOff'] = {
      exclusive: true,
      inputs: [...escapeSeq, moonlightMode, offSeq]
    }

    cont.macros['ControllerDisconnect'] = {
      exclusive: true,
      inputs: [...escapeSeq, controllerMode, offSeq]
    }

    cont.on('macro', async (id, config) => {
      console.log('[', controller.name, '] Macro triggered:', id);
      if (id === 'TV_ON') {
        actions.set_active_input.start();
      }
      if (id === 'TV_OFF') {
        actions.tv_standby.start();
        actions.steamlink.stop();
        // actions.moonlight.stop();
      }
      if (id === 'Steamlink') {
        actions.set_active_input.start();
        await actions.steamlink.start();
        await actions.set_focus.start('steam');

      }
      if (id === 'SteamlinkOff') {
        await actions.steamlink.stop();
        console.log('SteamlinkOff');
      }
      if (id === 'SteamLinkSwitch') {
        await actions.set_focus.start('steam');
      }
      if (id === 'MoonlightSwitch') {
        await actions.set_focus.start('moonlight');
      }
      if (id === 'MoonlightOn') {
        actions.set_active_input.start();
        await actions.moonlight.start();
        await actions.set_focus.start('moonlight');

      }
      if (id === 'MoonlightOff') {
        await actions.moonlight.stop();
        console.log('MoonlightOff');
      }
      if (id === 'ControllerDisconnect' && controller.safeDisconnect) {
        console.log('[', controller.name, '] ControllerDisconnect');
        await actions.bluetooth_disconnect.start(controller.mac);
      }
    });

    cont.on('connect', (...args) => {
      console.log('[', controller.name, '] connect:', args);
    }).on('disconnect', (...args) => {
      console.log('[', controller.name, '] disconnect:', args);
    }).on('state-change', (...args) => {
      // Debug button presses
      // console.log('[',controller.name, '] input:', args);
    });

    cont.connect();
  }

  const fastify = Fastify({
    logger: true
  });
  await fastify.register(cors, {
    origin: 'https://my.pi'
  });

  fastify.get('/', async (req: FastifyRequest, res: FastifyReply) => {
    res.headers({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
    });

    res.type('application/json').code(200);
    return { processesList };
  });

  fastify.get('/fix', async (req: FastifyRequest, res: FastifyReply) => {

    const mac = (req.query as any).mac as string;

    const result = await actions.fixController.start(mac);

    res.type('application/json').code(200);
    return result === true;
  });

  fastify.get('/devices', async (req: FastifyRequest, res: FastifyReply) => {
    const deviceList = await actions.getDevices.start();
    const resp: DeviceResp[] = controllers;
    for (const c in resp) {
      if (deviceList.includes(controllers[c].mac)) {
        resp[c].connected = true;
        resp[c].info = await actions.getDeviceInfo.start(controllers[c].mac, controllers[c].upowerPath, controllers[c].eventPath);
      }
    }
    return resp;
  });


  fastify.listen({
    port: 3002,
    host: '0.0.0.0'
  });
  console.log('Server running at port 3002');
});

if (require.main === module) {
  main()
}
