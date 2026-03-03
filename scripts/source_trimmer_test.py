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
        self.manifest_with_ops = """<?xml version="1.0" encoding="UTF-8"?>
<manifest>
  <project groups="pdk" name="platform/bionic" path="bionic">
    <copyfile src="INSTRUCTIONS" dest="BIONIC_INSTRUCTIONS"/>
  </project>
  <project groups="group1" name="platform/vendor/foo" path="vendor/foo">
    <linkfile src="common/Android.bp" dest="vendor/foo/Android.bp"/>
    <copyfile src="data/file.txt" dest="data/foo/file.txt"/>
  </project>
  <project groups="group2" name="platform/vendor/bar" path="vendor/bar">
    <linkfile src="this/points/nowhere" dest="dangling_link"/>
  </project>
</manifest>
"""

    def test_get_projects_from_manifest(self):
        """Test that the manifest is parsed correctly."""
        projects = source_trimmer.get_projects_from_manifest(self.manifest_content)
        expected_projects = [
            source_trimmer.Project(
                name="platform/bionic", path="bionic", groups=["pdk"], operations=[]
            ),
            source_trimmer.Project(
                name="platform/bootable/recovery",
                path="bootable/recovery",
                groups=["pdk-fs", "pdk"],
                operations=[],
            ),
            source_trimmer.Project(
                name="platform/build",
                path="build/make",
                groups=["pdk-desktop"],
                operations=[],
            ),
            source_trimmer.Project(
                name="platform/system/core",
                path="system/core",
                groups=[],
                operations=[],
            ),
            source_trimmer.Project(
                name="platform/lib/foo",
                path="external/foo",
                groups=["group1"],
                operations=[],
            ),
            source_trimmer.Project(
                name="platform/lib/bar",
                path="platform/lib/bar",
                groups=["group1", "group2"],
                operations=[],
            ),
        ]
        self.assertEqual(projects, expected_projects)

    def test_get_projects_from_manifest_with_operations(self):
        """Test parsing linkfile/copyfile operations."""
        projects = source_trimmer.get_projects_from_manifest(self.manifest_with_ops)
        expected_projects = [
            source_trimmer.Project(
                name="platform/bionic",
                path="bionic",
                groups=["pdk"],
                operations=[
                    source_trimmer.FileOperation(
                        type=source_trimmer.OperationType.COPYFILE,
                        src="INSTRUCTIONS",
                        dest="BIONIC_INSTRUCTIONS",
                    )
                ],
            ),
            source_trimmer.Project(
                name="platform/vendor/foo",
                path="vendor/foo",
                groups=["group1"],
                operations=[
                    source_trimmer.FileOperation(
                        type=source_trimmer.OperationType.LINKFILE,
                        src="common/Android.bp",
                        dest="vendor/foo/Android.bp",
                    ),
                    source_trimmer.FileOperation(
                        type=source_trimmer.OperationType.COPYFILE,
                        src="data/file.txt",
                        dest="data/foo/file.txt",
                    ),
                ],
            ),
            source_trimmer.Project(
                name="platform/vendor/bar",
                path="vendor/bar",
                groups=["group2"],
                operations=[
                    source_trimmer.FileOperation(
                        type=source_trimmer.OperationType.LINKFILE,
                        src="this/points/nowhere",
                        dest="dangling_link",
                    )
                ],
            ),
        ]
        self.assertEqual(projects, expected_projects)

    def test_get_projects_from_manifest_with_glob_src(self):
        """Test the manifest is not parsed if the src of linkfile is a glob pattern."""
        manifest_content_linkfile = """<?xml version="1.0" encoding="UTF-8"?>
<manifest>
  <project groups="pdk" name="platform/bionic" path="bionic">
    <linkfile src="**/*.txt" dest="BIONIC_INSTRUCTIONS"/>
  </project>
</manifest>
"""
        projects = source_trimmer.get_projects_from_manifest(manifest_content_linkfile)
        self.assertIsNone(projects)

    def test_find_projects_to_remove(self):
        """Test that the projects to remove are identified correctly."""
        all_projects = source_trimmer.get_projects_from_manifest(self.manifest_content)
        groups_to_keep = ["pdk"]
        projects_to_remove = source_trimmer.find_projects_to_remove(
            all_projects, groups_to_keep
        )
        # platform/bionic and platform/bootable/recovery should be kept.
        expected_to_remove = [
            source_trimmer.Project(
                name="platform/build",
                path="build/make",
                groups=["pdk-desktop"],
                operations=[],
            ),
            source_trimmer.Project(
                name="platform/system/core",
                path="system/core",
                groups=[],
                operations=[],
            ),
            source_trimmer.Project(
                name="platform/lib/foo",
                path="external/foo",
                groups=["group1"],
                operations=[],
            ),
            source_trimmer.Project(
                name="platform/lib/bar",
                path="platform/lib/bar",
                groups=["group1", "group2"],
                operations=[],
            ),
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
            source_trimmer.Project(
                name="platform/system/core",
                path="system/core",
                groups=[],
                operations=[],
            ),
            source_trimmer.Project(
                name="platform/lib/foo",
                path="external/foo",
                groups=["group1"],
                operations=[],
            ),
            source_trimmer.Project(
                name="platform/lib/bar",
                path="platform/lib/bar",
                groups=["group1", "group2"],
                operations=[],
            ),
        ]
        self.assertEqual(projects_to_remove, expected_to_remove)

    def test_remove_project_directories(self):
        """Test that the project directories are removed correctly."""
        projects_to_remove = [
            source_trimmer.Project(
                name="platform/build",
                path="build/make",
                groups=["pdk-desktop"],
                operations=[],
            ),
            source_trimmer.Project(
                name="platform/system/core",
                path="system/core",
                groups=[],
                operations=[],
            ),
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
            source_trimmer.Project(
                name="platform/build",
                path="build/make",
                groups=["pdk-desktop"],
                operations=[],
            ),
        ]
        with tempfile.TemporaryDirectory() as tmpdir:
            checkout_root = pathlib.Path(tmpdir)
            (checkout_root / "build/make").mkdir(parents=True)

            source_trimmer.remove_project_directories(
                projects_to_remove, checkout_root, dry_run=True
            )

            self.assertTrue((checkout_root / "build/make").exists())
            self.assertTrue((checkout_root / "build").exists())

    def test_undo_project_file_operations(self):
        """Test removal of files from linkfile/copyfile operations."""
        project = source_trimmer.Project(
            name="test-project",
            path="vendor/test",
            groups=["test"],
            operations=[
                source_trimmer.FileOperation(
                    type="copyfile", src="a.txt", dest="top_level.txt"
                ),
                source_trimmer.FileOperation(
                    type="linkfile", src="b.txt", dest="link_b.txt"
                ),
                source_trimmer.FileOperation(
                    type="copyfile", src="c.txt", dest="subdir/c.txt"
                ),
                source_trimmer.FileOperation(
                    type="linkfile", src="d.txt", dest="nonexistent.txt"
                ),
                source_trimmer.FileOperation(
                    type="copyfile", src="e.txt", dest="dir_dest"
                ),
            ],
        )

        with tempfile.TemporaryDirectory() as tmpdir:
            checkout_root = pathlib.Path(tmpdir)

            # Setup dummy files and links.
            (checkout_root / "top_level.txt").write_text("a")
            (checkout_root / "link_b.txt").symlink_to("vendor/test/b.txt")
            (checkout_root / "subdir").mkdir()
            (checkout_root / "subdir/c.txt").write_text("c")
            (checkout_root / "dir_dest").mkdir()

            # Files that should remain.
            (checkout_root / "other_file.txt").write_text("keep")

            source_trimmer.undo_project_file_operations(
                project, checkout_root, dry_run=False
            )

            self.assertFalse((checkout_root / "top_level.txt").exists())
            self.assertFalse((checkout_root / "link_b.txt").exists())
            self.assertFalse((checkout_root / "link_b.txt").is_symlink())
            self.assertFalse((checkout_root / "subdir/c.txt").exists())
            self.assertTrue((checkout_root / "subdir").exists())
            self.assertFalse((checkout_root / "nonexistent.txt").exists())
            self.assertTrue((checkout_root / "dir_dest").exists())
            self.assertTrue((checkout_root / "other_file.txt").exists())

    def test_undo_project_file_operations_dry_run(self):
        """Test dry run for undoing file operations."""
        project = source_trimmer.Project(
            name="test-project",
            path="vendor/test",
            groups=["test"],
            operations=[
                source_trimmer.FileOperation(
                    type="copyfile", src="a.txt", dest="top_level.txt"
                ),
                source_trimmer.FileOperation(
                    type="linkfile", src="b.txt", dest="link_b.txt"
                ),
            ],
        )

        with tempfile.TemporaryDirectory() as tmpdir:
            checkout_root = pathlib.Path(tmpdir)
            (checkout_root / "top_level.txt").write_text("a")
            (checkout_root / "link_b.txt").symlink_to("vendor/test/b.txt")

            source_trimmer.undo_project_file_operations(
                project, checkout_root, dry_run=True
            )

            self.assertTrue((checkout_root / "top_level.txt").exists())
            self.assertTrue((checkout_root / "link_b.txt").is_symlink())

    def test_keep_projects_overrides_removal(self):
        """Test that projects to keep are not removed, even if they would be marked for removal."""
        # These projects would be marked for removal by find_projects_to_remove.
        projects_to_remove = [
            source_trimmer.Project(
                name="platform/build",
                path="build/make",
                groups=["pdk-desktop"],
                operations=[],
            ),
            source_trimmer.Project(
                name="platform/system/core",
                path="system/core",
                groups=[],
                operations=[],
            ),
            source_trimmer.Project(
                name="platform/lib/foo",
                path="external/foo",
                groups=["another-group"],
                operations=[],
            ),
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

    def test_generate_filtered_manifest_strict_filtering(self):
        """Test manifest filtering with extra attributes removed."""
        manifest_input = """<?xml version="1.0" encoding="UTF-8"?>
<manifest>
  <default revision="master" remote="arsp" />
  <default revision="master" remote="ohd" />
  <remote name="arsp" fetch=".." />
  <remote name="ohd" fetch=".." />
  <project groups="keep" name="platform/keep" path="keep" remote="ohd" />
  <project groups="discard" name="platform/drop" path="drop" remote="ohd" />
  <repo-hooks in-project="platform/admin" enabled-list="pre-upload" />
</manifest>
"""
        projects_to_keep = {"platform/keep"}

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = pathlib.Path(tmpdir) / "filtered_manifest.xml"
            source_trimmer.generate_arsp_filtered_manifest(
                manifest_input, projects_to_keep, output_path
            )

            tree = source_trimmer.ET.parse(output_path)
            root = tree.getroot()

            # Verify the correct tags remain.
            tags = [child.tag for child in root]
            self.assertIn("project", tags)
            self.assertIn("repo-hooks", tags)
            self.assertIn("default", tags)
            self.assertIn("remote", tags)

            # Verify non-arsp remotes and defaults were removed.
            remotes = root.findall("remote")
            self.assertEqual(len(remotes), 1)
            self.assertEqual(remotes[0].get("name"), "arsp")

            defaults = root.findall("default")
            self.assertEqual(len(defaults), 1)
            self.assertEqual(defaults[0].get("remote"), "arsp")

            # Verify 'remote' attribute is stripped from the kept project.
            project = root.find("project")
            self.assertEqual(project.get("name"), "platform/keep")
            self.assertNotIn("remote", project.attrib)

            # Verify other attributes like 'path' remain.
            self.assertEqual(project.get("path"), "keep")

            # Verify repo-hooks is preserved.
            hooks = root.find("repo-hooks")
            self.assertEqual(hooks.get("in-project"), "platform/admin")


if __name__ == "__main__":
    unittest.main()
