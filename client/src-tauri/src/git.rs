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

#[derive(serde::Serialize, Clone)]
pub struct GitBranch {
    /// Display name, e.g. `main` or `origin/main`
    pub name: String,
    /// Full refname, e.g. `refs/heads/main` or `refs/remotes/origin/main`
    pub refname: String,
    pub remote: bool,
    pub current: bool,
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

    let read_only = match args.first().map(|a| a.as_ref()) {
        Some("status") | Some("rev-parse") | Some("rev-list") | Some("show") => true,
        // `git branch -a` lists branches; `git branch -d` deletes
        Some("branch") => args.contains(&"-a"),
        _ => false,
    };
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

fn parse_branches(data: &str) -> Vec<GitBranch> {
    let mut branches = Vec::new();
    for line in data.split('\n') {
        if line.is_empty() {
            continue;
        }
        let mut parts = line.split('\0');
        let head = parts.next().unwrap_or("");
        let refname = parts.next().unwrap_or("");
        let (name, remote) = if let Some(local) = refname.strip_prefix("refs/remotes/") {
            (local.to_string(), true)
        } else if let Some(local) = refname.strip_prefix("refs/heads/") {
            (local.to_string(), false)
        } else {
            continue;
        };
        branches.push(GitBranch {
            name,
            refname: refname.to_string(),
            remote,
            current: head == "*",
        });
    }
    branches
}

fn branches_inner(root: &str) -> Result<Vec<GitBranch>, String> {
    let out = run_git(
        root,
        &["branch", "-a", "--no-color", "--format=%(HEAD)%00%(refname)"],
    )?;
    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "git branch failed".to_string()
        } else {
            stderr
        });
    }
    let data = String::from_utf8_lossy(&out.stdout).into_owned();
    Ok(parse_branches(&data))
}

/// Reject branch names that could inject git options or are invalid refs.
fn validate_branch_name(name: &str) -> Result<(), String> {
    if name.trim().is_empty() {
        return Err("Branch name is empty".to_string());
    }
    if name.starts_with('-') {
        return Err("Branch name cannot start with '-'".to_string());
    }
    if name == "." || name == ".." {
        return Err(format!("'{name}' is not a valid branch name"));
    }
    if name
        .bytes()
        .any(|b| b < 0x20 || b == b' ' || b == 0x7f)
    {
        return Err("Branch name cannot contain whitespace".to_string());
    }
    for bad in ['~', '^', ':', '?', '*', '[', '\\', '\u{7f}'] {
        if name.contains(bad) {
            return Err(format!("'{bad}' is not allowed in a branch name"));
        }
    }
    Ok(())
}

/// Switch to a branch by full refname. Remote branches are checked out into a
/// new local branch tracking the remote one (never detached HEAD).
#[tauri::command]
pub async fn git_switch_branch(
    root: String,
    refname: String,
    lock: tauri::State<'_, GitLock>,
) -> Result<(), String> {
    if !refname.starts_with("refs/heads/") && !refname.starts_with("refs/remotes/") {
        return Err(format!("Invalid branch refname: {refname}"));
    }
    let git_lock = lock.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = git_lock
            .lock()
            .map_err(|e| format!("git lock poisoned: {e}"))?;
        let out = if let Some(remote) = refname.strip_prefix("refs/remotes/") {
            let local = remote
                .rsplit('/')
                .next()
                .unwrap_or(remote)
                .to_string();
            run_git(
                &root,
                &["switch", "-c", &local, "--track", &refname],
            )?
        } else {
            run_git(&root, &["switch", &refname])?
        };
        require_success(&out, "Switch branch")
    })
    .await
    .map_err(|e| format!("Task failed: {e}"))?
}

/// Create a branch from the current HEAD and switch to it.
#[tauri::command]
pub async fn git_create_branch(
    root: String,
    name: String,
    lock: tauri::State<'_, GitLock>,
) -> Result<(), String> {
    validate_branch_name(&name)?;
    let git_lock = lock.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = git_lock
            .lock()
            .map_err(|e| format!("git lock poisoned: {e}"))?;
        let out = run_git(&root, &["switch", "-c", &name])?;
        require_success(&out, "Create branch")
    })
    .await
    .map_err(|e| format!("Task failed: {e}"))?
}

/// Delete a branch. Refuses to delete unmerged branches (exit 1) unless forced
/// by the user, which is intentionally not exposed here.
#[tauri::command]
pub async fn git_delete_branch(
    root: String,
    name: String,
    lock: tauri::State<'_, GitLock>,
) -> Result<(), String> {
    validate_branch_name(&name)?;
    let git_lock = lock.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = git_lock
            .lock()
            .map_err(|e| format!("git lock poisoned: {e}"))?;
        let out = run_git(&root, &["branch", "-d", "--", &name])?;
        require_success(&out, "Delete branch")
    })
    .await
    .map_err(|e| format!("Task failed: {e}"))?
}

#[tauri::command]
pub async fn git_branches(
    root: String,
    lock: tauri::State<'_, GitLock>,
) -> Result<Vec<GitBranch>, String> {
    let git_lock = lock.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = git_lock
            .lock()
            .map_err(|e| format!("git lock poisoned: {e}"))?;
        branches_inner(&root)
    })
    .await
    .map_err(|e| format!("Task failed: {e}"))?
}

/// Return the repo-relative, forward-slash path of `path` inside `root`.
fn repo_relative(root: &str, path: &str) -> Result<String, String> {
    let root_norm = root.replace('\\', "/").trim_end_matches('/').to_string();
    let path_norm = path.replace('\\', "/");
    let root_lower = root_norm.to_lowercase();
    let path_lower = path_norm.to_lowercase();
    if path_lower == root_lower {
        return Err("Path is the workspace root, not a file".to_string());
    }
    if !path_lower.starts_with(&format!("{root_lower}/")) {
        return Err("Path is outside the workspace".to_string());
    }
    Ok(path_norm[root_norm.len() + 1..].to_string())
}

const GIT_FILE_CAP_BYTES: usize = 4 * 1024 * 1024;

/// Fetch the version of a file at HEAD for the diff "original" side.
/// Returns `None` for untracked files, binary content, or files too large
/// to diff comfortably.
#[tauri::command]
pub async fn git_show_file(
    root: String,
    path: String,
    lock: tauri::State<'_, GitLock>,
) -> Result<Option<String>, String> {
    let git_lock = lock.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = git_lock
            .lock()
            .map_err(|e| format!("git lock poisoned: {e}"))?;
        let rel = repo_relative(&root, &path)?;
        let out = run_git(&root, &["show", &format!("HEAD:{rel}")])?;
        if !out.status.success() {
            // Untracked or deleted at HEAD — treat as "no original"
            return Ok(None);
        }
        if out.stdout.contains(&0) {
            return Ok(None); // binary content
        }
        if out.stdout.len() > GIT_FILE_CAP_BYTES {
            return Ok(None); // too large
        }
        Ok(Some(String::from_utf8_lossy(&out.stdout).into_owned()))
    })
    .await
    .map_err(|e| format!("Task failed: {e}"))?
}
