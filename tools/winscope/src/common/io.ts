/*
 * Copyright (C) 2023 The Android Open Source Project
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
import * as jSZip from 'jszip';

import {equal} from './typed_array';

/**
 * Type definition for a callback function that is called when a file is unzipped.
 *
 * @param file The unzipped file.
 * @param parentArchive The parent archive file, if any.
 */
export type OnFile = (file: File, parentArchive: File | undefined) => void;

/**
 * Type of the onProgressUpdate callback function.
 */
export type OnProgressUpdateType = (percentage: number) => void;

/**
 * Regex to validate filenames for download.
 * Allows letters, numbers, and underscores with delimiters '.', '-', '#',
 * but not at the start or end.
 */
export const DOWNLOAD_FILENAME_REGEX = /^\w+?((|#|-|\.)\w+)+$/;

/**
 * Regex to find characters that are illegal in filenames.
 * Matches any character that is NOT an alphanumeric, '-', '#', '.', or '_'.
 * This is useful for sanitizing filenames before saving or processing.
 */
export const ILLEGAL_FILENAME_CHARACTERS_REGEX = /[^A-Za-z0-9-#._]/g;

/**
 * Extracts the file extension from a filename.
 *
 * @param filename The filename to extract the extension from.
 * @return The file extension, or undefined if there is no extension.
 */
export function getFileExtension(filename: string): string | undefined {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) {
    return undefined;
  }
  return filename.slice(lastDot + 1);
}

/**
 * Extracts the file directory from a filename.
 *
 * @param filename The filename to extract the directory from.
 * @return The file directory, or undefined if there is no directory.
 */
export function getFileDirectory(filename: string): string | undefined {
  const lastIndex = filename.lastIndexOf('/');
  if (lastIndex === -1) {
    return undefined;
  }
  return filename.slice(0, lastIndex);
}

/**
 * Removes the directory from a filename.
 *
 * @param name The filename to remove the directory from.
 * @return The filename without the directory.
 */
export function removeDirFromFileName(name: string): string {
  if (name.includes('/')) {
    const startIndex = name.lastIndexOf('/') + 1;
    return name.slice(startIndex);
  } else {
    return name;
  }
}

/**
 * Removes the extension from a filename.
 *
 * @param name The filename to remove the extension from.
 * @return The filename without the extension.
 */
export function removeExtensionFromFilename(name: string): string {
  if (name.includes('.')) {
    const lastIndex = name.lastIndexOf('.');
    return name.slice(0, lastIndex);
  } else {
    return name;
  }
}

/**
 * Creates a ZIP archive from a list of files.
 *
 * @param files The list of files to archive.
 * @param progressCallback An optional callback function that will be called
 *     as the archive is created, passing a number between 0 and 1 as an
 *     argument, representing the progress of the operation.
 * @return A Promise that resolves to the ZIP archive Blob.
 */
export async function createZipArchive(
  files: File[],
  progressCallback?: OnProgressUpdateType,
): Promise<Blob> {
  const zip = new jSZip();
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const blob = await file.arrayBuffer();
    zip.file(file.name, blob);
    if (progressCallback) progressCallback((i + 1) / files.length);
  }
  return await zip.generateAsync({type: 'blob'});
}

/**
 * Unzips a ZIP archive file.
 *
 * @param file The ZIP archive file to unzip.
 * @param onProgressUpdate An optional callback function that will be called
 *     as the archive is unzipped, passing a number between 0 and 1 as an
 *     argument, representing the progress of the operation.
 * @return A Promise that resolves to an array of the unzipped files.
 */
export async function unzipFile(
  file: Blob,
  onProgressUpdate: OnProgressUpdateType = () => {},
): Promise<File[]> {
  const unzippedFiles: File[] = [];
  const zip = new jSZip();
  const content = await zip.loadAsync(file);

  const filenames = Object.keys(content.files);
  for (const [index, filename] of filenames.entries()) {
    const file = content.files[filename];
    if (file.dir) {
      // Ignore directories
      continue;
    } else {
      const fileBlob = await file.async('blob');
      const unzippedFile = new File([fileBlob], filename);
      if (await isZipFile(unzippedFile)) {
        unzippedFiles.push(...(await unzipFile(fileBlob)));
      } else {
        unzippedFiles.push(unzippedFile);
      }
    }

    onProgressUpdate((100 * (index + 1)) / filenames.length);
  }

  return unzippedFiles;
}

/**
 * Decompresses a GZIP file.
 *
 * @param file The GZIP file to decompress.
 * @return A Promise that resolves to the decompressed file.
 */
export async function decompressGZipFile(file: File): Promise<File> {
  const decompressionStream = new window.DecompressionStream('gzip');
  const decompressedStream = file.stream().pipeThrough(decompressionStream);
  const fileBlob = await new Response(decompressedStream).blob();
  const filename =
    getFileExtension(file.name) === 'gz'
      ? removeExtensionFromFilename(file.name)
      : file.name;
  return new File([fileBlob], filename);
}

/**
 * Checks if a file is a ZIP file.
 *
 * @param file The file to check.
 * @return A Promise that resolves to true if the file is a ZIP file, and
 *     false otherwise.
 */
export async function isZipFile(file: File): Promise<boolean> {
  return isMatchForMagicNumber(file, PK_ZIP_MAGIC_NUMBER);
}

/**
 * Checks if a file is a GZIP file.
 *
 * @param file The file to check.
 * @return A Promise that resolves to true if the file is a GZIP file, and
 *     false otherwise.
 */
export async function isGZipFile(file: File): Promise<boolean> {
  return isMatchForMagicNumber(file, GZIP_MAGIC_NUMBER);
}

/**
 * Checks if a file matches a given magic number.
 *
 * @param file The file to check.
 * @param magicNumber The magic number to match.
 * @return A Promise that resolves to true if the file matches the magic
 *     number, and false otherwise.
 */
async function isMatchForMagicNumber(
  file: File,
  magicNumber: number[],
): Promise<boolean> {
  const bufferStart = new Uint8Array((await file.arrayBuffer()).slice(0, 2));
  return equal(bufferStart, magicNumber);
}

const GZIP_MAGIC_NUMBER = [0x1f, 0x8b];
const PK_ZIP_MAGIC_NUMBER = [0x50, 0x4b];
