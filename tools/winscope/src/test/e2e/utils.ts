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
import * as path from 'path';
import {browser, by, element, ElementFinder, protractor} from 'protractor';

export const WINSCOPE_URL = 'http://localhost:8080';
export const REMOTE_TOOL_MOCK_URL = 'http://localhost:8081';
const JASMINE_DEFAULT_TIMEOUT_MS = 40000;

/**
 * Set jasmine and protractor timeouts.
 *
 * @param defaultTimeoutMs Protractor's timeout in ms.
 * @param jasmineTimeoutMs Jasmine's timeout in ms.
 */
export async function setTimeouts(
  defaultTimeoutMs: number,
  jasmineTimeoutMs = JASMINE_DEFAULT_TIMEOUT_MS,
) {
  jasmine.DEFAULT_TIMEOUT_INTERVAL = jasmineTimeoutMs;
  await browser.manage().timeouts().implicitlyWait(defaultTimeoutMs);
  await checkServerIsUp('Winscope', WINSCOPE_URL);
  await browser.driver.manage().window().maximize();
}

/**
 * Check that a server is up and running.
 *
 * @param name Server name.
 * @param url Server url.
 */
export async function checkServerIsUp(name: string, url: string) {
  try {
    await browser.get(url);
  } catch (error) {
    fail(`${name} server (${url}) looks down. Did you start it?`);
  }
}

/**
 * Load a trace file and check that the expected viewer is displayed.
 *
 * @param fixturePath Path to trace file.
 * @param viewerTabTitle Title of the viewer tab to open.
 * @param viewerSelector Selector of the viewer component.
 */
export async function loadTraceAndCheckViewer(
  fixturePath: string,
  viewerTabTitle: string,
  viewerSelector: string,
) {
  await uploadFixture(fixturePath);
  await closeSnackBar();
  await clickViewTracesButton();
  await clickViewerTabButton(viewerTabTitle);

  const viewerPresent = await element(by.css(viewerSelector)).isPresent();
  expect(viewerPresent).toBeTruthy();
}

/**
 * Load a bugreport file and check that the expected traces are loaded.
 *
 * @param defaulttimeMs Protractor's timeout in ms.
 */
export async function loadBugReport(defaulttimeMs: number) {
  await uploadFixture('bugreports/bugreport_stripped.zip');
  await checkHasLoadedTracesFromBugReport();
  expect(await areMessagesEmitted(defaulttimeMs)).toBeTruthy();
  await checkEmitsUnsupportedFileFormatMessages();
  await checkEmitsOldDataMessages();
  await closeSnackBar();
}

/**
 * Check that snack bar messages have been emitted.
 *
 * @param defaultTimeoutMs Protractor's timeout in ms.
 * @return A promise that resolves to true if messages have been emitted.
 */
export async function areMessagesEmitted(
  defaultTimeoutMs: number,
): Promise<boolean> {
  const snackBar = element(by.css('snack-bar'));
  await browser.manage().timeouts().implicitlyWait(1000);
  const isPresent = await snackBar.isPresent();
  await browser.manage().timeouts().implicitlyWait(defaultTimeoutMs);
  return isPresent;
}

/**
 * Click the "View traces" button.
 *
 * @param forceKeepLegacy Whether to un-check the "Discard legacy traces" checkbox.
 */
export async function clickViewTracesButton(forceKeepLegacy = true) {
  const discardTracesBox = element(by.css('.discard-legacy-traces'));
  if (
    forceKeepLegacy &&
    (await discardTracesBox.isPresent()) &&
    (await discardTracesBox.isEnabled())
  ) {
    await discardTracesBox.click();
  }
  const button = element(by.css('.load-btn'));
  await button.click();
}

/**
 * Click the "Clear all" button.
 */
export async function clickClearAllButton() {
  const button = element(by.css('.clear-all-btn'));
  await button.click();
}

/**
 * Click the "Close" icon of the first uploaded file.
 */
export async function clickCloseIcon() {
  const button = element.all(by.css('.uploaded-files button')).first();
  await button.click();
}

/**
 * Click the "Download traces" button.
 */
export async function clickDownloadTracesButton() {
  const button = element(by.css('.save-button'));
  await button.click();
}

/**
 * Click the "Upload new" button.
 */
export async function clickUploadNewButton() {
  const button = element(by.css('.upload-new'));
  await button.click();
}

/**
 * Close the snack bar.
 */
export async function closeSnackBar() {
  const closeButton = element(by.css('.snack-bar-actions .close-button'));
  const isPresent = await closeButton.isPresent();
  if (isPresent) {
    await closeButton.click();
  }
}

/**
 * Click the tab button of a viewer.
 *
 * @param title The title of the tab to click.
 */
export async function clickViewerTabButton(title: string) {
  await browser.wait(
    async () => {
      return await element(by.css('trace-view')).isPresent();
    },
    20000,
    'Viewers failed to load',
  );
  const tabs: ElementFinder[] = await element.all(by.css('trace-view .tab'));
  for (const tab of tabs) {
    const tabTitle = await tab.getText();
    if (tabTitle.includes(title)) {
      await tab.click();
      return;
    }
  }
  throw new Error(`could not find tab corresponding to ${title}`);
}

/**
 * Check that the timeline trace selector contains the expected trace icon and color.
 *
 * @param trace The trace to check for.
 */
export async function checkTimelineTraceSelector(trace: {
  icon: string;
  color: string;
}) {
  const traceSelector = element(by.css('#trace-selector'));
  const text = await traceSelector.getText();
  expect(text).toContain(trace.icon);

  const icons = await element.all(by.css('.shown-selection .mat-icon'));
  const iconColors: string[] = [];
  for (const icon of icons) {
    iconColors.push(await icon.getCssValue('color'));
  }
  expect(
    iconColors.some((iconColor) => iconColor === trace.color),
  ).toBeTruthy();
}

/**
 * Check that the initial real timestamp is displayed correctly.
 *
 * @param timestamp The expected timestamp.
 */
export async function checkInitialRealTimestamp(timestamp: string) {
  await changeRealTimestampInWinscope(timestamp);
  await checkWinscopeRealTimestamp(timestamp.slice(12));
  const prevEntryButton = element(by.css('#prev_entry_button'));
  const isDisabled = await prevEntryButton.getAttribute('disabled');
  expect(isDisabled).toBe('true');
}

/**
 * Check that the final real timestamp is displayed correctly.
 *
 * @param timestamp The expected timestamp.
 */
export async function checkFinalRealTimestamp(timestamp: string) {
  await changeRealTimestampInWinscope(timestamp);
  await checkWinscopeRealTimestamp(timestamp.slice(12));
  const nextEntryButton = element(by.css('#next_entry_button'));
  const isDisabled = await nextEntryButton.getAttribute('disabled');
  expect(isDisabled).toBe('true');
}

/**
 * Check that the real timestamp is displayed correctly in Winscope.
 *
 * @param timestamp The expected timestamp.
 */
export async function checkWinscopeRealTimestamp(timestamp: string) {
  const inputElement = element(by.css('input[name="humanTimeInput"]'));
  const value = await inputElement.getAttribute('value');
  expect(value).toEqual(timestamp);
}

/**
 * Change the real timestamp in Winscope.
 *
 * @param newTimestamp The new timestamp.
 */
export async function changeRealTimestampInWinscope(newTimestamp: string) {
  await updateInputField('', 'humanTimeInput', newTimestamp);
}

/**
 * Check that the ns timestamp is displayed correctly in Winscope.
 *
 * @param newTimestamp The expected timestamp.
 */
export async function checkWinscopeNsTimestamp(newTimestamp: string) {
  const inputElement = element(by.css('input[name="nsTimeInput"]'));
  const valueWithNsSuffix = await inputElement.getAttribute('value');
  expect(valueWithNsSuffix).toEqual(newTimestamp + ' ns');
}

/**
 * Change the ns timestamp in Winscope.
 *
 * @param newTimestamp The new timestamp.
 */
export async function changeNsTimestampInWinscope(newTimestamp: string) {
  await updateInputField('', 'nsTimeInput', newTimestamp);
}

/**
 * Filter the hierarchy view.
 *
 * @param viewer The viewer to filter.
 * @param filterString The string to filter by.
 */
export async function filterHierarchy(viewer: string, filterString: string) {
  await updateInputField(
    `${viewer} hierarchy-view .title-section`,
    'filter',
    filterString,
  );
}

/**
 * Update an input field.
 *
 * @param inputFieldSelector The selector of the input field.
 * @param inputFieldName The name of the input field.
 * @param newInput The new input.
 */
export async function updateInputField(
  inputFieldSelector: string,
  inputFieldName: string,
  newInput: string,
) {
  const inputElement = element(
    by.css(`${inputFieldSelector} input[name="${inputFieldName}"]`),
  );
  const inputStringStep1 = newInput.slice(0, -1);
  const inputStringStep2 = newInput.slice(-1) + '\r\n';
  const script = `document.querySelector("${inputFieldSelector} input[name=\\"${inputFieldName}\\"]").value = "${inputStringStep1}"`;
  await browser.executeScript(script);
  await inputElement.sendKeys(inputStringStep2);
}

/**
 * Select an item in the hierarchy view.
 *
 * @param viewer The viewer to select the item in.
 * @param itemName The name of the item to select.
 */
export async function selectItemInHierarchy(viewer: string, itemName: string) {
  const nodes: ElementFinder[] = await element.all(
    by.css(`${viewer} hierarchy-view .node`),
  );
  for (const node of nodes) {
    const id = await node.getAttribute('id');
    if (id.includes(itemName)) {
      const desc = node.element(by.css('.description'));
      await desc.click();
      return;
    }
  }
  throw new Error(`could not find item matching ${itemName} in hierarchy`);
}

/**
 * Apply a state to the hierarchy options.
 *
 * @param viewerSelector The selector of the viewer.
 * @param shouldEnable Whether the options should be enabled or disabled.
 */
export async function applyStateToHierarchyOptions(
  viewerSelector: string,
  shouldEnable: boolean,
) {
  const options: ElementFinder[] = await element.all(
    by.css(`${viewerSelector} hierarchy-view .view-controls .user-option`),
  );
  for (const option of options) {
    const isEnabled = !(await option.getAttribute('class')).includes(
      'not-enabled',
    );
    if (shouldEnable && !isEnabled) {
      await option.click();
    } else if (!shouldEnable && isEnabled) {
      await option.click();
    }
  }
}

/**
 * Check that an item in the properties tree has the expected text.
 *
 * @param viewer The viewer to check the item in.
 * @param itemName The name of the item to check.
 * @param expectedText The expected text of the item.
 */
export async function checkItemInPropertiesTree(
  viewer: string,
  itemName: string,
  expectedText: string,
) {
  const node = element(
    by.css(`${viewer} .properties-view #node${itemName} .node-property`),
  );
  const text = await node.getText();
  expect(text).toEqual(expectedText);
}

/**
 * Check that a rect label has the expected text.
 *
 * @param viewer The viewer to check the label in.
 * @param expectedLabel The expected text of the label.
 */
export async function checkRectLabel(viewer: string, expectedLabel: string) {
  const labels = await element.all(by.css(`${viewer} rects-view .rect-label`));
  let foundLabel: ElementFinder | undefined;
  for (const label of labels) {
    const text = await label.getText();
    if (text.includes(expectedLabel)) {
      foundLabel = label;
      break;
    }
  }
  expect(foundLabel).toBeTruthy();
}

/**
 * Check that the scroll is present.
 *
 * @param viewerSelector The selector of the viewer.
 */
export async function checkScrollPresent(viewerSelector: string) {
  await browser.wait(
    async () => {
      const scrollIsPresent = await element(
        by.css(`${viewerSelector} .scroll`),
      ).isPresent();
      const placeholderPresent = await element(
        by.css(`${viewerSelector} .fetching-data`),
      ).isPresent();
      return scrollIsPresent && !placeholderPresent;
    },
    5000,
    'Fetching data timeout',
  );
}

/**
 * Check that the total number of scroll entries is correct.
 *
 * @param viewerSelector The selector of the viewer.
 * @param numberOfEntries The expected number of entries.
 * @param scrollToBottom Whether to scroll to the bottom of the scroll view.
 */
export async function checkTotalScrollEntries(
  viewerSelector: string,
  numberOfEntries: number,
  scrollToBottom = false,
) {
  if (scrollToBottom) {
    const viewport = element(by.css(`${viewerSelector} .scroll`));
    let lastId: string | undefined;
    let lastScrollEntryItemId = await getLastScrollEntryItemId(viewerSelector);
    while (lastId !== lastScrollEntryItemId) {
      lastId = lastScrollEntryItemId;
      await viewport.sendKeys(protractor.Key.END);
      await new Promise<void>((resolve) => setTimeout(resolve, 500));
      lastScrollEntryItemId = await getLastScrollEntryItemId(viewerSelector);
    }
  }
  const lastId = await getLastScrollEntryItemId(viewerSelector);
  expect(lastId).toEqual(`${numberOfEntries - 1}`);
}

/**
 * Get the item id of the last scroll entry.
 *
 * @param viewerSelector The selector of the viewer.
 * @return The item id of the last scroll entry.
 */
export async function getLastScrollEntryItemId(
  viewerSelector: string,
): Promise<string> {
  const entries = await element.all(by.css(`${viewerSelector} .scroll .entry`));
  return await entries[entries.length - 1].getAttribute('item-id');
}

/**
 * Check that the select filter works correctly.
 *
 * @param viewerSelector The selector of the viewer.
 * @param filterSelector The selector of the filter.
 * @param options The options to select.
 * @param expectedFilteredEntries The expected number of filtered entries.
 * @param totalEntries The total number of entries.
 */
export async function checkSelectFilter(
  viewerSelector: string,
  filterSelector: string,
  options: string[],
  expectedFilteredEntries: number,
  totalEntries: number,
) {
  await toggleSelectFilterOptions(viewerSelector, filterSelector, options);
  await checkTotalScrollEntries(viewerSelector, expectedFilteredEntries);

  await toggleSelectFilterOptions(viewerSelector, filterSelector, options);
  await checkTotalScrollEntries(viewerSelector, totalEntries, true);
}

/**
 * Upload a fixture file.
 *
 * @param paths The paths to the fixture files.
 */
export async function uploadFixture(...paths: string[]) {
  const inputFile = element(by.css('input[type="file"]'));

  // Clear any previously uploaded files
  await browser.executeScript('arguments[0].value = ""', inputFile);

  // Uploading multiple files is not properly supported but
  // chrome handles file paths joined with new lines
  await inputFile.sendKeys(paths.map((it) => getFixturePath(it)).join('\n'));
}

/**
 * Get the path to a fixture file.
 *
 * @param filename The name of the fixture file.
 * @return The path to the fixture file.
 */
export function getFixturePath(filename: string): string {
  if (path.isAbsolute(filename)) {
    return filename;
  }
  return path.join(getProjectRootPath(), 'src/test/fixtures', filename);
}

/**
 * Get the path to the project root.
 *
 * @return The path to the project root.
 */
export function getProjectRootPath(): string {
  let root = __dirname;
  while (path.basename(root) !== 'winscope') {
    root = path.dirname(root);
  }
  return root;
}

async function checkHasLoadedTracesFromBugReport() {
  const text = await element(by.css('.uploaded-files')).getText();
  expect(text).toContain('Window Manager');
  expect(text).toContain('Surface Flinger');
  expect(text).toContain('Transactions');
  expect(text).toContain('Transitions');

  // Should be merged into a single Transitions trace
  expect(text).not.toContain('WM Transitions');
  expect(text).not.toContain('Shell Transitions');

  expect(text).toContain('layers_trace_from_transactions.winscope');
  expect(text).toContain('transactions_trace.winscope');
  expect(text).toContain('wm_transition_trace.winscope');
  expect(text).toContain('shell_transition_trace.winscope');
  expect(text).toContain('window_CRITICAL.proto');

  // discards some traces due to old data
  expect(text).not.toContain('ProtoLog');
  expect(text).not.toContain('IME Service');
  expect(text).not.toContain('IME system_server');
  expect(text).not.toContain('IME Clients');
  expect(text).not.toContain('wm_log.winscope');
  expect(text).not.toContain('ime_trace_service.winscope');
  expect(text).not.toContain('ime_trace_managerservice.winscope');
  expect(text).not.toContain('wm_trace.winscope');
  expect(text).not.toContain('ime_trace_clients.winscope');
}

async function checkEmitsUnsupportedFileFormatMessages() {
  const text = await element(by.css('snack-bar')).getText();
  expect(text).toContain('unsupported format');
}

async function checkEmitsOldDataMessages() {
  const text = await element(by.css('snack-bar')).getText();
  expect(text).toContain('discarded because data is old');
}

async function toggleSelectFilterOptions(
  viewerSelector: string,
  filterSelector: string,
  options: string[],
) {
  await element(
    by.css(
      `${viewerSelector} .headers ${filterSelector} .mat-mdc-select-trigger`,
    ),
  ).click();
  const optionElements: ElementFinder[] = await element.all(
    by.css('.mat-mdc-select-panel .option'),
  );
  for (const optionEl of optionElements) {
    const optionText = (await optionEl.getText()).trim();
    if (options.some((option) => optionText === option)) {
      await optionEl.click();
      options = options.filter((option) => option !== optionText);
      if (options.length === 0) {
        break;
      }
    }
  }
  const backdrop = await element(
    by.css('.cdk-overlay-backdrop'),
  ).getWebElement();
  await browser.actions().mouseMove(backdrop, {x: 0, y: 0}).click().perform();
}
