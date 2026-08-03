use std::path::Path;
use std::process::{Command, ExitStatus, Output, Stdio};
use std::sync::{mpsc, Mutex, OnceLock};
use std::time::Duration;

pub const GIT_TIMEOUT_MS: u64 = 30_000;
const GIT_CHANGE_CAP: usize = 10_000;

/// Serializes all git operations so concurrent UI actions can never corrupt
/// the index or race reads against writes.
pub struct GitLock(pub std::sync::Arc<Mutex<()>>);

#[derive(serde::Serialize, Clone)]
pub struct GitChange {
    pub path: String,
    pub index_status: String,
    pub worktree_status: String,
    pub staged: bool,
    pub untracked: bool,
}

#[derive(serde::Serialize)]
pub struct GitStatus {
    pub branch: Option<String>,
    pub ahead: i32,
    pub behind: i32,
    pub changes: Vec<GitChange>,
    pub truncated: bool,
}

fn git_candidates() -> Vec<std::ffi::OsString> {
    let mut candidates: Vec<std::ffi::OsString> = vec![
        "git".into(),
        r"C:\Program Files\Git\cmd\git.exe".into(),
        r"C:\Program Files\Git\bin\git.exe".into(),
        r"C:\Program Files (x86)\Git\cmd\git.exe".into(),
        r"C:\Program Files (x86)\Git\bin\git.exe".into(),
    ];
    if let Some(local) = std::env::var_os("LOCALAPPDATA") {
        candidates.push(
            Path::new(&local)
                .join(r"Programs\Git\cmd\git.exe")
                .into(),
        );
    }
    candidates
}

/// Resolve a working git executable: PATH first, then common Windows install
/// locations. The result is cached for the lifetime of the process.
fn resolve_git() -> String {
    static GIT: OnceLock<String> = OnceLock::new();
    GIT.get_or_init(|| {
        for candidate in git_candidates() {
            if let Ok(out) = Command::new(&candidate).arg("--version").output() {
                if out.status.success() {
                    return candidate.to_string_lossy().into_owned();
                }
            }
        }
        "git".to_string()
    })
    .clone()
}

fn run_git(root: &str, args: &[&str]) -> Result<Output, String> {
    let git = resolve_git();
    let mut cmd = Command::new(&git);
    cmd.arg("-C")
        .arg(root)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        // Never prompt for credentials from the UI
        .env("GIT_TERMINAL_PROMPT", "0")
        // Stable, English error strings regardless of the user's locale
        .env("LC_ALL", "C")
        .env("LANG", "C");

    let read_only = args
        .first()
        .map(|a| matches!(a.as_ref(), "status" | "rev-parse" | "rev-list"))
        .unwrap_or(false);
    if read_only {
        // Avoid lock contention with other git processes on status/rev-parse
        cmd.env("GIT_OPTIONAL_LOCKS", "0");
    }

    let child = cmd.spawn().map_err(|e| {
        format!("Failed to run git ({git}): {e} — is Git installed and on PATH?")
    })?;
    let pid = child.id();
    let (tx, rx) = mpsc::channel();
    let waiter = std::thread::spawn(move || {
        let output = child
            .wait_with_output()
            .unwrap_or_else(|_| Output {
                status: ExitStatus::default(),
                stdout: Vec::new(),
                stderr: Vec::new(),
            });
        let _ = tx.send(output);
    });

    match rx.recv_timeout(Duration::from_millis(GIT_TIMEOUT_MS)) {
        Ok(output) => Ok(output),
        Err(_) => {
            #[cfg(target_os = "windows")]
            {
                let _ = Command::new("taskkill")
                    .args(["/F", "/T", "/PID", &pid.to_string()])
                    .output();
            }
            #[cfg(not(target_os = "windows"))]
            {
                let _ = Command::new("kill").args(["-9", &pid.to_string()]).output();
            }
            drop(waiter);
            Err(format!("git command timed out after {GIT_TIMEOUT_MS}ms"))
        }
    }
}

fn require_success(out: &Output, what: &str) -> Result<(), String> {
    if out.status.success() {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
    let detail = if stderr.is_empty() {
        String::from_utf8_lossy(&out.stdout).trim().to_string()
    } else {
        stderr
    };
    let code = out
        .status
        .code()
        .map(|c| c.to_string())
        .unwrap_or_else(|| "?".to_string());
    Err(if detail.is_empty() {
        format!("{what} failed (exit {code})")
    } else {
        format!("{what} failed (exit {code}): {detail}")
    })
}

fn branch_name(root: &str) -> Option<String> {
    let out = run_git(root, &["rev-parse", "--abbrev-ref", "HEAD"]).ok()?;
    if !out.status.success() {
        return None;
    }
    let name = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if name.is_empty() || name == "HEAD" {
        None
    } else {
        Some(name)
    }
}

fn ahead_behind(root: &str) -> (i32, i32) {
    let out = match run_git(
        root,
        &["rev-list", "--left-right", "--count", "HEAD...@{upstream}"],
    ) {
        Ok(out) => out,
        Err(_) => return (0, 0),
    };
    if !out.status.success() {
        return (0, 0);
    }
    let text = String::from_utf8_lossy(&out.stdout);
    let mut parts = text.trim().split_whitespace();
    let ahead = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0);
    let behind = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0);
    (ahead, behind)
}

fn parse_status(data: &str) -> (Vec<GitChange>, bool) {
    let fields: Vec<&str> = data.split('\0').filter(|s| !s.is_empty()).collect();
    let mut changes = Vec::new();
    let mut i = 0;
    while i < fields.len() && changes.len() < GIT_CHANGE_CAP {
        let entry = fields[i];
        if entry.len() >= 4 {
            let xy = &entry[..2];
            let path = entry[3..].to_string();
            let index_status = xy.as_bytes()[0] as char;
            let worktree_status = xy.as_bytes()[1] as char;
            let staged = index_status != ' ' && index_status != '?';
            let untracked = index_status == '?' && worktree_status == '?';
            // Rename/copy entries carry the original path in the next field
            if index_status == 'R' || index_status == 'C' {
                i += 1;
            }
            changes.push(GitChange {
                path,
                index_status: index_status.to_string(),
                worktree_status: worktree_status.to_string(),
                staged,
                untracked,
            });
        }
        i += 1;
    }
    (changes, i < fields.len())
}

fn status_inner(root: &str) -> Result<GitStatus, String> {
    let out = run_git(root, &["status", "--porcelain=v1", "-z"])?;
    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "git status failed".to_string()
        } else {
            stderr
        });
    }
    let data = String::from_utf8_lossy(&out.stdout).into_owned();
    let (ahead, behind) = ahead_behind(root);
    let (changes, truncated) = parse_status(&data);
    Ok(GitStatus {
        branch: branch_name(root),
        ahead,
        behind,
        changes,
        truncated,
    })
}

#[tauri::command]
pub async fn git_status(
    root: String,
    lock: tauri::State<'_, GitLock>,
) -> Result<GitStatus, String> {
    let git_lock = lock.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = git_lock
            .lock()
            .map_err(|e| format!("git lock poisoned: {e}"))?;
        status_inner(&root)
    })
    .await
    .map_err(|e| format!("Task failed: {e}"))?
}

#[tauri::command]
pub async fn git_stage(
    root: String,
    path: String,
    lock: tauri::State<'_, GitLock>,
) -> Result<(), String> {
    let git_lock = lock.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = git_lock
            .lock()
            .map_err(|e| format!("git lock poisoned: {e}"))?;
        let out = run_git(&root, &["add", "--", &path])?;
        require_success(&out, "Stage")
    })
    .await
    .map_err(|e| format!("Task failed: {e}"))?
}

#[tauri::command]
pub async fn git_stage_all(
    root: String,
    lock: tauri::State<'_, GitLock>,
) -> Result<(), String> {
    let git_lock = lock.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = git_lock
            .lock()
            .map_err(|e| format!("git lock poisoned: {e}"))?;
        let out = run_git(&root, &["add", "-A"])?;
        require_success(&out, "Stage all")
    })
    .await
    .map_err(|e| format!("Task failed: {e}"))?
}

#[tauri::command]
pub async fn git_unstage(
    root: String,
    path: String,
    lock: tauri::State<'_, GitLock>,
) -> Result<(), String> {
    let git_lock = lock.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = git_lock
            .lock()
            .map_err(|e| format!("git lock poisoned: {e}"))?;
        let out = run_git(&root, &["restore", "--staged", "--", &path])?;
        require_success(&out, "Unstage")
    })
    .await
    .map_err(|e| format!("Task failed: {e}"))?
}

#[tauri::command]
pub async fn git_unstage_all(
    root: String,
    lock: tauri::State<'_, GitLock>,
) -> Result<(), String> {
    let git_lock = lock.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = git_lock
            .lock()
            .map_err(|e| format!("git lock poisoned: {e}"))?;
        let out = run_git(&root, &["reset"])?;
        require_success(&out, "Unstage all")
    })
    .await
    .map_err(|e| format!("Task failed: {e}"))?
}

/// Discard all changes for a path — both staged and worktree. Untracked
/// files are not supported (they have nothing to restore from).
#[tauri::command]
pub async fn git_discard(
    root: String,
    path: String,
    lock: tauri::State<'_, GitLock>,
) -> Result<(), String> {
    let git_lock = lock.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = git_lock
            .lock()
            .map_err(|e| format!("git lock poisoned: {e}"))?;
        let out = run_git(&root, &["restore", "--staged", "--worktree", "--", &path])?;
        require_success(&out, "Discard changes")
    })
    .await
    .map_err(|e| format!("Task failed: {e}"))?
}

#[tauri::command]
pub async fn git_commit(
    root: String,
    message: String,
    lock: tauri::State<'_, GitLock>,
) -> Result<(), String> {
    if message.trim().is_empty() {
        return Err("Commit message is empty".to_string());
    }
    let git_lock = lock.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = git_lock
            .lock()
            .map_err(|e| format!("git lock poisoned: {e}"))?;
        let out = run_git(&root, &["commit", "-m", &message])?;
        require_success(&out, "Commit")
    })
    .await
    .map_err(|e| format!("Task failed: {e}"))?
}
