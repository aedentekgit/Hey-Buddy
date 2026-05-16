import glob
import re

files = glob.glob('/Users/aedenteka/Downloads/Buddy copy 5/Flutter/lib/**/*.dart', recursive=True)

count = 0
for f in files:
    with open(f, 'r') as file:
        content = file.read()
        
    orig = content
    
    # 1. Padding
    content = content.replace(
        "padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8)",
        "padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6)"
    )
    # also handle the original case just in case the previous script failed bounds
    content = content.replace(
        "padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12)",
        "padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6)"
    )
    
    # 2. Margin
    content = content.replace(
        "margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4)",
        "margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6)"
    )
    content = content.replace(
        "margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8)",
        "margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6)"
    )
    
    # 3. Size 40 -> 36 for back button
    # Only if it's right before a BoxDecoration for the back button
    content = re.sub(
        r'width:\s*40,\s+height:\s*40,\s+(decoration:\s*BoxDecoration)',
        r'width: 36,\n                      height: 36,\n                      \1',
        content
    )

    if content != orig:
        with open(f, 'w') as file:
            file.write(content)
        count += 1
        print("Updated " + f)

print("Done modifying " + str(count) + " files")
