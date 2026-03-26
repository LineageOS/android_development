/*
 * Copyright (C) 2025 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {getLogger, Logger} from '@compat/logging';
import {AdbDeviceConnection} from '@trace_collection/adb_device_connection';
import {TraceTarget} from '@trace_collection/trace_target';

import {WINSCOPE_BACKUP_DIR} from './winscope_backup_dir';

export class TracingSession {
  private isTracing = false;

  constructor(
    private target: TraceTarget,
    private readonly logger: Logger = getLogger('TracingSession'),
  ) {}

  async start(device: AdbDeviceConnection) {
    await this.setup(device);
    await device.startTrace(this.target);
    this.isTracing = true;
  }

  async stop(device: AdbDeviceConnection) {
    if (!this.isTracing) {
      return;
    }
    await device.endTrace(this.target);
    this.isTracing = false;
  }

  async dump(device: AdbDeviceConnection) {
    await this.setup(device);
    this.logger.debug(`Starting dump for ${this.target.traceName}`);
    const output = await device.runShellCommand(this.target.startCmd);
    this.logger.debug(
      `Completed dump for ${this.target.traceName}. Output: ${output}`,
    );
  }

  async moveFiles(device: AdbDeviceConnection) {
    const isRoot = await device.checkRoot();
    const maybeRootParam = isRoot ? 'su root ' : '';

    for (const file of this.target.fileIdentifiers) {
      const filepaths = await device.findFiles(file.path, file.matchers);

      for (const filepath of filepaths) {
        this.logger.debug(
          `Attempting to move file ${filepath} to ${WINSCOPE_BACKUP_DIR}${file.destName} on device`,
        );
        try {
          const output = await device.runShellCommand(
            maybeRootParam +
              `[ -f ${filepath} ] && ` +
              maybeRootParam +
              `cp -p ${filepath} ${WINSCOPE_BACKUP_DIR}${file.destName} && ` +
              maybeRootParam +
              `rm -f ${filepath}`,
          );
          this.logger.debug(
            `Moved ${filepath} to ${WINSCOPE_BACKUP_DIR}${file.destName} on device.` +
              ` Output: ${output}`,
          );
        } catch (e) {
          this.logger.warn(
            `Unable to move file ${filepath}: ${(e as Error).message}`,
          );
        }
      }
    }
  }

  async onDestroy(device: AdbDeviceConnection) {
    this.stop(device);
  }

  private async setup(device: AdbDeviceConnection) {
    for (const cmd of this.target.setupCmds) {
      const output = await device.runShellCommand(cmd);
      this.logger.info(`Ran ${cmd}. Output: ${output}`);
    }
  }
}
