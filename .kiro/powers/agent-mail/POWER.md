# Agent Mail Power

MCP Agent Mail provides agent-to-agent coordination via message passing.

## Features

- **Messages**: Send and receive messages between agents
- **File Reservations**: Reserve files to prevent conflicts during edits
- **Projects**: Organize work into projects
- **Contact Links**: Manage agent contact information

## Common Workflows

### Check inbox
Use `get_inbox` to see messages for an agent.

### Send a message
Use `send_message` with recipient, subject, and body.

### Reserve files before editing
Use `file_reservation_paths` to claim exclusive access to files.

### Release reservations when done
Use `release_file_reservations` to free up files.

## Integration with Beads

When working on a beads issue (bd-###):
- Use the issue ID as `thread_id` in messages
- Include issue ID in file reservation `reason`
- Prefix message subjects with `[bd-###]`
