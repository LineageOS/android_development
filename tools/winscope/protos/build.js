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
const {exec} = require('child_process');
const path = require('path');
const fs = require('fs');

const ANDROID_BUILD_TOP = path.resolve(__dirname, '../../../../');
const WINSCOPE_TOP = path.resolve(__dirname, '..');
const PERFETTO_TOP = path.join(ANDROID_BUILD_TOP, 'external/perfetto');
const OUT_TOP = path.join(__dirname, '../deps_build/protos');

const PROTOC_PATH = path.resolve(WINSCOPE_TOP, 'node_modules/grpc-tools/bin/protoc');
const PROTOC_PLUGIN_PATH = path.resolve(WINSCOPE_TOP, 'node_modules/ts-protoc-gen/bin/protoc-gen-ts');

build();

async function build() {
  await runCommand(`rm -rf ${OUT_TOP}`);
  await runCommand(`mkdir -p ${OUT_TOP}`);

  const clockSnapshotPath = path.join(PERFETTO_TOP, 'protos/perfetto/trace/clock_snapshot.proto');
  const tracePacketPath = path.join(PERFETTO_TOP, 'protos/perfetto/trace/trace_packet.proto');

  const origClockSnapshot = fs.readFileSync(clockSnapshotPath, 'utf8');
  const origTracePacket = fs.readFileSync(tracePacketPath, 'utf8');

  let modifiedClockSnapshot = origClockSnapshot.replace(
    'optional uint64 timestamp = 2;',
    'optional uint64 timestamp = 2 [jstype = JS_STRING];'
  ).replace(
    'optional uint64 unit_multiplier_ns = 4;',
    'optional uint64 unit_multiplier_ns = 4 [jstype = JS_STRING];'
  );

  let modifiedTracePacket = origTracePacket.replace(
    'optional uint64 timestamp = 8;',
    'optional uint64 timestamp = 8 [jstype = JS_STRING];'
  );

  try {
    fs.writeFileSync(clockSnapshotPath, modifiedClockSnapshot);
    fs.writeFileSync(tracePacketPath, modifiedTracePacket);

    // Common protos
    const commonFiles = getProtoFiles(path.join(WINSCOPE_TOP, 'protos/common'));

    const promises = [
      // IME udc
      buildProtos(
      getProtoFiles(path.join(WINSCOPE_TOP, 'protos/ime/udc')).concat(commonFiles),
      'ime/udc'
    ),

    // ProtoLog udc
    buildProtos(
      getProtoFiles(path.join(WINSCOPE_TOP, 'protos/protolog/udc')).concat(commonFiles),
      'protolog/udc'
    ),

    // SurfaceFlinger udc
    buildProtos(
      getProtoFiles(path.join(WINSCOPE_TOP, 'protos/surfaceflinger/udc')).concat(commonFiles),
      'surfaceflinger/udc'
    ),

    // Transactions udc
    buildProtos(
      getProtoFiles(path.join(WINSCOPE_TOP, 'protos/surfaceflinger/udc')).concat(commonFiles),
      'surfaceflinger/udc'
    ),

    // Transitions udc
    buildProtos(
      getProtoFiles(path.join(WINSCOPE_TOP, 'protos/transitions/udc')).concat(commonFiles),
      'transitions/udc'
    ),

    // ViewCapture udc
    buildProtos(
      getProtoFiles(path.join(WINSCOPE_TOP, 'protos/viewcapture/udc')).concat(commonFiles),
      'viewcapture/udc'
    ),

    // WindowManager udc
    buildProtos(
      getProtoFiles(path.join(WINSCOPE_TOP, 'protos/windowmanager/udc')).concat(commonFiles),
      'windowmanager/udc'
    ),

    // Test proto fields
    buildProtos(
      ['test/fake_proto_test.proto'],
      'test/fake_proto'
    ),

    // Test intdef translation
    buildProtos(
      ['test/intdef_translation_test.proto'],
      'test/intdef_translation',
      true
    ),

    // Perfetto trace
    buildProtos(
      getProtoFiles(path.join(PERFETTO_TOP, 'protos/perfetto/trace')),
      'perfetto/trace',
      true // generate descriptor set for reflection
    ),

    // Perfetto trace_processor
    buildProtos(
      getProtoFiles(path.join(PERFETTO_TOP, 'protos/perfetto/trace_processor')),
      'perfetto/trace_processor'
    ),

    // Perfetto metrics
    buildProtos(
      getProtoFiles(path.join(PERFETTO_TOP, 'protos/perfetto/metrics')),
      'perfetto/metrics'
    ),

    // Perfetto common
    buildProtos(
      getProtoFiles(path.join(PERFETTO_TOP, 'protos/perfetto/common')),
      'perfetto/common'
    ),

    // Perfetto config
    buildProtos(
      getProtoFiles(path.join(PERFETTO_TOP, 'protos/perfetto/config')),
      'perfetto/config'
    ),

    // Perfetto trace_summary
    buildProtos(
      getProtoFiles(path.join(PERFETTO_TOP, 'protos/perfetto/trace_summary')),
      'perfetto/trace_summary'
    ),

    // Perfetto perfetto_sql
    buildProtos(
      getProtoFiles(path.join(PERFETTO_TOP, 'protos/perfetto/perfetto_sql')),
      'perfetto/perfetto_sql'
    ),

    // Perfetto protovm
    buildProtos(
      getProtoFiles(path.join(PERFETTO_TOP, 'protos/perfetto/protovm')),
      'perfetto/protovm'
    ),

    // Test proto fields and intdef
    buildProtos(
      ['test/fake_proto_test.proto'],
      'test/fake_proto',
      true // generate descriptor set
    ),
    buildProtos(
      ['test/intdef_translation_test.proto', 'test/typedef.proto'],
      'test/intdef_translation',
      true // generate descriptor set
    ),
  ];

    await Promise.all(promises);
  } finally {
    fs.writeFileSync(clockSnapshotPath, origClockSnapshot);
    fs.writeFileSync(tracePacketPath, origTracePacket);
  }
}

function getProtoFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.resolve(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      /* Recurse into a subdirectory */
      results = results.concat(getProtoFiles(file));
    } else {
      /* Is a file */
      if (file.endsWith('.proto')) {
        // kfree.proto, kmalloc.proto, and print.proto are definitions that are also present in other files
        // (kmem.proto, ftrace.proto) and cause duplicate definition errors.
        // perfetto_trace.proto is a monolithic file that conflicts with individual proto files.
        if (
          file.endsWith('ftrace/kfree.proto') ||
          file.endsWith('ftrace/kmalloc.proto') ||
          file.endsWith('ftrace/print.proto') ||
          file.endsWith('/perfetto_trace.proto') ||
          file.endsWith('/perfetto_merged_metrics.proto') ||
          file.endsWith('/perfetto_config.proto')
        ) {
          return;
        }
        results.push(file);
      }
    }
  });
  return results;
}

async function buildProtos(protoPaths, outSubdir, generateDescriptorSet = false) {
  const outDir = path.join(OUT_TOP, outSubdir);
  const protoFullPaths = protoPaths.map((p) => path.isAbsolute(p) ? p : path.join(__dirname, p));

  // Ensure output directory exists
  await runCommand(`mkdir -p ${outDir}`);

  const protoDirs = [...new Set(protoFullPaths.map((p) => path.dirname(p)))];
  const command = [
    PROTOC_PATH,
    `--plugin="protoc-gen-ts=${PROTOC_PLUGIN_PATH}"`,
    `--js_out="import_style=commonjs,binary:${OUT_TOP}"`,
    `--ts_out="${OUT_TOP}"`,
    `--proto_path=${PERFETTO_TOP}`,
    `--proto_path=${WINSCOPE_TOP}`,
    ...protoDirs.map((dir) => `--proto_path=${dir}`),
    generateDescriptorSet ? `--descriptor_set_out=${outDir}/descriptors.bin` : '',
    generateDescriptorSet ? '--include_imports' : '',
    ...protoFullPaths,
  ].filter(Boolean).join(' ');

  console.log(`Command for ${outSubdir}:`, command);


  await runCommand(command);

  if (generateDescriptorSet) {
    const fs = require('fs');
    const binPath = `${outDir}/descriptors.bin`;
    const tsPath = `${outDir}/descriptors.ts`;
    if (fs.existsSync(binPath)) {
      const buffer = fs.readFileSync(binPath);
      const uint8Array = new Uint8Array(buffer);
      const tsContent = `export const descriptors = new Uint8Array([${uint8Array.toString()}]);`;
      fs.writeFileSync(tsPath, tsContent);
      console.log(`Generated ${tsPath}`);
    }
  }
}

function runCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (err, stdout, stderr) => {
      if (err) {
        const errorMessage =
          'Failed to execute command' +
          `\n\ncommand: ${command}` +
          `\n\nstdout: ${stdout}` +
          `\n\nstderr: ${stderr}`;
        reject(errorMessage);
      }
      resolve();
    });
  });
}
