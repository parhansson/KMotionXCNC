# Machine-root layout previews

`laser/` and `minirouter/` are independent machine-root previews. Each has the
same internal layout intended after installation:

```text
<machine-root>/
├── data/
│   ├── emc.var
│   ├── Default.tbl
│   └── Kinematics.txt
├── c-programs/
├── gcode/
└── settings/
    ├── machine.json
    ├── importcnf.json
    ├── fonts/
    └── textures/
```

Each `data/emc.var`
is an exact copy of `KMotionX/KMotion/Data/emc.var` from the sibling repository.
The tool table remains a copy of the KMotionX default-machine template.
The complete configurations have not been hardware-verified; review the tool
table, actions and motion parameters before physical use. The updated backend/frontend support this
layout for local preview. No machine has been activated.

The original `settings/` directory is unchanged. Each machine JSON is copied
from its legacy `settings/machines/*.cnf`, with only action file paths changed
to machine-root-relative `c-programs/...`. Referenced sources are copied,
including BlinkKFLOP from KMotionX instead of its old absolute user path.
Minirouter retains its referenced LaserPPI source even though its M100 action
is disabled. Generated `.out` files are deliberately excluded.

Both roots receive independent copies of the existing import settings, fonts
(TTF and OTF), and textures. The shared import settings include laser-oriented
material presets and initialization code; the minirouter copy needs review,
not silent conversion to guessed router values.

The legacy `setup.cnf` selects laser and `gcode/DynoMotion.ngc`, so that G-code
file is copied only into laser. Minirouter's G-code directory starts empty.
Neither root selects or executes a G-code file automatically.

`setup.cnf` is not copied: the intended active-root selector is `~/.kmxrc`.
The updated browser resource URLs and backend file APIs resolve from the
selected machine, not the static webbundle.

## Installed application

Build and install KMotionX with `make` and `make install`. Build this frontend
with `./build-web.sh prod`, then install it with `./build-web.sh install`.
In `~/.kmxrc`, set the absolute path to your working machine root. For example,
if your home directory is `/home/alex` and you copied the laser configuration
to `.kmotionx/laser`:

```ini
machineDataPath=/home/alex/.kmotionx/laser
```

With the default installation prefix, run:

```sh
"$HOME/.local/bin/kmxWeb" -listening_port 127.0.0.1:8080
```

Replace the example path with your own machine root. The configuration value
must be an absolute path; `$HOME` and `~` are not expanded.
Open `http://127.0.0.1:8080/`.
The backend connects to hardware and may run the configured startup action.
Check the configuration and ensure the machine is ready before starting.
Saving files in the GUI modifies the selected machine root.

The backend starts with no G-code selected. Open a file from `gcode/` in the GUI.
Settings always load/save `settings/machine.json`; editing the display name
does not switch machines. Import settings use `settings/importcnf.json`.
Machine switching through `setup.cnf` or the GUI is no longer supported.

By default the backend expects the webbundle at its configured
`$prefix/share/kmx/web`. Run `./build-web.sh prod` followed by
`./build-web.sh install` in the frontend repository to install there.
Use the same `--prefix`/`--sharedir` as the backend. Installation copies only the
webbundle; these machine directories remain separate and are never overwritten.

## Migrating a legacy machine

Keep a backup of the original `settings/` and G-code files. For each machine,
create a separate root with the layout above, copy its selected legacy
`settings/machines/*.cnf` to `settings/machine.json`, and copy `import.cnf` to
`settings/importcnf.json`. Copy referenced C sources into `c-programs/` and
change action paths to `c-programs/<name>` (including old absolute paths).
Copy desired G-code files to `gcode/`, fonts to `settings/fonts/`, and textures
to `settings/textures/`. Supply `data/emc.var`, `data/Default.tbl` and the
confirmed `data/Kinematics.txt`. Never overwrite files in an existing root
without reviewing their differences.

Select the resulting root in `.kmxrc`; `setup.cnf` is no longer used. Its old
`gcodefile` value can identify a program to copy, but the GUI starts without a
selected program. Review the migrated configuration before starting the backend.

HTTP machine file access rejects parent traversal, symlinks, paths outside the
selected root, and resolved paths of 256 bytes or more (legacy backend limit).
This is a local, trusted-user application, not an authenticated remote service.
Bind it to loopback; do not expose it on an untrusted network. Concurrent local
filesystem mutation by an untrusted user is not a supported isolation boundary.
