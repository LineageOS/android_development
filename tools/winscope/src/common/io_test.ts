/*
 * Copyright (C) 2022 The Android Open Source Project
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
import {getFixtureFile} from 'test/unit/io_helpers';
import {
  createZipArchive,
  decompressGZipFile,
  DOWNLOAD_FILENAME_REGEX,
  getFileDirectory,
  getFileExtension,
  removeDirFromFileName,
  removeExtensionFromFilename,
  unzipFile,
} from './io';

describe('file_utils', () => {
  it('extracts file extensions', () => {
    expect(getFileExtension('winscope.zip')).toBe('zip');
    expect(getFileExtension('win.scope.zip')).toBe('zip');
    expect(getFileExtension('winscopezip')).toBeUndefined();
  });

  it('extracts file directories', () => {
    expect(getFileDirectory('test/winscope.zip')).toBe('test');
    expect(getFileDirectory('test/test/winscope.zip')).toBe('test/test');
    expect(getFileDirectory('winscope.zip')).toBeUndefined();
  });

  it('removes directory from filename', () => {
    expect(removeDirFromFileName('test/winscope.zip')).toBe('winscope.zip');
    expect(removeDirFromFileName('test/test/winscope.zip')).toBe(
      'winscope.zip',
    );
  });

  it('removes extension from filename', () => {
    expect(removeExtensionFromFilename('winscope.zip')).toBe('winscope');
    expect(removeExtensionFromFilename('win.scope.zip')).toBe('win.scope');
    expect(removeExtensionFromFilename('winscopezip')).toBe('winscopezip');
  });

  it('creates zip archive', async () => {
    const zip = await createZipArchive([new File([], 'test_file.txt')]);
    expect(zip).toBeInstanceOf(Blob);
  });

  it('creates zip archive with progress listener', async () => {
    const progressSpy = jasmine.createSpy();
    const zip = await createZipArchive(
      [
        new File([], 'test_file.txt'),
        new File([], 'test_file_2.txt'),
        new File([], 'test_file_3.txt'),
        new File([], 'test_file_4.txt'),
      ],
      progressSpy,
    );
    expect(zip).toBeInstanceOf(Blob);
    expect(progressSpy).toHaveBeenCalledTimes(4);
    expect(progressSpy).toHaveBeenCalledWith(0.25);
    expect(progressSpy).toHaveBeenCalledWith(0.5);
    expect(progressSpy).toHaveBeenCalledWith(0.75);
    expect(progressSpy).toHaveBeenCalledWith(1);
  });

  it('unzips archive', async () => {
    const validZipFile = await getFixtureFile('archives/winscope.zip');
    const unzippedFiles = await unzipFile(validZipFile);
    expect(unzippedFiles.map((f) => f.name)).toEqual([
      'Surface Flinger/SurfaceFlinger.pb',
      'Window Manager/WindowManager.pb',
    ]);
  });

  it('recursively unzips archive', async () => {
    const validZipFile = await getFixtureFile(
      'archives/recursive_winscope.zip',
    );
    const unzippedFiles = await unzipFile(validZipFile);
    expect(unzippedFiles.map((f) => f.name)).toEqual([
      'Surface Flinger/SurfaceFlinger.pb',
      'Window Manager/WindowManager.pb',
    ]);
  });

  it('decompresses gzipped file', async () => {
    const gzippedFile = await getFixtureFile('archives/WindowManager.pb.gz');
    const unzippedFile = await decompressGZipFile(gzippedFile);
    expect(unzippedFile.name).toBe('archives/WindowManager.pb');
    expect(unzippedFile.size).toBe(377137);
  });

  it('decompresses gzipped file without gz ext', async () => {
    const gzippedFile = await getFixtureFile(
      'archives/WindowManager.pb.gz',
      'archives/WindowManager.pb',
    );
    const unzippedFile = await decompressGZipFile(gzippedFile);
    expect(unzippedFile.name).toBe('archives/WindowManager.pb');
    expect(unzippedFile.size).toBe(377137);
  });

  it('decompresses gzipped archive', async () => {
    const gzippedFile = await getFixtureFile('archives/WindowManager.zip.gz');
    const unzippedFile = await decompressGZipFile(gzippedFile);
    expect(unzippedFile.name).toBe('archives/WindowManager.zip');
    expect(unzippedFile.size).toBe(10158);
  });

  it('has download filename regex that accepts all expected inputs', () => {
    expect(DOWNLOAD_FILENAME_REGEX.test('Winscope2')).toBeTrue();
    expect(DOWNLOAD_FILENAME_REGEX.test('win_scope')).toBeTrue();
    expect(DOWNLOAD_FILENAME_REGEX.test('win-scope')).toBeTrue();
    expect(DOWNLOAD_FILENAME_REGEX.test('win.scope')).toBeTrue();
    expect(DOWNLOAD_FILENAME_REGEX.test('win.sc.ope')).toBeTrue();
  });

  it('has download filename regex that rejects all expected inputs', () => {
    expect(DOWNLOAD_FILENAME_REGEX.test('w?n$cope')).toBeFalse();
    expect(DOWNLOAD_FILENAME_REGEX.test('winscope.')).toBeFalse();
    expect(DOWNLOAD_FILENAME_REGEX.test('w..scope')).toBeFalse();
    expect(DOWNLOAD_FILENAME_REGEX.test('wins--pe')).toBeFalse();
    expect(DOWNLOAD_FILENAME_REGEX.test('wi##cope')).toBeFalse();
  });
});
