#!/usr/bin/env python3
#
# Copyright (C) 2025 The Android Open Source Project
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Trims a repo client checkout by removing projects not belonging to a specified set of groups.

This script parses a repo manifest, identifies projects whose groups do not
intersect with a provided list of "groups to keep", and optionally deletes
their directories from the filesystem. This is useful for creating subset
checkouts from a full repo manifest.
"""

import argparse
import enum
import errno
import logging
from pathlib import Path
import re
import shutil
import sys
from typing import Optional, TypedDict
import xml.etree.ElementTree as ET

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")


class OperationType(enum.Enum):
    """Represents the type of file operation."""
    LINKFILE = "linkfile"
    COPYFILE = "copyfile"


class FileOperation(TypedDict):
    """Represents a single <linkfile> or <copyfile> operation."""

    type: OperationType
    src: str
    dest: str


class Project(TypedDict):
    """Represents the parsed information for a single project."""

    name: str
    path: str
    groups: list[str]
    operations: list[FileOperation]


def get_parser() -> argparse.ArgumentParser:
    """Returns an ArgumentParser configured for this script."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--snapshot-manifest",
        required=True,
        type=Path,
        help="Path to the internal snapshot manifest XML file.",
    )
    parser.add_argument(
        "--groups-to-keep",
        required=True,
        nargs="*",
        default=[],
        help="Space-separated or comma-separated list of repo groups to KEEP",
    )
    parser.add_argument(
        "--projects-to-keep",
        nargs="*",
        default=[],
        help=(
            "Space-separated list of project names to explicitly KEEP, regardless"
            " of group membership."
        ),
    )
    parser.add_argument(
        "--checkout-root",
        default=Path.cwd(),
        type=Path,
        help=(
            "Root directory of the source checkout. Defaults to the"
            " current working directory."
        ),
    )
    parser.add_argument(
        "-n",
        "--dry-run",
        action="store_true",
        help="Log which directories would be removed without actually deleting them.",
    )
    return parser


def process_groups_to_keep(raw_groups: list[str]) -> list[str]:
    """Processes raw group strings, splitting by commas and whitespace."""
    processed_groups = []
    for group_str in raw_groups:
        # Split by commas or whitespace.
        processed_groups.extend(g for g in re.split(r"[,\s]+", group_str) if g)
    return processed_groups


def get_projects_from_manifest(manifest_content: str) -> Optional[list[Project]]:
    """Parses the manifest XML string and returns a list of project details."""
    try:
        root = ET.fromstring(manifest_content)
    except ET.ParseError as e:
        logging.error("Error parsing manifest content: %s", e)
        return None

    projects = []
    for project_elem in root.findall("project"):
        name = project_elem.get("name")
        groups = project_elem.get("groups", "")

        operations = []
        for elem in project_elem.findall("linkfile"):
            src = elem.get("src")
            dest = elem.get("dest")
            if src and dest:
                operations.append(
                    FileOperation(type=OperationType.LINKFILE, src=src, dest=dest)
                )
        for elem in project_elem.findall("copyfile"):
            src = elem.get("src")
            dest = elem.get("dest")
            if src and dest:
                operations.append(
                    FileOperation(type=OperationType.COPYFILE, src=src, dest=dest)
                )

        projects.append(
            Project(
                name=name,
                path=project_elem.get("path", name),
                groups=[g.strip() for g in groups.split(",") if g.strip()],
                operations=operations,
            )
        )

    return projects


def find_projects_to_remove(
    all_projects: list[Project], groups_to_keep: list[str]
) -> list[Project]:
    """Determines which projects to remove based on group membership."""
    projects_to_remove = []
    keep_groups_set = set(groups_to_keep)
    logging.info("Groups to keep: %s", sorted(keep_groups_set))

    for project in all_projects:
        project_groups_set = set(project["groups"])
        # Keep the project if its groups have any intersection with the keep groups.
        if project_groups_set & keep_groups_set:
            logging.debug(
                "Keeping: %s (groups: %s)", project["path"], project["groups"]
            )
        else:
            projects_to_remove.append(project)
            logging.debug(
                "Marking for removal: %s (groups: %s)",
                project["path"],
                project["groups"],
            )

    return projects_to_remove


def undo_project_file_operations(
    project: Project,
    checkout_root: Path,
    dry_run: bool = False,
) -> None:
    """Removes files/symlinks created by linkfile/copyfile for a project."""
    operations = project.get("operations", [])
    if not operations:
        return

    log_prefix = "[DRY RUN] Would remove" if dry_run else "Removing"
    logging.debug(
        "Undoing %d file operations for project %s", len(operations), project["path"]
    )

    for op in operations:
        dest_str = op["dest"]
        op_type = op["type"]

        dest_path = checkout_root / dest_str

        base_dest_path = dest_path.parent.resolve()
        final_dest_path = base_dest_path / dest_path.name

        logging.info(
            "%s %s: %s",
            log_prefix,
            op_type,
            dest_str,
        )
        if not dry_run:
            try:
                final_dest_path.unlink()
            except FileNotFoundError:
                logging.debug(
                    "Destination not found, skipping %s removal: %s",
                    op_type,
                    dest_str,
                )
            except OSError as e:
                if e.errno != errno.ENOENT:
                    logging.warning("Unable to remove %s %s: %s", op_type, dest_str, e)


def remove_project_directories(
    projects_to_remove: list[Project],
    checkout_root: Path,
    dry_run: bool = False,
) -> None:
    """Removes the directories for the given projects from the filesystem."""
    logging.info("Repo source checkout root: %s", checkout_root)

    resolved_checkout_root = checkout_root.resolve()
    logging.debug("Resolved checkout root: %s", resolved_checkout_root)

    for project in projects_to_remove:
        project_path = project["path"]
        if not project_path:
            logging.warning("Skipping project with empty path: %s", project["name"])
            continue

        # Undo linkfile/copyfile operations linked to this project.
        undo_project_file_operations(project, checkout_root, dry_run)

        abs_path = checkout_root / project_path

        # Resolve the absolute path to handle '..' and symlinks within project_path_str.
        try:
            resolved_abs_path = abs_path.resolve()
        except FileNotFoundError:
            logging.debug("Project path not found, skipping: %s", abs_path)
            continue
        except OSError as e:
            logging.error("Error resolving path %s: %s", abs_path, e)
            continue

        # Security check: Ensure the path is still within the checkout root.
        # This isn't meant to be super comprehensive, but catch obvious
        # mistakes/misconfigurations.
        try:
            resolved_abs_path.relative_to(resolved_checkout_root)
        except ValueError:
            logging.error(
                "Project path '%s' resolves outside checkout root. Resolved '%s' vs Checkout '%s'",
                project_path,
                resolved_abs_path,
                resolved_checkout_root,
            )
            continue

        log_prefix = "[DRY RUN] Would remove" if dry_run else "Removing"
        logging.info("%s directory: %s", log_prefix, project_path)
        if not dry_run:
            try:
                shutil.rmtree(resolved_abs_path)
            except OSError as e:
                logging.error("Error removing %s: %s", resolved_abs_path, e)
                continue
            # Trim empty parent directories after removing the project.
            current_parent = resolved_abs_path.parent
            while current_parent != resolved_checkout_root:
                try:
                    logging.info(
                        "%s empty parent directory: %s",
                        log_prefix,
                        current_parent.relative_to(resolved_checkout_root),
                    )
                    current_parent.rmdir()
                    current_parent = current_parent.parent
                except OSError as e:
                    if e.errno != errno.ENOTEMPTY:
                        logging.warning(
                            "Could not remove parent directory %s: %s",
                            current_parent.relative_to(resolved_checkout_root),
                            e,
                        )
                    break


def main(argv: Optional[list[str]] = None) -> Optional[int]:
    parser = get_parser()
    opts = parser.parse_args(argv)

    snapshot_manifest_path = opts.snapshot_manifest
    checkout_root = opts.checkout_root

    if not checkout_root.is_dir():
        logging.error("Checkout root directory not found: %s", checkout_root)
        return 1

    logging.info("Starting source trimming process...")
    try:
        manifest_content = snapshot_manifest_path.read_text(encoding="utf-8")
    except OSError as e:
        logging.error("Error reading manifest file %s: %s", snapshot_manifest_path, e)
        return 1
    all_projects = get_projects_from_manifest(manifest_content)
    if not all_projects:
        return 1
    logging.info("Found %d projects in the manifest.", len(all_projects))

    groups_to_keep = process_groups_to_keep(opts.groups_to_keep)

    projects_to_remove = find_projects_to_remove(all_projects, groups_to_keep)
    logging.info(
        "Identified %d projects to potentially remove based on groups.",
        len(projects_to_remove),
    )

    if opts.projects_to_keep:
        keep_project_names = set(opts.projects_to_keep)
        logging.info("Explicitly keeping projects: %s", sorted(keep_project_names))
        initial_remove_count = len(projects_to_remove)
        projects_to_remove = [
            p for p in projects_to_remove if p["name"] not in keep_project_names
        ]
        explicitly_kept_count = initial_remove_count - len(projects_to_remove)
        if explicitly_kept_count:
            logging.info(
                "Removed %d projects from the removal list due to --projects-to-keep.",
                explicitly_kept_count,
            )

    logging.info("Final count of projects to remove: %d", len(projects_to_remove))
    if projects_to_remove:
        remove_project_directories(projects_to_remove, checkout_root, opts.dry_run)
    else:
        logging.info("No projects to remove for the given groups.")

    logging.info("Source trimming process finished.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
