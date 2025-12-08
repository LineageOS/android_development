#!/usr/bin/python3
"""This is an ADB proxy for Winscope.

Requirements: python3.10 and ADB installed and in system PATH.

Usage:
  run: python3 winscope_proxy.py
"""

# Copyright (C) 2019 The Android Open Source Project
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

import abc
import argparse
import base64
import enum
import gzip
import http
from http import server
import json
import logging
import os
import re
import secrets
import signal
import subprocess
import sys
import tempfile
import threading
import time


INFO = logging.INFO
DEBUG = logging.DEBUG
NamedTemporaryFile = tempfile.NamedTemporaryFile
HTTPServer = server.HTTPServer
BaseHTTPRequestHandler = server.BaseHTTPRequestHandler
HTTPStatus = http.HTTPStatus
Enum = enum.Enum
abstractmethod = abc.abstractmethod
version = sys.version_info
assert (
    version.major == 3 and version.minor >= 10
), "This script requires Python 3.10+ and ADB installed and in system PATH."

# GLOBALS #

log = logging.getLogger("Temp")
secret_token: str = ""

# Keep in sync with winscope_proxy_utils VERSION in Winscope
VERSION = "6.0.1"

WINSCOPE_VERSION_HEADER = "Winscope-Proxy-Version"
WINSCOPE_TOKEN_HEADER = "Winscope-Token"

# Location to save the proxy security token
WINSCOPE_TOKEN_LOCATION = os.path.expanduser("~/.config/winscope/.token")

# Tracing handlers
SIGNAL_HANDLER_LOG = "/data/local/tmp/winscope_signal_handler.log"
WINSCOPE_STATUS = "/data/local/tmp/winscope_status"

# Max interval between the client keep-alive requests in seconds
KEEP_ALIVE_INTERVAL_S = 5

# Perfetto's default timeout for getting an ACK from producer processes is 5s
# We need to be sure that the timeout is longer than that with a good margin.
COMMAND_TIMEOUT_S = 15


# CONFIG #


def create_argument_parser() -> argparse.ArgumentParser:
  """Creates and returns the argument parser for the script.

  Returns:
    An argparse.ArgumentParser instance with defined arguments.
  """
  parser = argparse.ArgumentParser(
      description="Proxy for go/winscope", prog="winscope_proxy"
  )

  parser.add_argument(
      "--info", "-i", dest="loglevel", action="store_const", const=INFO
  )
  parser.add_argument("--port", "-p", default=5544, action="store")

  parser.set_defaults(loglevel=DEBUG)

  return parser


def get_token() -> str:
  """Returns saved proxy security token or creates new one."""
  try:
    with open(WINSCOPE_TOKEN_LOCATION, "r") as token_file:
      token = token_file.readline()
      log.debug("Loaded token %s from %s", token, WINSCOPE_TOKEN_LOCATION)
      return token
  except IOError:
    token = secrets.token_hex(32)
    os.makedirs(os.path.dirname(WINSCOPE_TOKEN_LOCATION), exist_ok=True)
    try:
      with open(WINSCOPE_TOKEN_LOCATION, "w") as token_file:
        log.debug(
            "Created and saved token %s to %s", token, WINSCOPE_TOKEN_LOCATION
        )
        token_file.write(token)
      os.chmod(WINSCOPE_TOKEN_LOCATION, 0o600)
    except IOError:
      log.error(
          "Unable to save persistent token %s to %s",
          token,
          WINSCOPE_TOKEN_LOCATION,
      )
    return token


class RequestType(Enum):
  GET = 1
  POST = 2
  HEAD = 3


class RequestEndpoint:
  """Request endpoint to use with the RequestRouter."""

  @abstractmethod
  def process(self, http_server, path):
    pass


class AdbError(Exception):
  """Unsuccessful ADB operation."""

  pass


class BadRequestError(Exception):
  """Invalid client request."""

  pass


class RequestRouter:
  """Handles HTTP request authentication and routing."""

  def __init__(self, handler):
    self.request = handler
    self.endpoints = {}

  def register_endpoint(
      self, method: RequestType, name: str, endpoint: RequestEndpoint
  ):
    self.endpoints[(method, name)] = endpoint

  def _bad_request(self, error: str):
    """Responds to the client with a BAD_REQUEST status.

    Args:
      error: A string describing the reason for the bad request.
    """
    log.warning("Bad request: %s", error)
    self.request.respond(
        HTTPStatus.BAD_REQUEST,
        (
            f"Bad request!{os.linesep}This is Winscope ADB proxy.{os.linesep}{os.linesep}"
        ).encode("utf-8")
        + error.encode("utf-8"),
        "text/txt",
    )

  def _internal_error(self, error: str):
    """Responds to the client with an INTERNAL_SERVER_ERROR status.

    Args:
      error: A string describing the internal error.
    """
    log.error("Internal error: %s", error)
    self.request.respond(
        HTTPStatus.INTERNAL_SERVER_ERROR, error.encode("utf-8"), "text/txt"
    )

  def _bad_token(self):
    """Responds to the client with a FORBIDDEN status due to a bad token."""
    log.warning("Bad token")
    self.request.respond(
        HTTPStatus.FORBIDDEN,
        (
            f"Bad Winscope authorization token!{os.linesep}This is Winscope ADB"
            f" proxy.{os.linesep}"
        ).encode("utf-8"),
        "text/txt",
    )

  def process(self, method: RequestType):
    """Processes an incoming HTTP request.

    Authenticates the request using the Winscope token and routes it to the
    appropriate endpoint based on the method and path.

    Args:
      method: The HTTP request method (GET, POST, HEAD).

    Returns:
      None. The response is sent directly via `self.request.respond`.
    """
    token = self.request.headers[WINSCOPE_TOKEN_HEADER]
    if not token or token != secret_token:
      return self._bad_token()
    path = self.request.path.strip("/").split("/")
    if path:
      endpoint_name = path[0]
      try:
        return self.endpoints[(method, endpoint_name)].process(
            self.request, path[1:]
        )
      except KeyError as ex:
        if "RequestType" in repr(ex):
          return self._bad_request(
              "Unknown endpoint /%s/" % endpoint_name
          )
        return self._internal_error(repr(ex))
      except AdbError as ex:
        return self._internal_error(str(ex))
      except BadRequestError as ex:
        return self._bad_request(str(ex))
      except Exception as ex:  # pylint: disable=broad-exception-caught
        # Catching broad Exception is acceptable here as this is the top-level
        # exception handler for request processing. Any unhandled exception
        # indicates an internal server error and should be reported as such
        # to prevent the server from crashing.
        return self._internal_error(repr(ex))
    self._bad_request("No endpoint specified")


def call_adb(params: str, device: str | None = None):
  """Calls an ADB command.

  Args:
    params: The parameters for the adb command as a single string.
    device: The optional device ID to target the command.

  Returns:
    The standard output of the adb command if successful.

  Raises:
    AdbError: If an OSError occurs during command execution.
  """
  command = ["adb"] + (["-s", device] if device else []) + params.split(" ")
  command_str = " ".join(command)
  try:
    log.debug("Call: %s", command_str)
    return subprocess.check_output(command, stderr=subprocess.STDOUT).decode(
        "utf-8"
    )
  except OSError as ex:
    raise AdbError(
        "OS Error executing adb command: %s%s%s"
        % (command_str, os.linesep, repr(ex))
    ) from ex
  except subprocess.CalledProcessError as ex:
    return "Error executing adb command: %s: %s" % (
        command_str,
        ex.output.decode("utf-8"),
    )


# ENDPOINTS #


class ListDevicesEndpoint(RequestEndpoint):
  """Endpoint to list connected ADB devices."""

  ADB_INFO_RE = re.compile("^([A-Za-z0-9._:\\-]+)\\s+(\\w+)(.*model:(\\w+))?")

  def process(self, http_server, path):
    """Processes the request to list connected ADB devices.

    Args:
      http_server: The HTTP server handler.
      path: The request path components.
    """
    lines = list(filter(None, (call_adb("devices -l") or "").split(os.linesep)))
    devices = []
    for m in [ListDevicesEndpoint.ADB_INFO_RE.match(d) for d in lines[1:]]:
      if m:
        authorized = str(m.group(2)) != "unauthorized"
        device = {
            "id": m.group(1),
            "authorized": authorized,
            "model": m.group(4).replace("_", " ") if m.group(4) else "",
        }
        devices.append(device)
    j = json.dumps(devices)
    log.info("Detected devices: %s", j)
    http_server.respond(HTTPStatus.OK, j.encode("utf-8"), "text/json")


class DeviceRequestEndpoint(RequestEndpoint):
  """Base class for endpoints that operate on a specific device."""

  def process(self, http_server, path):
    """Processes a request for a specific device.

    Extracts the device ID from the path and calls process_with_device.

    Args:
      http_server: The HTTP server handler.
      path: The request path components, where the first component should be the
        device ID.

    Raises:
      BadRequestError: If the device ID is not specified or invalid.
    """
    if path and re.fullmatch("[A-Za-z0-9._:\\-]+", path[0]):
      self.process_with_device(http_server, path[1:], path[0])
    else:
      raise BadRequestError("Device id not specified")

  @abstractmethod
  def process_with_device(self, http_server, path, device_id):
    """Processes the request with a specific device ID.

    Args:
      http_server: The HTTP server handler.
      path: The remaining path components after the device ID.
      device_id: The ID of the target device.
    """
    pass

  def get_request(self, http_server) -> dict[str, str]:
    """Reads and parses the JSON request body.

    Args:
      http_server: The HTTP server handler.

    Returns:
      A dictionary containing the parsed JSON request body.

    Raises:
      BadRequestError: If the Content-Length header is missing or unreadable,
                  or if the JSON is invalid.
    """
    try:
      length = int(http_server.headers["Content-Length"])
    except KeyError as err:
      raise BadRequestError(
          "Missing Content-Length header" + os.linesep + str(err)
      ) from err
    except ValueError as err:
      raise BadRequestError(
          "Content length unreadable" + os.linesep + str(err)
      ) from err
    return json.loads(http_server.rfile.read(length).decode("utf-8"))


class FetchEndpoint(DeviceRequestEndpoint):
  """Endpoint to fetch a file from a device."""

  def process_with_device(self, http_server, path: list[str], device_id):
    """Fetches a specified file from the device.

    Args:
      http_server: The HTTP server handler.
      path: The path to the file on the device.
      device_id: The ID of the target device.
    """
    filepath = "/".join(path)
    log.debug(filepath)
    file_buffer = self.fetch_existing_file(filepath, device_id)
    http_server.respond(
        HTTPStatus.OK, json.dumps(file_buffer).encode("utf-8"), "text/json"
    )

  def fetch_existing_file(self, filepath, device_id):
    """Fetches a file from the device and returns its content.

    The file content is gzipped and base64 encoded.

    Args:
      filepath: The path of the file on the device.
      device_id: The ID of the target device.

    Returns:
      A dictionary containing the base64 encoded, gzipped file content,
      or None if the file could not be fetched.
    """
    file_buffer = dict()
    try:
      with NamedTemporaryFile() as tmp:
        log.debug("Fetching file %s from device to %s", filepath, tmp.name)
        try:
          self.call_adb_outfile("exec-out cat " + filepath, tmp, device_id)
        except AdbError as ex:
          log.warning("Unable to fetch file %s - %r", filepath, ex)
          return
        log.debug("Uploading file %s", tmp.name)
        buf = base64.encodebytes(gzip.compress(tmp.read())).decode("utf-8")
        file_buffer[filepath] = buf
    except Exception:  # pylint: disable=broad-exception-caught
      self.log_no_files_warning()
    return file_buffer

  def log_no_files_warning(self):
    """Logs a warning when no files are found to fetch."""
    log.warning("Proxy didn't find any file to fetch")

  def call_adb_outfile(self, params: str, outfile, device: str):
    """Calls an ADB command and redirects stdout to a file.

    Args:
      params: The parameters for the adb command.
      outfile: The file object to write stdout to.
      device: The ID of the target device.

    Raises:
      AdbError: If an error occurs during the ADB command execution.
    """
    try:
      process = subprocess.Popen(
          ["adb"] + ["-s", device] + params.split(" "),
          stdout=outfile,
          stderr=subprocess.PIPE,
      )
      _, err = process.communicate()
      outfile.seek(0)
      if process.returncode != 0:
        raise AdbError(
            "Error executing adb command: adb %s%s" % (params, os.linesep)
            + err.decode("utf-8")
            + os.linesep
            + outfile.read().decode("utf-8")
        )
    except OSError as ex:
      raise AdbError(
          "Error executing adb command: adb %s%s%s"
          % (params, os.linesep, repr(ex))
      ) from ex


class TraceThread(threading.Thread):
  """A thread to manage and run an ADB shell trace command."""

  def __init__(
      self, target_id: str, device_id: str, command: str, status_filename: str
  ):
    """Initializes the TraceThread.

    Args:
      target_id: A unique identifier for the trace.
      device_id: The ID of the target device.
      command: The ADB shell command to execute for the trace.
      status_filename: The filename on the device used to signal trace status.

    Raises:
      AdbError: If an OSError occurs when starting the subprocess.
    """
    self.trace_command = command
    self.target_id = target_id
    self.status_filename = status_filename
    self._device_id = device_id
    self._keep_alive_timer = None
    self.out = (None,)
    self.err = (None,)
    self._command_timed_out = False
    self._success = False
    try:
      shell = self.get_shell_args()
      self.process = subprocess.Popen(
          shell,
          stdout=subprocess.PIPE,
          stderr=subprocess.PIPE,
          stdin=subprocess.PIPE,
          start_new_session=True,
      )
    except OSError as ex:
      raise AdbError(
          "Error executing adb command for trace %s: %s"
          % (target_id, repr(ex))
      ) from ex

    super().__init__()

  def get_shell_args(self) -> list[str]:
    """Gets the arguments for the ADB shell command.

    Returns:
      A list of strings representing the ADB shell command arguments.
    """
    shell = ["adb", "-s", self._device_id, "shell"]
    log.debug("Starting trace shell %s", " ".join(shell))
    return shell

  def timeout(self):
    """Handles the keep-alive timeout event.

    If the thread is still alive, it logs a warning and calls end_trace.
    """
    if self.is_alive():
      log.warning(
          "Keep-alive timeout for %s trace on %s",
          self.target_id,
          self._device_id,
      )
      self.end_trace()

  def reset_timer(self):
    """Resets the keep-alive timer.

    This should be called periodically by the client to indicate the trace is
    still active.
    """
    log.info(
        "Resetting keep-alive clock for %s trace on %s",
        self.target_id,
        self._device_id,
    )
    if self._keep_alive_timer:
      self._keep_alive_timer.cancel()
    self._keep_alive_timer = threading.Timer(
        KEEP_ALIVE_INTERVAL_S, self.timeout
    )
    self._keep_alive_timer.start()

  def end_trace(self):
    """Ends the trace by stopping the keep-alive timer and terminating the process.

    Sends SIGTERM to the trace process and waits for it to exit. If the process
    doesn't exit within COMMAND_TIMEOUT_S, it sends SIGKILL.
    """
    if self._keep_alive_timer:
      self._keep_alive_timer.cancel()
    log.info(
        "Sending SIGTERM to the %s process on %s",
        self.target_id,
        self._device_id,
    )
    self.process.send_signal(signal.SIGTERM)
    try:
      log.debug(
          "Waiting for %s trace shell to exit for %s",
          self.target_id,
          self._device_id,
      )
      self.process.wait(timeout=COMMAND_TIMEOUT_S)
    except TimeoutError:
      log.error(
          "TIMEOUT - sending SIGKILL to the %s trace process on %s",
          self.target_id,
          self._device_id,
      )
      self.process.kill()
    self.join()

  def run(self):
    """The main execution loop for the trace thread.

    Starts the trace command, waits for it to complete, and monitors the
    status file on the device.
    """
    retry_interval = 0.1
    log.info("Trace %s started on %s", self.target_id, self._device_id)
    self.reset_timer()
    self.out, self.err = self.process.communicate(
        self.trace_command.encode("utf-8")
    )
    log.info(
        "Trace %s ended on %s, waiting for cleanup",
        self.target_id,
        self._device_id,
    )
    time.sleep(0.2)
    for _ in range(int(COMMAND_TIMEOUT_S / retry_interval)):
      if (
          call_adb(f"shell cat {self.status_filename}", device=self._device_id)
          == "TRACE_OK" + os.linesep
      ):
        log.info("Trace %s finished on %s", self.target_id, self._device_id)
        if self.target_id == "PerfettoTrace":
          self._success = True
        else:
          self._success = not self.err
        return
      log.debug(
          "Still waiting for cleanup on %s for %s",
          self._device_id,
          self.target_id,
      )
      time.sleep(retry_interval)

    self._command_timed_out = True

  def success(self):
    """Checks if the trace completed successfully.

    Returns:
      True if the trace was successful, False otherwise.
    """
    return self._success

  def timed_out(self):
    """Checks if the trace command timed out during cleanup.

    Returns:
      True if the command timed out, False otherwise.
    """
    return self._command_timed_out


TRACE_THREADS: dict[str, dict[str, TraceThread]] = {}


class StartTraceEndpoint(DeviceRequestEndpoint):
  """Endpoint to start a trace on a specific device."""

  COMMAND = """
set -e

echo "Opening shell..."
echo "TRACE_START" > {winscope_status}

# Do not print anything to stdout/stderr in the handler
function close_shell() {{
  echo "start" >{signal_handler_log}

  # redirect stdout/stderr to log file
  exec 1>>{signal_handler_log}
  exec 2>>{signal_handler_log}

  set -x
  trap - EXIT HUP INT
  {stop_commands}
  echo "TRACE_OK" > {winscope_status}
}}

trap close_shell EXIT HUP INT
echo "Signal handler registered."

{start_commands}

# ADB shell does not handle hung up well and does not call HUP handler when a child is active in foreground,
# as a workaround we sleep for short intervals in a loop so the handler is called after a sleep interval.
while true; do sleep 0.1; done
"""

  def process_with_device(self, http_server, path, device_id):
    """Starts a trace on the specified device.

    Args:
      http_server: The HTTP server handler.
      path: The request path components.
      device_id: The ID of the target device.
    """
    request: dict[str, str] = self.get_request(http_server)
    target_id: str = request.get("targetId", "")
    start_cmd: str = request.get("startCmd", "")
    stop_cmd: str = request.get("stopCmd", "")
    status_filename = WINSCOPE_STATUS + "_" + target_id

    command = StartTraceEndpoint.COMMAND.format(
        winscope_status=status_filename,
        signal_handler_log=SIGNAL_HANDLER_LOG,
        stop_commands=stop_cmd,
        start_commands=start_cmd,
    )
    log.debug("Executing start command for %s on %s...", target_id, device_id)
    thread = TraceThread(target_id, device_id, command, status_filename)
    if device_id not in TRACE_THREADS:
      threads = {}
      threads[target_id] = thread
      TRACE_THREADS[device_id] = threads

    else:
      TRACE_THREADS[device_id][target_id] = thread
    thread.start()

    http_server.respond(HTTPStatus.OK, "".encode("utf-8"), "text/json")


class EndTraceEndpoint(DeviceRequestEndpoint):
  """Endpoint to signal the end of a trace and collect results."""

  def process_with_device(self, http_server, path, device_id):
    """Ends a trace and collects logs and status.

    Args:
      http_server: The HTTP server handler.
      path: The request path components.
      device_id: The ID of the target device.

    Raises:
      BadRequestError: If no trace is in progress for the device or target ID.
    """
    if device_id not in TRACE_THREADS:
      raise BadRequestError("No trace in progress for %s" % device_id)

    request = self.get_request(http_server)
    target_id = request.get("targetId")
    threads = TRACE_THREADS[device_id]
    if target_id not in threads:
      raise BadRequestError(
          "No %s trace in progress for %s" % (target_id, device_id)
      )

    errors: list[str] = []
    thread = threads[target_id]

    if thread.is_alive():
      thread.end_trace()
    success = thread.success()
    signal_handler_log = (
        call_adb(f"shell cat {SIGNAL_HANDLER_LOG}", device=device_id) or ""
    ).encode("utf-8")

    if thread.timed_out():
      timeout_message = "Trace %s timed out during cleanup" % target_id
      errors.append(timeout_message)
      log.error(timeout_message)

    if not success:
      log.error("Error ending trace %s on the device", target_id)
      errors.append(
          "Error ending trace %s on the device: %s" % (target_id, thread.err)
      )

    out = (
        f"### Shell script's stdout ###{os.linesep}".encode("utf-8")
        + (thread.out if thread.out else b"<no stdout>")
        + f"{os.linesep}### Shell script's stderr ###{os.linesep}".encode(
            "utf-8"
        )
        + (thread.err if thread.err else b"<no stderr>")
        + f"{os.linesep}### Signal handler log ###{os.linesep}".encode(
            "utf-8"
        )
        + (
            signal_handler_log
            if signal_handler_log
            else b"<no signal handler logs>"
        )
        + os.linesep.encode("utf-8")
    )
    log.debug("### Output ###%s%s", os.linesep, out.decode("utf-8"))

    call_adb(f"shell rm {thread.status_filename}", device=device_id)

    threads.pop(target_id)

    if not threads:
      TRACE_THREADS.pop(device_id)
    http_server.respond(
        HTTPStatus.OK, json.dumps(errors).encode("utf-8"), "text/plain"
    )


class StatusEndpoint(DeviceRequestEndpoint):
  """Endpoint to check the status of a trace on a specific device."""

  def process_with_device(self, http_server, path, device_id):
    """Checks if a specific trace is still alive.

    Args:
      http_server: The HTTP server handler.
      path: The request path components, where path[0] is the target ID.
      device_id: The ID of the target device.

    Raises:
      BadRequestError: If no trace is in progress for the device.
    """
    if device_id not in TRACE_THREADS:
      raise BadRequestError("No trace in progress for %s" % device_id)

    if path[0] not in TRACE_THREADS[device_id]:
      log.debug(path[0])
      log.debug(TRACE_THREADS[device_id])
      http_server.respond(
          HTTPStatus.OK, str(False).encode("utf-8"), "text/plain"
      )
    else:
      thread = TRACE_THREADS[device_id][path[0]]
      thread.reset_timer()
      http_server.respond(
          HTTPStatus.OK, str(thread.is_alive()).encode("utf-8"), "text/plain"
      )


class RunAdbCmdEndpoint(DeviceRequestEndpoint):
  """Endpoint to run an arbitrary ADB command on a device."""

  def process_with_device(self, http_server, path, device_id):
    """Runs a provided ADB command on the specified device.

    Args:
      http_server: The HTTP server handler.
      path: The request path components.
      device_id: The ID of the target device.
    """
    request: dict[str, str] = self.get_request(http_server)
    cmd: str = request.get("cmd", "")
    output = call_adb(cmd, device_id)
    http_server.respond(
        HTTPStatus.OK, json.dumps(output).encode("utf-8"), "text/plain"
    )


class ADBWinscopeProxy(BaseHTTPRequestHandler):
  """Handles HTTP requests for the Winscope ADB proxy.

  This class sets up the request router and registers the various endpoints
  for interacting with ADB.
  """

  def __init__(self, request, client_address, http_server):
    self.router = RequestRouter(self)
    list_devices_endpoint = ListDevicesEndpoint()
    self.router.register_endpoint(
        RequestType.GET, "devices", list_devices_endpoint
    )
    self.router.register_endpoint(RequestType.GET, "status", StatusEndpoint())
    self.router.register_endpoint(RequestType.GET, "fetch", FetchEndpoint())
    self.router.register_endpoint(
        RequestType.POST, "runadbcmd", RunAdbCmdEndpoint()
    )
    self.router.register_endpoint(
        RequestType.POST, "starttrace", StartTraceEndpoint()
    )
    self.router.register_endpoint(
        RequestType.POST, "endtrace", EndTraceEndpoint()
    )
    super().__init__(request, client_address, http_server)

  def respond(self, code: int, data: bytes, mime: str) -> None:
    """Sends an HTTP response to the client.

    Args:
      code: The HTTP status code.
      data: The response body as bytes.
      mime: The MIME type of the response.
    """
    self.send_response(code)
    self.send_header("Content-type", mime)
    self.add_standard_headers()
    self.wfile.write(data)

  # pylint: disable=invalid-name
  def do_GET(self):
    """Handles HTTP GET requests."""
    self.router.process(RequestType.GET)

  # pylint: disable=invalid-name
  def do_POST(self):
    """Handles HTTP POST requests."""
    self.router.process(RequestType.POST)

  # pylint: disable=invalid-name
  def do_OPTIONS(self):
    """Handles HTTP OPTIONS requests."""
    self.send_response(HTTPStatus.OK)
    self.send_header("Allow", "GET,POST")
    self.add_standard_headers()
    self.end_headers()
    self.wfile.write(b"GET,POST")

  def log_request(self, code="-", size="-"):
    """Logs the HTTP request.

    Args:
      code: The HTTP status code of the response.
      size: The size of the response.
    """
    log.info("%s %s %s", self.requestline, code, size)

  def add_standard_headers(self):
    """Adds standard headers to the HTTP response."""
    self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
    self.send_header("Access-Control-Allow-Origin", "*")
    self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
    self.send_header(
        "Access-Control-Allow-Headers",
        WINSCOPE_TOKEN_HEADER + ", Content-Type, Content-Length",
    )
    self.send_header("Access-Control-Expose-Headers", "Winscope-Proxy-Version")
    self.send_header(WINSCOPE_VERSION_HEADER, VERSION)
    self.end_headers()


if __name__ == "__main__":
  args = create_argument_parser().parse_args()

  logging.basicConfig(
      stream=sys.stderr,
      level=args.loglevel,
      format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
  )

  log = logging.getLogger("ADBProxy")
  secret_token = get_token()

  print("Winscope ADB Connect proxy version: " + VERSION)
  print("Winscope token: " + secret_token)

  httpd = HTTPServer(("localhost", args.port), ADBWinscopeProxy)
  try:
    httpd.serve_forever()
  except KeyboardInterrupt:
    log.info("Shutting down")
