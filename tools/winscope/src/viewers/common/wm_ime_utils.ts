/*
 * Copyright (C) 2024 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {assertDefined} from '@common/assert';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';

const defaultDisplayId = 0;

/**
 * Gets the focused activity from the window manager trace entry.
 *
 * @param entry The trace entry to process.
 *
 * @return The focused activity, or undefined if no focused activity is found.
 */
export async function getFocusedActivity(
  entry: HierarchyTreeNode,
): Promise<HierarchyTreeNode | undefined> {
  const focusedDisplay = await getFocusedDisplay(entry);
  const focusedWindow = await getFocusedWindow(entry);
  const resumedActivity = (await focusedDisplay?.getAllProperties())
    ?.getChildByName('displayContent')
    ?.getChildByName('resumedActivity');

  let focusedActivity: HierarchyTreeNode | undefined;
  if (focusedDisplay && resumedActivity) {
    const rootTasks = await getRootTasks(focusedDisplay);
    focusedActivity = getActivityByName(
      assertDefined(
        resumedActivity?.getChildByName('title')?.getValue<string>(),
      ),
      rootTasks,
    );
  } else if (focusedDisplay && focusedWindow) {
    focusedActivity = (
      await getActivitiesForWindowState(focusedWindow, focusedDisplay)
    )?.at(0);
  }

  return focusedActivity;
}

/**
 * Gets the focused window from the window manager trace entry.
 *
 * @param entry The trace entry to process.
 *
 * @return The focused window, or undefined if no focused window is found.
 */
export async function getFocusedWindow(
  entry: HierarchyTreeNode,
): Promise<HierarchyTreeNode | undefined> {
  const focusedWindowTitle = (await entry.getAllProperties())
    .getChildByName('windowManagerService')
    ?.getChildByName('focusedWindow')
    ?.getChildByName('title')
    ?.getValue();
  return (await getVisibleWindows(entry)).find(
    (window) => window.name === focusedWindowTitle,
  );
}

async function getFocusedDisplay(
  entry: HierarchyTreeNode,
): Promise<HierarchyTreeNode | undefined> {
  const focusedDisplayId = Number(
    entry.getEagerPropertyByName('focusedDisplayId')?.getValue<bigint>(),
  );

  for (const child of entry.getAllChildren()) {
    const props = await child.getAllProperties();
    if (
      props
        .getChildByName('displayContent')
        ?.getChildByName('id')
        ?.getValue() === focusedDisplayId
    ) {
      return child;
    }
  }
  return undefined;
}

async function getVisibleWindows(
  entry: HierarchyTreeNode,
): Promise<HierarchyTreeNode[]> {
  const windowStates = entry.filterDfs((node) => {
    return node.id.startsWith('WindowState ');
  }, true);

  let display: HierarchyTreeNode | undefined;
  for (const child of entry.getAllChildren()) {
    if (
      (await child.getAllProperties())
        .getChildByName('displayContent')
        ?.getChildByName('id')
        ?.getValue() === defaultDisplayId
    ) {
      display = child;
      break;
    }
  }

  const visibleWindows = [];

  for (const state of windowStates) {
    const activities = await getActivitiesForWindowState(
      state,
      assertDefined(display),
    );
    const windowIsVisible =
      state.getEagerPropertyByName('isVisible')?.getValue() ?? false;
    const activityIsVisible =
      activities.find((activity) =>
        activity.getEagerPropertyByName('isVisible')?.getValue(),
      ) ?? false;
    if (windowIsVisible && (activityIsVisible || activities.length === 0)) {
      visibleWindows.push(state);
    }
  }

  return visibleWindows;
}

async function getActivitiesForWindowState(
  windowState: HierarchyTreeNode,
  display: HierarchyTreeNode,
): Promise<HierarchyTreeNode[]> {
  return (await getRootTasks(display)).reduce((activities, stack) => {
    const activity = getActivity(stack, (activity) =>
      hasWindowState(activity, windowState),
    );
    if (activity) {
      activities.push(activity);
    }
    return activities;
  }, new Array<HierarchyTreeNode>());
}

function hasWindowState(
  activity: HierarchyTreeNode,
  windowState: HierarchyTreeNode,
): boolean {
  return (
    activity.filterDfs((node) => {
      return (
        node.id.startsWith('WindowState ') && node.name === windowState.name
      );
    }, true).length > 0
  );
}

async function getRootTasks(
  display: HierarchyTreeNode,
): Promise<HierarchyTreeNode[]> {
  const promises: Array<Promise<HierarchyTreeNode | undefined>> = [];
  display.forEachNodeDfs((node) => {
    const isTask = node.id.startsWith('Task ');
    if (!isTask) return;

    const promise = node.getAllProperties().then((props) => {
      const taskProps = assertDefined(props.getChildByName('task'));
      const taskId = taskProps?.getChildByName('id')?.getValue();
      const rootTaskId = taskProps.getChildByName('rootTaskId')?.getValue();
      const isRootTask = rootTaskId !== undefined && taskId === rootTaskId;
      if (isRootTask) {
        return node;
      }
      return undefined;
    });

    promises.push(promise);
  }, true);

  const rootOrganizedTasks: HierarchyTreeNode[] = [];

  const tasks = (await Promise.all(promises))
    .filter((task) => task !== undefined)
    .reverse();

  const filteredTasks = [];
  for (const task of tasks) {
    const props = assertDefined(
      (await task.getAllProperties()).getChildByName('task'),
    );
    if (props.getChildByName('createdByOrganiser')?.getValue()) {
      rootOrganizedTasks.push(task);
    } else {
      filteredTasks.push(task);
    }
  }

  // Add root tasks controlled by an organizer
  rootOrganizedTasks.reverse().forEach((rootOrganizedTask) => {
    filteredTasks.push(...rootOrganizedTask.getAllChildren().slice().reverse());
  });

  return tasks;
}

function getActivityByName(
  activityName: string,
  rootTasks: HierarchyTreeNode[],
): HierarchyTreeNode | undefined {
  for (const rootTask of rootTasks) {
    const activity = getActivity(rootTask, (activity: HierarchyTreeNode) =>
      activity.name.includes(activityName),
    );
    if (activity) {
      return activity;
    }
  }
  return undefined;
}

function getActivity(
  task: HierarchyTreeNode,
  predicate: (activity: HierarchyTreeNode) => boolean,
): HierarchyTreeNode | undefined {
  const children = task.getAllChildren().slice().reverse();
  let activity = children
    .filter((child) => child.id.startsWith('Activity '))
    .find(predicate);

  if (activity) {
    return activity;
  }

  for (const task of children.filter((child) => child.id.startsWith('Task '))) {
    activity = getActivity(task, predicate);
    if (activity) {
      return activity;
    }
  }
  for (const taskFragment of children.filter((child) =>
    child.id.startsWith('TaskFragment '),
  )) {
    activity = getActivity(taskFragment, predicate);
    if (activity) {
      return activity;
    }
  }
  return;
}
