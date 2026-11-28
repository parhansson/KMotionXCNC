# KMotionXCNC

KMotionXCNC is a modular, browser-based CNC control, CAM, 3D toolpath visualization, and diagnostics Progressive Web App (PWA) for [KMotionX](https://github.com/parhansson/KMotionX) (Dynomotion KFLOP/Kogna controllers) on macOS and Linux.

![KMotionXCNC interface](doc/images/main.png)

## Quick start

If `KMotionX` (`kmxWeb`) and your machine configuration (`~/.kmxrc`) are already set up, build, install, and start the app in one command:

```sh
./build-web.sh prod && ./build-web.sh install && kmxWeb
```

Then open **http://127.0.0.1:8080/** (or **http://localhost:8080/**) in your browser. The app auto-detects local same-origin `kmxWeb` and connects directly.

> **Safety:** Starting `kmxWeb` connects to the controller and may execute your configured startup action. Ensure the machine is ready and its configuration is correct before running it. Closing the browser tab is not an emergency stop.

### Development & testing (no hardware required)

```sh
# Start Vite dev server (connects to the built-in 8-axis simulator by default)
npm run dev

# Run TypeScript typecheck, Vitest unit tests, and installer tests
./build-web.sh test
```

### Documentation

- [Feature Overview](doc/features.md)
- [Architecture](doc/architecture.md)
- [Tech Stack](doc/tech-stack.md)
- [PWA & LAN Deployment Plan](doc/pwa-lan-plan.md)
- [Machine Configuration](machines/README.md)

---

## First-time setup

You install two components on the computer connected to your controller:

- **KMotionX** provides the controller libraries and the `kmxWeb` backend.
- **KMotionXCNC** provides the web interface served by that backend.

You also need a **machine configuration directory**, separate from the installed application, containing your machine settings, G-code programs, C programs, and resources.

### Prerequisites

- Git
- Node.js 22+ and npm
- Python 3
- Compiler, build tools, and USB dependencies required by KMotionX (see the [KMotionX installation guide](https://github.com/parhansson/KMotionX#build-and-install), including Linux USB device rules)

The steps below install under `$HOME/.local` (no administrator privileges required).

### 1. Clone both repositories

```sh
mkdir -p "$HOME/src"
cd "$HOME/src"
git clone https://github.com/parhansson/KMotionX.git
git clone https://github.com/parhansson/KMotionXCNC.git
```

### 2. Build and install KMotionX

```sh
cd "$HOME/src/KMotionX"
./configure
make
make install
```

This installs `$HOME/.local/bin/kmxWeb` together with its libraries, helper programs, and DSP resources. Ensure `$HOME/.local/bin` is on your `PATH` (or invoke `"$HOME/.local/bin/kmxWeb"` directly).

### 3. Build and install the web interface

```sh
cd "$HOME/src/KMotionXCNC"
./build-web.sh prod
./build-web.sh install
```

`./build-web.sh prod` installs locked npm dependencies if needed and builds the production PWA bundle in `apps/web/dist/`. `./build-web.sh install` atomically copies that bundle to:

```text
$HOME/.local/share/kmx/web/
```

### 4. Prepare your machine configuration

The repository includes two example machine directories:

```text
machines/laser/
machines/minirouter/
```

These describe specific machines, not universal defaults. Review kinematics, axis calibration, limits, tool table, and configured actions (especially startup actions) before starting the backend.

Keep your working configuration outside the source checkout. For example, to start from a copy of `machines/laser`:

```sh
cd "$HOME/src/KMotionXCNC"
mkdir -p "$HOME/.kmotionx"
test ! -e "$HOME/.kmotionx/laser" &&
  cp -R machines/laser "$HOME/.kmotionx/laser"
```

The machine root contains:

```text
$HOME/.kmotionx/laser/
├── data/                    # emc.var, Default.tbl, optional Kinematics.txt
├── c-programs/              # Controller C programs
├── gcode/                   # G-code files
└── settings/
    ├── machine.json         # Machine settings and actions
    ├── importcnf.json       # Import/CAM settings
    ├── fonts/               # Optional .ttf/.otf fonts (Text generator & PDF text)
    └── textures/
```

Create or edit `$HOME/.kmxrc` and set `machineDataPath` to the **absolute path** of your machine root (do not use `$HOME`, `~`, or quotes):

```ini
machineDataPath=/Users/alex/.kmotionx/laser
```

You can print the exact path with `printf '%s\n' "$HOME/.kmotionx/laser"`. See [Machine configuration](machines/README.md) for more detail.

### 5. Start the backend bound to loopback

For local-only operation, bind `kmxWeb` explicitly to IPv4 loopback:

```sh
"$HOME/.local/bin/kmxWeb" -listening_port 127.0.0.1:8080
```

Open **http://127.0.0.1:8080/** in your browser. No separate frontend server or `-document_root` flag is needed.

---

## Updating and removing

Before updating, make sure no machine operation is in progress:

```sh
cd "$HOME/src/KMotionXCNC"
./build-web.sh prod
./build-web.sh install
```

Because the app is a safety-gated PWA (`registerType: 'prompt'`), an update will never reload an active session automatically. After reinstalling, click **Reload & Update** in the top banner when the machine is `idle`/`disconnected`.

To remove only the installed web interface:

```sh
./build-web.sh uninstall
```

Frontend install, reinstall, and uninstall never modify your machine root, `~/.kmxrc`, backend libraries, or DSP resources. Do not store machine files inside `$HOME/.local/share/kmx/web/`.

---

## Advanced options

### Custom installation paths & staging

The default prefix is `$HOME/.local`. If KMotionX was configured with a custom `--prefix` or `--sharedir`, pass matching options when installing or uninstalling the frontend:

```sh
./build-web.sh install --prefix=/custom/prefix
./build-web.sh install --prefix=/custom/prefix --sharedir=/custom/resources
```

The destination is `<sharedir>/kmx/web` (where `sharedir` defaults to `<prefix>/share`). `PREFIX` and `SHAREDIR` environment variables are also supported.

For package staging, `DESTDIR` prepends a temporary root without changing runtime paths:

```sh
DESTDIR=/absolute/staging ./build-web.sh install --prefix=/usr/local
```

### Backend environment variables (`kmxWeb`)

- `KMX_WEB_OFFLINE=1`: Starts `kmxWeb` in offline file/UI preview mode (motion RPCs return `403`, file & settings APIs remain active).
- `KMX_JOG_TIMEOUT_MS`: Deadman heartbeat timeout for continuous jogging in milliseconds (`100`–`5000`, default `500`).
- `KMX_ALLOWED_ORIGINS`: Comma-separated list of allowed CORS origins for remote PWA/LAN deployments (defaults to safe same-origin; see [PWA & LAN Deployment Plan](doc/pwa-lan-plan.md)).

---

## Troubleshooting

**The backend reports a missing webroot**

Run `./build-web.sh prod` and `./build-web.sh install`. Make sure frontend and backend use the same installation prefix and share directory.

**The backend cannot load the machine settings**

Check `machineDataPath` in `~/.kmxrc`. It must point to the machine root (not `settings/` or `data/`). The root requires `settings/machine.json`, `data/emc.var`, and `data/Default.tbl`. (`data/Kinematics.txt` is optional — omit or remove it for standard Cartesian kinematics.)

**The file dialog does not show your G-code**

Place files in the selected machine root's `gcode/` directory, not in the installed `web/` directory. File access rejects parent traversal, symlinks, and paths outside the machine root.

**You still see an older version after reinstalling**

Click **Reload & Update** in the PWA update banner (available when the machine is idle/disconnected).

**The installer refuses an existing web directory**

The installer only replaces directories carrying its `.kmx-web-owned` marker. Back up and move aside any older manually installed web directory rather than deleting unknown contents or adding the marker manually.
