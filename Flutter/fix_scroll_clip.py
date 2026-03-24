import os

files = [
    'lib/features/home/screens/memory_list_screen.dart',
    'lib/features/home/screens/reminder_list_screen.dart',
    'lib/features/home/screens/location_reminders_screen.dart'
]

for fpath in files:
    with open(fpath, 'r') as f:
        content = f.read()

    # 1. Replace the padding of the main container and add clipBehavior
    content = content.replace(
        "padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),\n              decoration:",
        "padding: const EdgeInsets.symmetric(vertical: 6),\n              clipBehavior: Clip.hardEdge,\n              decoration:"
    )

    # 2. Wrap the Row with Padding
    content = content.replace(
        "              child: Column(\n                mainAxisSize: MainAxisSize.min,\n                children: [\n                  Row(\n                    children: [\n                      GestureDetector(\n                        onTap: () => Navigator.maybePop(context),",
        "              child: Column(\n                mainAxisSize: MainAxisSize.min,\n                children: [\n                  Padding(\n                    padding: const EdgeInsets.symmetric(horizontal: 10),\n                    child: Row(\n                      children: [\n                        GestureDetector(\n                          onTap: () => Navigator.maybePop(context),"
    )
    
    # 3. Close the padding around row before SizedBox(height: 12)
    content = content.replace(
        "                        ),\n                      ),\n                    ],\n                  ),\n                  const SizedBox(height: 12),\n                  SizedBox(\n                    height: 34,\n                    child: ListView.separated(\n                      scrollDirection: Axis.horizontal,\n                      padding: const EdgeInsets.symmetric(horizontal: 4),",
        "                        ),\n                      ),\n                    ],\n                  ),\n                  ),\n                  const SizedBox(height: 12),\n                  SizedBox(\n                    height: 34,\n                    child: ListView.separated(\n                      scrollDirection: Axis.horizontal,\n                      padding: const EdgeInsets.symmetric(horizontal: 14),"
    )

    with open(fpath, 'w') as f:
        f.write(content)

print("Done")
