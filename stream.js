const { createReadStream, accessSync } = require("node:fs");
const { EventEmitter } = require("node:stream");
const os = require("os");
const ioctls = require("evdev/build/Release/ioctls");

const xboxDevPath = '/dev/input/by-path/xbox-main'
console.log(`arch: ${process.arch} ${process.platform} ${os.machine}`);
async function resetController(controller) {
  try {
    accessSync(xboxDevPath);
  } catch (e) {
    console.error('Controller not found', e);
    controller.emit('disconnect');
    return;
  }
  const stream = createReadStream(xboxDevPath, {
    flags: "r",
    encoding: null,
    fd: null,
    autoClose: true
  })

  stream.on('open', (fd) => {
    const id = ioctls.evdev_new_from_fd(fd);
    controller.emit('connect', id);
  });

  stream.on('data', (buf) => {
    // console.log('stream data', buf);
    controller.emit('input', buf);
  }).on('error', (e) => {
    console.error('stream error', e);
    controller.emit('disconnect');
  });

  return stream;
}


const main = () => new Promise(async (resolve, reject) => {
  const controller = new EventEmitter();

  await resetController(controller);

  controller.on('disconnect', () => {
    console.log('Controller disconnected. Retrying in 1s');
    setTimeout(() => resetController(controller), 1000);
  });
  controller.on('connect', (id) => {
    console.log('controller opened', id);
  });
  controller.on('input', (buf) => {
    console.log('controller input', buf);
  });
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
  main();
}

