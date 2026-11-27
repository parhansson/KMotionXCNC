# KMotionXCNC

KMotionXCNC is a browser-based CNC interface for
[KMotionX](https://github.com/parhansson/KMotionX) on macOS and Linux.
It lets you open G-code files, edit machine settings and control a connected
Dynomotion controller.

![KMotionXCNC interface](doc/images/main.png)

## Before you begin

You will install two components on the computer connected to your controller:

- **KMotionX** provides the controller libraries and the `kmxWeb` backend.
- **KMotionXCNC** provides the web interface served by that backend.

You also need a **machine configuration directory**, separate from the installed
application. It contains your machine settings, programs and resources.

Install these prerequisites:

- Git.
- Node.js 22 and npm.
- Python 3.
- The compiler, build tools and USB dependencies required by KMotionX. Follow
  its [platform installation instructions](https://github.com/parhansson/KMotionX#build-and-install)
  instructions before continuing. Linux users also need the controller's
  device access rules described in the KMotionX installation guide.

The steps below install under `$HOME/.local`.
No administrator privileges are required for the application
installation itself.

## 1. Download both projects

Choose a directory for your source code, then clone the repositories side by side:

```sh
mkdir -p "$HOME/src"
cd "$HOME/src"
git clone https://github.com/parhansson/KMotionX.git
git clone https://github.com/parhansson/KMotionXCNC.git
```

## 2. Build and install KMotionX

```sh
cd "$HOME/src/KMotionX"
./configure
make
make install
```

This installs the backend command as `$HOME/.local/bin/kmxWeb`, together with
its libraries, private helper programs and DSP resources. If configuration or
compilation fails, check the platform prerequisites in the KMotionX guide
before proceeding.

## 3. Build and install the web interface

```sh
cd "$HOME/src/KMotionXCNC"
./build-web.sh prod
./build-web.sh install
```

The build script installs the locked npm dependencies, builds the local CAM
library, runs regression tests and creates the production webbundle in `kmx/`.
The install command then copies that bundle to:

```text
$HOME/.local/share/kmx/web/
```

You do not need to run npm separately in the `camx` or `ng2` directories.
The installed backend serves the web interface directly.

## 4. Prepare your machine configuration

The repository includes two example machine directories:

```text
machines/laser/
machines/minirouter/
```

These describe specific machines, not universal defaults. Both select
`Kinematics3Rod`. Choose a configuration appropriate for your hardware and
review its kinematics, axis calibration, limits, tool table and actions.
In particular, check any configured startup action before starting the backend.

Keep your working configuration outside the source checkout. For example, to
start with a copy of the laser configuration:

```sh
cd "$HOME/src/KMotionXCNC"
mkdir -p "$HOME/.kmotionx"
test ! -e "$HOME/.kmotionx/laser" &&
  cp -R machines/laser "$HOME/.kmotionx/laser"
```

This deliberately does not overwrite an existing destination. If the directory
already exists, inspect it before deciding whether to use it.

The resulting machine root contains:

```text
$HOME/.kmotionx/laser/
├── data/                    # Interpreter variables, tool table and kinematics
├── c-programs/              # Controller C programs
├── gcode/                   # G-code files
└── settings/
    ├── machine.json         # Machine settings and actions
    ├── importcnf.json       # Import/CAM settings
    ├── fonts/
    └── textures/
```

Create or edit `$HOME/.kmxrc` and set `machineDataPath` to the **absolute path**
of this directory. For example, for a macOS user named `alex`:

```ini
machineDataPath=/Users/alex/.kmotionx/laser
```

Use your own path, not the example username. You can print the correct path with:

```sh
printf '%s\n' "$HOME/.kmotionx/laser"
```

Do not put `$HOME`, `~` or quotation marks in the configuration value; they are
not expanded. If `machineDataPath` is already present, replace that entry rather
than adding another one. Preserve any other settings in the file.

The backend's automatically seeded `default-machine` directory does not include
all the web GUI settings. Selecting a complete machine root is therefore
necessary for these instructions.

See [Machine configuration](machines/README.md) for more detail and migration
from the older directory layout.

## 5. Start the application

**Starting the backend connects to the controller and may execute the configured
startup action. Ensure the machine is ready and its configuration is correct
before running this command.**

```sh
"$HOME/.local/bin/kmxWeb" -listening_port 127.0.0.1:8080
```

Leave this terminal open, then open **http://127.0.0.1:8080/** in your browser.
Use this exact address: `localhost` can resolve to IPv6, while this command
listens on IPv4.

No separate frontend server or `-document_root` option is needed. The web
interface and its HTTP/WebSocket connections use the same server.

In the G-code editor, choose **Open** to select a file from your machine's
`gcode/` directory. Startup does not automatically select a G-code file.
The settings screen edits `settings/machine.json` in the selected machine root.
Changes saved through the interface modify your machine files.

Keep the backend bound to loopback as shown above; it is not an authenticated
network service. Closing the web page is not an emergency stop.

## Updating and removing the web interface

Before updating, make sure no machine operation is in progress. Back up your
machine configuration, update your source checkout, then rebuild and install:

```sh
cd "$HOME/src/KMotionXCNC"
./build-web.sh prod
./build-web.sh install
```

Reload the browser after installation. If you also update KMotionX, rebuild,
install and restart its backend so you are not running an older executable.

To remove only the installed web interface:

```sh
./build-web.sh uninstall
```

Frontend installation, reinstallation and removal do not modify your machine
root, `.kmxrc`, backend libraries or DSP resources. Do not store machine files
inside the installed `web/` directory: that directory is replaced on reinstall.

## Troubleshooting

**The backend reports a missing webroot**

Run `./build-web.sh prod` and `./build-web.sh install`. Make sure frontend and
backend use the same installation prefix and resource directory.

**The backend cannot load the machine settings**

Check `machineDataPath` in `~/.kmxrc`. It must point to the machine root, not its
`settings/` or `data/` subdirectory. The root needs `settings/machine.json` and
the three interpreter files `data/emc.var`, `data/Default.tbl` and
`data/Kinematics.txt`.

**The file dialog does not show your G-code**

Put the files in the selected machine root's `gcode/` directory, not in the
installed web directory. File access rejects parent traversal, symlinks and
paths outside the selected machine root.

**You see a 404 or a different application**

Use `http://127.0.0.1:8080/`, without `/kmx/`. Check that another process is not
using the port. If you just updated the frontend, force a browser reload.

**The installer refuses an existing web directory**

The installer only replaces directories carrying its `.kmx-web-owned` marker.
Back up and move aside an older manually installed web directory rather than
deleting unknown contents or adding the marker yourself.

## Custom installation paths

The default prefix is `$HOME/.local`. If KMotionX was configured with a custom
`--prefix` or `--sharedir`, pass matching options when installing the frontend:

```sh
./build-web.sh install --prefix=/custom/prefix
./build-web.sh install --prefix=/custom/prefix --sharedir=/custom/resources
```

The destination is `<sharedir>/kmx/web`, where `sharedir` defaults to
`<prefix>/share`. Use the same options for uninstall and launch `kmxWeb` from
the chosen prefix's `bin/` directory.

`PREFIX` and `SHAREDIR` environment variables are also supported. Paths must be
absolute; quote paths containing spaces. Installation into a system-owned
directory requires appropriate filesystem permissions.

For package staging, `DESTDIR` prepends a temporary root without changing
runtime paths:

```sh
DESTDIR=/absolute/staging ./build-web.sh install --prefix=/usr/local
```
