// Copyright (C) 2025 The Android Open Source Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//! Tool to automatically fix Clippy lints.

// Usage: RUST_LOG=debug cargo run -- <prebuilt version> <repo>
//
// <prebuilt version> should be the name of the directory in prebuilts/rust/linux-x86/.
// For example, "1.88.0.test"
//
// <repo> should be the absolute path to an Android source repo, preferably "main"
// to ensure that the vendor repos are checked as well.

// Loosely based on https://github.com/rust-lang/cargo/blob/master/crates/rustfix/examples/fix-json.rs

use std::{
    collections::{BTreeMap, BTreeSet, HashSet},
    env::set_current_dir,
    fs::{read_to_string, write},
    path::PathBuf,
    process::{Command, ExitStatus},
};

use anyhow::{bail, Context, Result};
use clap::Parser;
use log::debug;
use regex::Regex;

#[derive(Parser)]
struct Cli {
    rust_prebuilts_version: String,
    android_root: PathBuf,
}

pub trait SuccessOrError {
    fn success_or_error(self) -> Result<Self>
    where
        Self: std::marker::Sized;
}
impl SuccessOrError for ExitStatus {
    fn success_or_error(self) -> Result<Self> {
        if !self.success() {
            let exit_code =
                self.code().map(|code| format!("{code}")).unwrap_or("(unknown)".to_string());
            bail!("Process failed with exit code {exit_code}");
        }
        Ok(self)
    }
}
pub trait RunAndStreamOutput {
    fn run_and_stream_output(&mut self) -> Result<ExitStatus>;
}
impl RunAndStreamOutput for Command {
    fn run_and_stream_output(&mut self) -> Result<ExitStatus> {
        self.spawn()?.wait()?.success_or_error()
    }
}

fn build_and_apply_suggestions(rust_prebuilts_version: &str) -> Result<()> {
    let re = Regex::new(r"[^ ]*\.checkJson\.error")?;
    for _ in 1..1000 {
        debug!("m -k rustClippyJson");
        let build_result = Command::new("/usr/bin/bash")
            .args([
                "-c",
                "source build/envsetup.sh && lunch aosp_cf_x86_64_phone-trunk_staging-eng && m -k rustClippyJson"
            ])
            .env_remove("OUT_DIR")
            .env("RUST_PREBUILTS_VERSION", rust_prebuilts_version)
            .run_and_stream_output();
        if build_result.is_ok() {
            return Ok(());
        }
        let error_log = read_to_string("out/error.log")?;
        let error_files = re.find_iter(&error_log).map(|m| m.as_str()).collect::<BTreeSet<_>>();
        let mut affected_files = BTreeSet::new();
        for file in error_files {
            debug!("Checking suggestions in {file}");
            let json_suggestions = read_to_string(file)?;
            let suggestions = rustfix::get_suggestions_from_json(
                &json_suggestions,
                &HashSet::new(),
                rustfix::Filter::MachineApplicableOnly,
            )?;
            if suggestions
                .iter()
                .any(|s| affected_files.contains(&s.solutions[0].replacements[0].snippet.file_name))
            {
                debug!("{file} Contains suggestions for a file we already updated");
                continue;
            }
            let mut files = BTreeMap::new();
            for suggestion in suggestions {
                affected_files
                    .insert(suggestion.solutions[0].replacements[0].snippet.file_name.clone());
                let file = suggestion.solutions[0].replacements[0].snippet.file_name.clone();
                files.entry(file).or_insert_with(Vec::new).push(suggestion);
            }
            for (source_file, suggestions) in &files {
                debug!("Applying suggestions to {source_file}");
                let source = read_to_string(source_file)?;
                let mut fix = rustfix::CodeFix::new(&source);
                for suggestion in suggestions.iter().rev() {
                    fix.apply(suggestion)
                        .with_context(|| format!("Failed to apply suggestion to {source_file}"))?;
                }
                let fixes = fix.finish()?;
                write(source_file, fixes)?;
            }
        }
        if affected_files.is_empty() {
            debug!("We didn't apply any suggestions. Returning.");
            return Ok(());
        }
    }
    bail!("Still found errors after 1000 iterations")
}

fn main() -> Result<()> {
    env_logger::init();
    let args = Cli::parse();

    set_current_dir(args.android_root)?;
    build_and_apply_suggestions(&args.rust_prebuilts_version)?;

    Ok(())
}
