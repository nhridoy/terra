use std::process::{Command, Output, Stdio};

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
}

fn run_git(root: &str, args: &[&str]) -> Result<Output, String> {
    Command::new("git")
        .args(["-C", root])
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| format!("Failed to run git: {e}"))
}

fn require_success(out: &Output, what: &str) -> Result<(), String> {
    if out.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
        Err(if stderr.is_empty() {
            format!("{what} failed")
        } else {
            format!("{what}: {stderr}")
        })
    }
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

fn parse_status(data: &str) -> Vec<GitChange> {
    let fields: Vec<&str> = data.split('\0').filter(|s| !s.is_empty()).collect();
    let mut changes = Vec::new();
    let mut i = 0;
    while i < fields.len() {
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
    changes
}

#[tauri::command]
pub async fn git_status(root: String) -> Result<GitStatus, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let out = run_git(&root, &["status", "--porcelain=v1", "-z"])
            .map_err(|e| e.to_string())?;
        if !out.status.success() {
            let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
            return Err(if stderr.is_empty() {
                "git status failed".to_string()
            } else {
                stderr
            });
        }
        let data = String::from_utf8_lossy(&out.stdout).into_owned();
        let (ahead, behind) = ahead_behind(&root);
        Ok(GitStatus {
            branch: branch_name(&root),
            ahead,
            behind,
            changes: parse_status(&data),
        })
    })
    .await
    .map_err(|e| format!("Task failed: {e}"))?
}

#[tauri::command]
pub async fn git_stage(root: String, path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let out = run_git(&root, &["add", "--", &path])?;
        require_success(&out, "Stage")
    })
    .await
    .map_err(|e| format!("Task failed: {e}"))?
}

#[tauri::command]
pub async fn git_unstage(root: String, path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let out = run_git(&root, &["restore", "--staged", "--", &path])?;
        require_success(&out, "Unstage")
    })
    .await
    .map_err(|e| format!("Task failed: {e}"))?
}

#[tauri::command]
pub async fn git_discard(root: String, path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let out = run_git(&root, &["checkout", "--", &path])?;
        require_success(&out, "Discard changes")
    })
    .await
    .map_err(|e| format!("Task failed: {e}"))?
}

#[tauri::command]
pub async fn git_commit(root: String, message: String) -> Result<(), String> {
    if message.trim().is_empty() {
        return Err("Commit message is empty".to_string());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let out = run_git(&root, &["commit", "-m", &message])?;
        require_success(&out, "Commit")
    })
    .await
    .map_err(|e| format!("Task failed: {e}"))?
}
