# Simplify ZOE to Single Claude-Style Chat Interface

## Problems identified

1. **Two ZOEs**: There's a "ZOE — General Chat" (`__general__`) AND per-assessment chats. User wants ONE ZOE with all capabilities.
2. **Cluttered UI**: Bottom tab bar (Chats/Write/Status/Tools), hero section, search, assessment list — all add noise. Should be a clean chat like Claude.
3. **Incomplete replies**: The `__general__` chat works but the main dashboard chat doesn't have subscription handling (so when general chat is removed, main Zoe on dashboard can do everything).