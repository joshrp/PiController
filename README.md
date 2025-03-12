# Pi Controller
Control a Raspberry Pi with a gamepad

This was built on Raspian Bookworm arm64, on a Pi 5. No guarantees it works elsewhere.
## Usage 

Set up your macros in `./src/index.ts`, listing what buttons do what actions.

Actions are in `./api/src/actions/index.ts`.

The ones provided are for Steam Link, Moonlight, TV control via CEC and controller disconnect.

Use the Frontend React app to see battery levels and controller connection status, as well as re-pairing controllers.

## Setting up 

`./src/config.ts` is where you list your controllers, their Bluetooth MAC address, their UDEV path and their upower path.

### Controller Paths
Controllers are found by the app with a path in `/dev/input/`. To have consistent paths, we use UDEV rules for the devices to be mounted. 

The udev rules in `./sys/05-gamepads.rules` needs modifying with your controller Bluetooth MAC address and then symlinking into the udev rules.

`ln -s $PWD/sys/05-gamepads.rules /usr/lib/udev/rules.d/`
`sudo udevadm control --reload-rules && sudo udevadm trigger`

To find and debug your controller, use `bluetoothctl` to scan, pair and connect first. 

### Battery Level
Finally, use `upower --dump` to find the upower path for your controller battery level.

### Compile

#### FE
`docker compose up -d` to build and run the frontend (React) app.

#### API
`nvm use`, `cd api`, `npm install`, `npm run build`


### Running service

`ln -s $PWD/sys/controller.service ~/.config/systemd/user/controller.service`
`systemctl --user enable controller.service`
`systemctl --user start controller.service`
`journalctl --user -u controller.service -f` to see logs


# Structure

## API
### index.ts
Main entry point, intialises controllers and the Fasify HTTP Server

### ./config.ts
List your controllers here, their MAC Address, their /dev/input path (defined in UDEV rules), and their upower path (for battery level).

### ./gamepad/
All the gamepad related stuff, connecting, mapping buttons.

Broadly just use `connectController`, passing in your own EventEmitter and read off that, it will auto-reconnect if it drops out. Use `getDefaultStates` for a starting point for your controller.

Maps EVDev events to standardised inputs (./gamepad/types.ts) for use elsewhere.
Currently has mappings for Xbox Series S and PS5 Dual Sense controllers. Other controllers map closely but would need cusotmisations.

### ./actions/
Holds all the things that can ran, either by controller or by HTTP request. Some commands wait for complete and parse output (e.g. get device info), some wait for a start and leave it alone (e.g. steamlink).

`handleInputEvent` takes a set of controller button states and runs any actions associated with them.
Typically just called on every button event with the whole state.

- ./index.ts - Has all the actions listed, with what commands to run

- ./lib.ts - Has the command runner and a few parsers

# ./sys
Contains the UDEV rules for the controllers to be mounted as a user. This needs symlinking into udev rules.

`ln -s $PWD/sys/05-gamepads.rules /usr/lib/udev/rules.d/`
`sudo udevadm control --reload-rules && sudo udevadm trigger`

