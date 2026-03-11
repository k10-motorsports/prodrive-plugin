#!/usr/bin/env python3
"""
Installer test suite for install.bat and export.bat.

Creates a fake SimHub directory structure, runs the installer against it,
and verifies every expected file lands in the right place with the right
content.  Then runs the export tool in reverse and verifies the repo
is updated correctly.

Runs on any OS (the .bat files are tested via structural validation,
not subprocess execution, since batch files are Windows-only). On Windows,
the tests can optionally execute the real .bat files against the fake
SimHub directory.

Usage:
    python tools/test_installer.py                 # structural tests only
    python tools/test_installer.py --live           # also execute .bat files (Windows only)
"""

import argparse
import json
import os
import platform
import shutil
import subprocess
import sys
import tempfile
import unittest

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

INSTALL_BAT = os.path.join(REPO_ROOT, "install.bat")
EXPORT_BAT = os.path.join(REPO_ROOT, "export.bat")

# Files the installer is expected to copy TO SimHub
INSTALL_MANIFEST = {
    "dll": "MediaCoach.Plugin.dll",
    "pdb": "MediaCoach.Plugin.pdb",  # optional
    "dataset_files": [
        "dataset/commentary_topics.json",
        "dataset/commentary_fragments.json",
        "dataset/sentiments.json",
        "dataset/channel_notes.json",
        "dataset/commentary_sources.json",
    ],
    "dashboard_files": [
        "DashTemplates/media coach/media coach.djson",
        "DashTemplates/media coach/media coach.djson.png",
        "DashTemplates/media coach/media coach.djson.00.png",
        "DashTemplates/media coach/media coach.djson.metadata",
        "DashTemplates/media coach/JavascriptExtensions/sample.js",
        "DashTemplates/media coach/_SHFonts/DymoFontInvers.ttf",
        "DashTemplates/media coach/_SHFonts/eurostyle-normal.ttf",
    ],
}

# Files the export tool copies FROM SimHub back to the repo
EXPORT_MANIFEST = {
    "dll": "MediaCoach.Plugin.dll",
    "pdb": "MediaCoach.Plugin.pdb",
    "dashboard_root": "DashTemplates/media coach",
}


def repo_file_exists(relpath):
    """Check if a file exists in the real repo."""
    return os.path.isfile(os.path.join(REPO_ROOT, relpath))


# ---------------------------------------------------------------------------
# Fake SimHub directory builder
# ---------------------------------------------------------------------------

def create_fake_simhub(tmpdir):
    """
    Build a minimal fake SimHub installation directory.
    Returns the path to the fake SimHub root.
    """
    simhub = os.path.join(tmpdir, "SimHub")
    os.makedirs(simhub)

    # SimHub needs SimHubWPF.exe to be detected by the installer
    exe_path = os.path.join(simhub, "SimHubWPF.exe")
    with open(exe_path, "w") as f:
        f.write("fake")

    # SimHub-provided DLLs the plugin references (not copied by installer,
    # but needed if we ever test the build process)
    for dll in ["GameReaderCommon.dll", "SimHub.Plugins.dll",
                "SimHub.Logging.dll", "Newtonsoft.Json.dll", "log4net.dll"]:
        with open(os.path.join(simhub, dll), "w") as f:
            f.write("fake")

    return simhub


def create_fake_simhub_with_built_files(tmpdir):
    """
    Build a fake SimHub directory that contains built plugin files,
    as if a dotnet build just ran.  Used for testing export.bat.
    """
    simhub = create_fake_simhub(tmpdir)

    # DLL + PDB (write recognizable content so we can verify the copy)
    with open(os.path.join(simhub, "MediaCoach.Plugin.dll"), "wb") as f:
        f.write(b"BUILT_DLL_CONTENT_12345")
    with open(os.path.join(simhub, "MediaCoach.Plugin.pdb"), "wb") as f:
        f.write(b"BUILT_PDB_CONTENT_12345")

    # Dashboard files (simulating SimHub having modified them)
    dash_dir = os.path.join(simhub, "DashTemplates", "media coach")
    os.makedirs(dash_dir, exist_ok=True)
    with open(os.path.join(dash_dir, "media coach.djson"), "w") as f:
        f.write('{"modified_in_simhub": true}')
    with open(os.path.join(dash_dir, "media coach.djson.png"), "wb") as f:
        f.write(b"PNG_UPDATED")
    with open(os.path.join(dash_dir, "media coach.djson.00.png"), "wb") as f:
        f.write(b"PNG_THUMB_UPDATED")
    with open(os.path.join(dash_dir, "media coach.djson.metadata"), "w") as f:
        f.write('{"metadata": "updated"}')

    js_dir = os.path.join(dash_dir, "JavascriptExtensions")
    os.makedirs(js_dir, exist_ok=True)
    with open(os.path.join(js_dir, "sample.js"), "w") as f:
        f.write("// updated in simhub")

    fonts_dir = os.path.join(dash_dir, "_SHFonts")
    os.makedirs(fonts_dir, exist_ok=True)
    with open(os.path.join(fonts_dir, "DymoFontInvers.ttf"), "wb") as f:
        f.write(b"FONT_UPDATED")
    with open(os.path.join(fonts_dir, "eurostyle-normal.ttf"), "wb") as f:
        f.write(b"FONT2_UPDATED")

    # Backups directory (should NOT be exported)
    backups_dir = os.path.join(dash_dir, "_Backups")
    os.makedirs(backups_dir, exist_ok=True)
    with open(os.path.join(backups_dir, "media coach_b1.djson"), "w") as f:
        f.write("backup content - should not be copied")

    return simhub


# ===================================================================
# Tests: Structural Validation (any OS)
# ===================================================================

class TestInstallerStructure(unittest.TestCase):
    """Validate that install.bat exists, is well-formed, and that all
    files it references actually exist in the repo."""

    def test_install_bat_exists(self):
        self.assertTrue(os.path.isfile(INSTALL_BAT),
                        "install.bat missing from repo root")

    def test_export_bat_exists(self):
        self.assertTrue(os.path.isfile(EXPORT_BAT),
                        "export.bat missing from repo root")

    def test_install_bat_references_correct_dll(self):
        with open(INSTALL_BAT, "r") as f:
            content = f.read()
        self.assertIn("MediaCoach.Plugin.dll", content)

    def test_install_bat_references_dataset(self):
        with open(INSTALL_BAT, "r") as f:
            content = f.read()
        self.assertIn("dataset", content)

    def test_install_bat_references_dashtemplates(self):
        with open(INSTALL_BAT, "r") as f:
            content = f.read()
        self.assertIn("DashTemplates", content)

    def test_install_bat_checks_simhub_exe(self):
        with open(INSTALL_BAT, "r") as f:
            content = f.read()
        self.assertIn("SimHubWPF.exe", content,
                      "Installer should verify SimHub is installed")

    def test_install_bat_checks_running_process(self):
        with open(INSTALL_BAT, "r") as f:
            content = f.read()
        self.assertIn("tasklist", content,
                      "Installer should check if SimHub is running")

    def test_install_bat_has_error_handling(self):
        with open(INSTALL_BAT, "r") as f:
            content = f.read()
        self.assertIn(":error", content,
                      "Installer should have error label")
        self.assertIn("exit /b 1", content,
                      "Installer should exit with code 1 on error")

    def test_install_bat_has_success_exit(self):
        with open(INSTALL_BAT, "r") as f:
            content = f.read()
        self.assertIn("exit /b 0", content,
                      "Installer should exit with code 0 on success")

    def test_install_bat_checks_simhub_path_env(self):
        with open(INSTALL_BAT, "r") as f:
            content = f.read()
        self.assertIn("SIMHUB_PATH", content,
                      "Installer should respect SIMHUB_PATH environment variable")

    def test_install_bat_checks_default_locations(self):
        with open(INSTALL_BAT, "r") as f:
            content = f.read()
        self.assertIn("Program Files (x86)", content)
        self.assertIn("Program Files", content)


class TestExportStructure(unittest.TestCase):
    """Validate that export.bat is well-formed."""

    def test_export_bat_references_dll(self):
        with open(EXPORT_BAT, "r") as f:
            content = f.read()
        self.assertIn("MediaCoach.Plugin.dll", content)

    def test_export_bat_references_pdb(self):
        with open(EXPORT_BAT, "r") as f:
            content = f.read()
        self.assertIn("MediaCoach.Plugin.pdb", content)

    def test_export_bat_references_dashtemplates(self):
        with open(EXPORT_BAT, "r") as f:
            content = f.read()
        self.assertIn("DashTemplates", content)

    def test_export_bat_excludes_backups(self):
        with open(EXPORT_BAT, "r") as f:
            content = f.read()
        self.assertIn("_Backups", content,
                      "Export should explicitly exclude _Backups directory")

    def test_export_bat_checks_simhub_exe(self):
        with open(EXPORT_BAT, "r") as f:
            content = f.read()
        self.assertIn("SimHubWPF.exe", content,
                      "Export should verify SimHub directory is valid")

    def test_export_bat_has_error_handling(self):
        with open(EXPORT_BAT, "r") as f:
            content = f.read()
        self.assertIn(":error", content)
        self.assertIn("exit /b 1", content)


class TestRepoSourceFiles(unittest.TestCase):
    """Verify all files referenced by the installer exist in the repo."""

    def test_dll_exists(self):
        self.assertTrue(repo_file_exists(INSTALL_MANIFEST["dll"]),
                        f"{INSTALL_MANIFEST['dll']} missing from repo root")

    def test_dataset_files_exist(self):
        for relpath in INSTALL_MANIFEST["dataset_files"]:
            self.assertTrue(repo_file_exists(relpath),
                            f"{relpath} missing from repo")

    def test_dashboard_files_exist(self):
        for relpath in INSTALL_MANIFEST["dashboard_files"]:
            self.assertTrue(repo_file_exists(relpath),
                            f"{relpath} missing from repo")

    def test_dataset_json_files_are_valid(self):
        """Every JSON file in the dataset folder should parse without error."""
        for relpath in INSTALL_MANIFEST["dataset_files"]:
            fullpath = os.path.join(REPO_ROOT, relpath)
            with open(fullpath, "r", encoding="utf-8") as f:
                try:
                    data = json.load(f)
                    self.assertIsInstance(data, dict,
                                         f"{relpath} root should be an object")
                except json.JSONDecodeError as e:
                    self.fail(f"{relpath} is invalid JSON: {e}")


# ===================================================================
# Tests: Simulated Install (any OS)
# ===================================================================

class TestSimulatedInstall(unittest.TestCase):
    """
    Simulate the installer's file operations in Python to verify
    the install manifest is correct and complete.
    """

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp(prefix="mediacoach_test_")
        self.simhub = create_fake_simhub(self.tmpdir)

    def tearDown(self):
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def _simulate_install(self):
        """Replicate what install.bat does using Python file operations."""
        # Step 1: Copy DLL
        src = os.path.join(REPO_ROOT, "MediaCoach.Plugin.dll")
        dst = os.path.join(self.simhub, "MediaCoach.Plugin.dll")
        shutil.copy2(src, dst)

        # Step 1b: Copy PDB if present
        pdb_src = os.path.join(REPO_ROOT, "MediaCoach.Plugin.pdb")
        if os.path.exists(pdb_src):
            shutil.copy2(pdb_src, os.path.join(self.simhub, "MediaCoach.Plugin.pdb"))

        # Step 2: Copy dataset
        dataset_src = os.path.join(REPO_ROOT, "dataset")
        dataset_dst = os.path.join(self.simhub, "dataset")
        shutil.copytree(dataset_src, dataset_dst, dirs_exist_ok=True)

        # Step 3: Copy DashTemplates
        dash_src = os.path.join(REPO_ROOT, "DashTemplates")
        dash_dst = os.path.join(self.simhub, "DashTemplates")
        shutil.copytree(dash_src, dash_dst, dirs_exist_ok=True)

    def test_dll_installed(self):
        self._simulate_install()
        dll = os.path.join(self.simhub, "MediaCoach.Plugin.dll")
        self.assertTrue(os.path.isfile(dll))
        # Verify content matches repo
        with open(os.path.join(REPO_ROOT, "MediaCoach.Plugin.dll"), "rb") as f:
            repo_content = f.read()
        with open(dll, "rb") as f:
            installed_content = f.read()
        self.assertEqual(repo_content, installed_content,
                         "Installed DLL content should match repo DLL")

    def test_pdb_installed(self):
        self._simulate_install()
        pdb = os.path.join(self.simhub, "MediaCoach.Plugin.pdb")
        self.assertTrue(os.path.isfile(pdb))

    def test_all_dataset_files_installed(self):
        self._simulate_install()
        for relpath in INSTALL_MANIFEST["dataset_files"]:
            fullpath = os.path.join(self.simhub, relpath)
            self.assertTrue(os.path.isfile(fullpath),
                            f"Expected {relpath} in SimHub directory")

    def test_dataset_json_valid_after_install(self):
        """Installed JSON files should still be valid JSON."""
        self._simulate_install()
        for relpath in INSTALL_MANIFEST["dataset_files"]:
            fullpath = os.path.join(self.simhub, relpath)
            with open(fullpath, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.assertIsInstance(data, dict)

    def test_all_dashboard_files_installed(self):
        self._simulate_install()
        for relpath in INSTALL_MANIFEST["dashboard_files"]:
            fullpath = os.path.join(self.simhub, relpath)
            self.assertTrue(os.path.isfile(fullpath),
                            f"Expected {relpath} in SimHub directory")

    def test_simhub_own_dlls_not_overwritten(self):
        """The installer should not overwrite SimHub's own DLLs."""
        self._simulate_install()
        for dll in ["GameReaderCommon.dll", "SimHub.Plugins.dll",
                     "SimHub.Logging.dll", "Newtonsoft.Json.dll", "log4net.dll"]:
            fullpath = os.path.join(self.simhub, dll)
            with open(fullpath, "r") as f:
                content = f.read()
            self.assertEqual(content, "fake",
                             f"{dll} should not be overwritten by installer")

    def test_install_is_idempotent(self):
        """Running the install twice should not cause errors."""
        self._simulate_install()
        self._simulate_install()  # second run

        # All files should still be present
        dll = os.path.join(self.simhub, "MediaCoach.Plugin.dll")
        self.assertTrue(os.path.isfile(dll))
        for relpath in INSTALL_MANIFEST["dataset_files"]:
            self.assertTrue(os.path.isfile(os.path.join(self.simhub, relpath)))


# ===================================================================
# Tests: Simulated Export (any OS)
# ===================================================================

class TestSimulatedExport(unittest.TestCase):
    """
    Simulate the export tool's file operations in Python to verify
    built files are correctly copied back to the repo.
    """

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp(prefix="mediacoach_export_test_")
        self.simhub = create_fake_simhub_with_built_files(self.tmpdir)

        # Create a fake repo directory to export into
        self.fake_repo = os.path.join(self.tmpdir, "repo")
        os.makedirs(self.fake_repo)
        os.makedirs(os.path.join(self.fake_repo, "DashTemplates"), exist_ok=True)

    def tearDown(self):
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def _simulate_export(self):
        """Replicate what export.bat does using Python file operations."""
        # Copy DLL + PDB from SimHub to repo root
        for fname in ["MediaCoach.Plugin.dll", "MediaCoach.Plugin.pdb"]:
            src = os.path.join(self.simhub, fname)
            dst = os.path.join(self.fake_repo, fname)
            if os.path.exists(src):
                shutil.copy2(src, dst)

        # Copy DashTemplates (excluding _Backups)
        dash_src = os.path.join(self.simhub, "DashTemplates", "media coach")
        dash_dst = os.path.join(self.fake_repo, "DashTemplates", "media coach")
        if os.path.isdir(dash_src):
            shutil.copytree(dash_src, dash_dst, dirs_exist_ok=True,
                            ignore=shutil.ignore_patterns("_Backups"))

    def test_dll_exported(self):
        self._simulate_export()
        dll = os.path.join(self.fake_repo, "MediaCoach.Plugin.dll")
        self.assertTrue(os.path.isfile(dll))
        with open(dll, "rb") as f:
            self.assertEqual(f.read(), b"BUILT_DLL_CONTENT_12345")

    def test_pdb_exported(self):
        self._simulate_export()
        pdb = os.path.join(self.fake_repo, "MediaCoach.Plugin.pdb")
        self.assertTrue(os.path.isfile(pdb))
        with open(pdb, "rb") as f:
            self.assertEqual(f.read(), b"BUILT_PDB_CONTENT_12345")

    def test_dashboard_exported(self):
        self._simulate_export()
        djson = os.path.join(self.fake_repo, "DashTemplates", "media coach",
                             "media coach.djson")
        self.assertTrue(os.path.isfile(djson))
        with open(djson, "r") as f:
            data = json.load(f)
        self.assertTrue(data.get("modified_in_simhub"))

    def test_dashboard_assets_exported(self):
        self._simulate_export()
        assets = [
            "media coach.djson.png",
            "media coach.djson.00.png",
            "media coach.djson.metadata",
            "JavascriptExtensions/sample.js",
            "_SHFonts/DymoFontInvers.ttf",
            "_SHFonts/eurostyle-normal.ttf",
        ]
        for asset in assets:
            fullpath = os.path.join(self.fake_repo, "DashTemplates",
                                    "media coach", asset)
            self.assertTrue(os.path.isfile(fullpath),
                            f"Expected {asset} to be exported")

    def test_backups_not_exported(self):
        """_Backups directory should NOT be copied to the repo."""
        self._simulate_export()
        backups = os.path.join(self.fake_repo, "DashTemplates",
                               "media coach", "_Backups")
        self.assertFalse(os.path.isdir(backups),
                         "_Backups directory should not be exported to repo")

    def test_export_does_not_touch_dataset(self):
        """Dataset files live in the repo and are pushed TO SimHub.
        Export should never copy dataset FROM SimHub back to repo."""
        self._simulate_export()
        dataset_dir = os.path.join(self.fake_repo, "dataset")
        self.assertFalse(os.path.isdir(dataset_dir),
                         "Export should not copy dataset from SimHub to repo")


# ===================================================================
# Tests: Live Execution (Windows only)
# ===================================================================

class TestLiveInstall(unittest.TestCase):
    """
    Actually run install.bat against a fake SimHub directory.
    Only runs on Windows with --live flag.
    """

    @classmethod
    def setUpClass(cls):
        if platform.system() != "Windows":
            raise unittest.SkipTest("Live .bat tests require Windows")
        if not getattr(cls, "_live_mode", False):
            raise unittest.SkipTest("Live tests require --live flag")

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp(prefix="mediacoach_live_")
        self.simhub = create_fake_simhub(self.tmpdir)

    def tearDown(self):
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def test_install_bat_succeeds(self):
        """Run install.bat with SIMHUB_PATH pointing to fake directory."""
        env = os.environ.copy()
        env["SIMHUB_PATH"] = self.simhub

        result = subprocess.run(
            ["cmd", "/c", INSTALL_BAT],
            env=env,
            capture_output=True,
            text=True,
            timeout=30,
            input="",  # no interactive input
        )

        # Check output contains success markers
        self.assertIn("Installation complete", result.stdout,
                      f"Install failed. stdout:\n{result.stdout}\nstderr:\n{result.stderr}")
        self.assertEqual(result.returncode, 0)

        # Verify files landed
        self.assertTrue(os.path.isfile(
            os.path.join(self.simhub, "MediaCoach.Plugin.dll")))
        self.assertTrue(os.path.isdir(
            os.path.join(self.simhub, "dataset")))

    def test_install_bat_fails_without_dll(self):
        """If the DLL is missing from repo root, installer should fail."""
        env = os.environ.copy()
        env["SIMHUB_PATH"] = self.simhub

        # Rename the DLL temporarily
        dll = os.path.join(REPO_ROOT, "MediaCoach.Plugin.dll")
        dll_backup = dll + ".testbackup"
        os.rename(dll, dll_backup)
        try:
            result = subprocess.run(
                ["cmd", "/c", INSTALL_BAT],
                env=env,
                capture_output=True,
                text=True,
                timeout=30,
                input="",
            )
            self.assertNotEqual(result.returncode, 0,
                                "Installer should fail when DLL is missing")
        finally:
            os.rename(dll_backup, dll)

    def test_export_bat_succeeds(self):
        """Run export.bat from a fake SimHub with built files."""
        # Create SimHub with built files
        shutil.rmtree(self.simhub)
        self.simhub = create_fake_simhub_with_built_files(self.tmpdir)

        env = os.environ.copy()
        env["SIMHUB_PATH"] = self.simhub

        result = subprocess.run(
            ["cmd", "/c", EXPORT_BAT],
            env=env,
            capture_output=True,
            text=True,
            timeout=30,
            input="",
        )

        self.assertIn("Export complete", result.stdout,
                      f"Export failed. stdout:\n{result.stdout}\nstderr:\n{result.stderr}")
        self.assertEqual(result.returncode, 0)


# -------------------------------------------------------------------
# Main
# -------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test installer and export tools")
    parser.add_argument("--live", action="store_true",
                        help="Run live .bat execution tests (Windows only)")
    args, remaining = parser.parse_known_args()

    if args.live:
        TestLiveInstall._live_mode = True

    # Pass remaining args to unittest
    sys.argv = [sys.argv[0]] + remaining
    unittest.main(verbosity=2)
