import importlib.util
import os
from pathlib import Path
import tempfile
import unittest

# Avoid generating __pycache__ artifacts in the checkout.
import sys
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("install_web", Path(__file__).with_name("install-web.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class WebInstallTests(unittest.TestCase):
    def test_install_reinstall_uninstall(self):
        with tempfile.TemporaryDirectory(dir=os.environ.get("TMPDIR")) as temp:
            root = Path(temp)
            source = root / "build"
            source.mkdir()
            (source / "index.html").write_text("frontend")
            (source / "old.js").write_text("old")
            prefix = root / "prefix with spaces"
            sibling = prefix / "share/kmx/DSP_KFLOP/keep"
            sibling.parent.mkdir(parents=True)
            sibling.write_text("DSP")
            machine = root / ".kmotionx/default-machine/settings/machine.json"
            machine.parent.mkdir(parents=True)
            machine.write_text("user settings")
            dest = module.install("install", source, str(prefix))
            self.assertEqual(dest, prefix / "share/kmx/web")
            self.assertEqual((dest / "index.html").read_text(), "frontend")
            (source / "old.js").unlink()
            (source / "new.js").write_text("new")
            module.install("install", source, str(prefix))
            self.assertFalse((dest / "old.js").exists())
            self.assertTrue((dest / "new.js").exists())
            module.install("uninstall", source, str(prefix))
            self.assertFalse(dest.exists())
            self.assertEqual(sibling.read_text(), "DSP")
            self.assertEqual(machine.read_text(), "user settings")

    def test_staging_custom_sharedir_and_ownership(self):
        with tempfile.TemporaryDirectory(dir=os.environ.get("TMPDIR")) as temp:
            root = Path(temp)
            source = root / "build"
            source.mkdir()
            (source / "index.html").write_text("frontend")
            share = root / "real share"
            stage = root / "staging"
            dest = module.install("install", source, "/usr/local", str(share), str(stage))
            self.assertEqual(dest, stage / share.relative_to("/") / "kmx/web")
            self.assertFalse(share.exists())
            (dest / module.MARKER).unlink()
            for mode in ("install", "uninstall"):
                with self.assertRaisesRegex(ValueError, "unowned"):
                    module.install(mode, source, "/usr/local", str(share), str(stage))
            with self.assertRaises(ValueError):
                module.install("install", source, "relative")
            with self.assertRaises(ValueError):
                module.install("install", source, "/usr/local", destdir="/tmp/../bad")

    def test_missing_bundle_and_symlink_destination(self):
        with tempfile.TemporaryDirectory(dir=os.environ.get("TMPDIR")) as temp:
            root = Path(temp)
            source = root / "build"
            source.mkdir()
            with self.assertRaisesRegex(ValueError, "bundle missing"):
                module.install("install", source, str(root))
            (source / "index.html").write_text("frontend")
            target = root / "share/kmx/web"
            target.parent.mkdir(parents=True)
            target.symlink_to(source, target_is_directory=True)
            with self.assertRaisesRegex(ValueError, "symlink"):
                module.install("install", source, str(root))
            self.assertTrue((source / "index.html").exists())


if __name__ == "__main__":
    unittest.main()
