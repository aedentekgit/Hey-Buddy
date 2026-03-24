import os
import glob
import re

lib_dir = '/Users/aedenteka/Downloads/Buddy copy 5/Flutter/lib'
files = glob.glob(f'{lib_dir}/**/*.dart', recursive=True)

target = """margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),"""

replacement = """margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),"""

target2 = """margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),"""

count = 0
for f in files:
    with open(f, 'r') as file:
        content = file.read()
    
    # Try multiple spacing permutations
    # Since dart format might slightly vary, we will use regex to be safe.
    new_content = re.sub(
        r'margin:\s*const\s*EdgeInsets\.symmetric\(horizontal:\s*16,\s*vertical:\s*8\),\s*padding:\s*const\s*EdgeInsets\.symmetric\(horizontal:\s*12,\s*vertical:\s*12\),',
        r'margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),\n              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),',
        content
    )
    
    # Same thing but if padding comes before margin? (Usually it's margin then padding)
    if new_content != content:
        with open(f, 'w') as file:
            file.write(new_content)
        count += 1
        print(f"Updated header in {f}")

print(f"Total files updated: {count}")
