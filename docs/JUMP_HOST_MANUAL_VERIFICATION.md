# Single-bastion routing: manual verification

Use disposable SSH servers: a bastion reachable from the client, and a destination reachable from the bastion but blocked from direct client access. The bastion must permit `direct-tcpip` forwarding (`AllowTcpForwarding yes` in OpenSSH). Create both saved hosts in one Terra vault, with separate credentials. Set the destination's **Connect through** field to the bastion. Keep a direct saved host as a regression check.

## Saved route and connection

1. Save and reopen the destination form. Its bastion selection should persist; choosing **Direct connection** should clear it. The picker should not offer the destination itself or a host already routed through another bastion.
2. Open a terminal to the destination. It must reach the destination through the bastion. Confirm the destination is not directly reachable by temporarily blocking the bastion: the connection must fail, not bypass it.
3. On first use, confirm each hop is stored separately in Terra's known-host file (the current policy accepts a previously unknown key on first use). Change the bastion key, then the destination key. The terminal should show the changed-key prompt for the correct hop; rejecting it must stop the connection. Background host checks should fail promptly on a changed key. SFTP should retain its existing changed-key confirmation behavior.
4. Try wrong bastion credentials and correct destination credentials, then the reverse. The error should identify the failing hop. Restore both credentials.
5. Close the pane and confirm both SSH connections close. Disconnect the bastion unexpectedly during an active destination shell; the pane should leave its connected state and display an error/disconnect.
6. Reopen while the Terra API is offline but the SSH network is reachable. The saved route should still connect from local encrypted data. It must not auto-connect on app launch.

## SFTP, host checks, and forwarding

1. Open SFTP for the routed destination, list a directory, upload and download a harmless file, then close SFTP. The bastion and destination SSH connections should close.
2. Run the host reachability/OS check. The destination should report reachable through the bastion; its OS must come from the destination, not the bastion.
3. Start a saved local forward on the destination, use it, stop it, and confirm the local port is released.
4. Repeat for a saved remote forward and a dynamic SOCKS5 forward. Stop each and confirm neither remains active. Close the owning pane while a forward is active; it should stop. Restart the app; saved forwards must remain stopped.

## Invalid routes and privacy

1. Delete the bastion host, then try the destination. It must report an unavailable bastion and must not connect directly. Select a new bastion or direct connection to recover.
2. Check a destination in a team vault: only another host in that same team vault should be selectable. An edited/synced cross-vault reference must fail in Rust.
3. Inspect client and server `hosts` rows. The bastion ID should appear only within encrypted `data`, not plaintext host columns or logs. Check that no credentials appear in errors or server traffic.
4. Repeat core terminal, SFTP, and forwarding cases on Linux, Windows, and macOS before claiming platform-wide support.

Record the app/OS version, route setup, failing step, and non-secret error text for each failure. Do not attach private keys or passwords.
