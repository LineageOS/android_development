# Copyright (C) 2025 The Android Open Source Project
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import pathlib
import tempfile
import unittest

import source_trimmer


class SourceTrimmerTest(unittest.TestCase):
    def setUp(self):
        self.manifest_content = """<?xml version="1.0" encoding="UTF-8"?>
<manifest>
  <project groups="pdk" name="platform/bionic" path="bionic" remote="ohd" />
  <project groups="pdk-fs,pdk" name="platform/bootable/recovery" path="bootable/recovery" remote="ohd" />
  <project groups="pdk-desktop" name="platform/build" path="build/make" remote="ohd" />
  <project name="platform/system/core" path="system/core" remote="ohd" />
  <project groups="group1" name="platform/lib/foo" path="external/foo" remote="ohd" />
  <project groups="group1,group2" name="platform/lib/bar" remote="ohd" />
</manifest>
"""

    def test_get_projects_from_manifest(self):
        """Test that the manifest is parsed correctly."""
        projects = source_trimmer.get_projects_from_manifest(self.manifest_content)
        expected_projects = [
            {"name": "platform/bionic", "path": "bionic", "groups": ["pdk"]},
            {
                "name": "platform/bootable/recovery",
                "path": "bootable/recovery",
                "groups": ["pdk-fs", "pdk"],
            },
            {
                "name": "platform/build",
                "path": "build/make",
                "groups": ["pdk-desktop"],
            },
            {"name": "platform/system/core", "path": "system/core", "groups": []},
            {
                "name": "platform/lib/foo",
                "path": "external/foo",
                "groups": ["group1"],
            },
            {
                "name": "platform/lib/bar",
                "path": "platform/lib/bar",
                "groups": ["group1", "group2"],
            },
        ]
        self.assertEqual(projects, expected_projects)

    def test_find_projects_to_remove(self):
        """Test that the projects to remove are identified correctly."""
        all_projects = source_trimmer.get_projects_from_manifest(self.manifest_content)
        groups_to_keep = ["pdk"]
        projects_to_remove = source_trimmer.find_projects_to_remove(
            all_projects, groups_to_keep
        )
        # platform/bionic and platform/bootable/recovery should be kept.
        expected_to_remove = [
            {
                "name": "platform/build",
                "path": "build/make",
                "groups": ["pdk-desktop"],
            },
            {"name": "platform/system/core", "path": "system/core", "groups": []},
            {
                "name": "platform/lib/foo",
                "path": "external/foo",
                "groups": ["group1"],
            },
            {
                "name": "platform/lib/bar",
                "path": "platform/lib/bar",
                "groups": ["group1", "group2"],
            },
        ]
        self.assertEqual(projects_to_remove, expected_to_remove)

    def test_find_projects_to_remove_multiple_groups(self):
        """Test that the projects to remove are identified correctly when multiple groups are specified."""
        all_projects = source_trimmer.get_projects_from_manifest(self.manifest_content)
        groups_to_keep = ["pdk", "pdk-desktop"]
        projects_to_remove = source_trimmer.find_projects_to_remove(
            all_projects, groups_to_keep
        )
        # platform/bionic, platform/bootable/recovery and platform/build should be kept.
        expected_to_remove = [
            {"name": "platform/system/core", "path": "system/core", "groups": []},
            {
                "name": "platform/lib/foo",
                "path": "external/foo",
                "groups": ["group1"],
            },
            {
                "name": "platform/lib/bar",
                "path": "platform/lib/bar",
                "groups": ["group1", "group2"],
            },
        ]
        self.assertEqual(projects_to_remove, expected_to_remove)

    def test_remove_project_directories(self):
        """Test that the project directories are removed correctly."""
        projects_to_remove = [
            {
                "name": "platform/build",
                "path": "build/make",
                "groups": ["pdk-desktop"],
            },
            {"name": "platform/system/core", "path": "system/core", "groups": []},
        ]
        with tempfile.TemporaryDirectory() as tmpdir:
            checkout_root = pathlib.Path(tmpdir)
            # Create dummy project directories.
            (checkout_root / "build/make").mkdir(parents=True)
            (checkout_root / "system/core").mkdir(parents=True)
            (checkout_root / "bionic").mkdir(parents=True)  # Should be kept.

            source_trimmer.remove_project_directories(projects_to_remove, checkout_root)

            self.assertFalse((checkout_root / "build/make").exists())
            self.assertFalse((checkout_root / "system/core").exists())
            self.assertTrue((checkout_root / "bionic").exists())
            # Check that empty parent 'build' is also removed.
            self.assertFalse((checkout_root / "build").exists())

    def test_remove_project_directories_dry_run(self):
        """Test that the project directories are not removed in dry run mode."""
        projects_to_remove = [
            {
                "name": "platform/build",
                "path": "build/make",
                "groups": ["pdk-desktop"],
            },
        ]
        with tempfile.TemporaryDirectory() as tmpdir:
            checkout_root = pathlib.Path(tmpdir)
            (checkout_root / "build/make").mkdir(parents=True)

            source_trimmer.remove_project_directories(
                projects_to_remove, checkout_root, dry_run=True
            )

            self.assertTrue((checkout_root / "build/make").exists())
            self.assertTrue((checkout_root / "build").exists())

    def test_keep_projects_overrides_removal(self):
        """Test that projects to keep are not removed, even if they would be marked for removal."""
        # These projects would be marked for removal by find_projects_to_remove.
        projects_to_remove = [
            {
                "name": "platform/build",
                "path": "build/make",
                "groups": ["pdk-desktop"],
            },
            {"name": "platform/system/core", "path": "system/core", "groups": []},
            {
                "name": "platform/lib/foo",
                "path": "external/foo",
                "groups": ["another-group"],
            },
        ]
        keep_project_names = set(["platform/system/core", "platform/lib/foo"])

        # This logic is what's in the main() function of the script.
        final_projects_to_remove = [
            p for p in projects_to_remove if p["name"] not in keep_project_names
        ]

        self.assertEqual(len(final_projects_to_remove), 1)
        self.assertEqual(final_projects_to_remove[0]["name"], "platform/build")

    def test_process_groups(self):
        """Tests various scenarios for process_groups_to_keep."""
        test_cases = [
            ("single", ["pdk"], ["pdk"]),
            ("comma_separated", ["pdk,pdk-fs"], ["pdk", "pdk-fs"]),
            ("space_separated", ["pdk pdk-fs"], ["pdk", "pdk-fs"]),
            (
                "mixed_separators",
                ["pdk, pdk-fs   pdk-desktop"],
                ["pdk", "pdk-fs", "pdk-desktop"],
            ),
            (
                "multiple_args",
                ["pdk,pdk-fs", "pdk-desktop"],
                ["pdk", "pdk-fs", "pdk-desktop"],
            ),
            ("extra_spaces", ["  pdk ,  pdk-fs  "], ["pdk", "pdk-fs"]),
            ("ignore_empty", ["pdk,, pdk-fs", "", " "], ["pdk", "pdk-fs"]),
            ("empty_input", [], []),
            ("only_separators", [", ,", "  ", ","], []),
        ]

        for name, raw_groups, expected in test_cases:
            with self.subTest(name=name):
                result = source_trimmer.process_groups_to_keep(raw_groups)
                self.assertEqual(result, expected, msg=f"Failed test case: {name}")


if __name__ == "__main__":
    unittest.main()
