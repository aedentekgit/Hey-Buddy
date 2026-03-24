import re
import os

with open('compile_errors.txt', 'r') as f:
    lines = f.readlines()

for line in lines:
    if 'constant_identifier_names' in line: continue
    if 'info •' in line and 'AppColors' not in line: continue
    
    parts = line.split(' • ')
    if len(parts) >= 3:
        file_part = parts[2].split(':')
        if len(file_part) >= 3:
            file_path = file_part[0].strip()
            line_num = int(file_part[1])
            col_num = int(file_part[2])
            
            if os.path.exists(file_path):
                with open(file_path, 'r') as file:
                    content_lines = file.readlines()
                    
                target_idx = line_num - 1
                if 0 <= target_idx < len(content_lines):
                    # Replace 'const ' with '' on the starting line, or scanning backwards for 'const '
                    # Simple heuristic: look backwards up to 5 lines for 'const '
                    # Or just remove 'const ' from the line if it has it
                    if 'const ' in content_lines[target_idx]:
                        content_lines[target_idx] = content_lines[target_idx].replace('const ', '')
                    else:
                        for prev in range(target_idx, max(-1, target_idx - 6), -1):
                            if 'const ' in content_lines[prev]:
                                content_lines[prev] = content_lines[prev].replace('const ', '')
                                break
                
                with open(file_path, 'w') as file:
                    file.writelines(content_lines)
