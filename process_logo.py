from PIL import Image

def process():
    # Load the app_icon
    img = Image.open('Flutter/assets/app_icon.png').convert("RGBA")
    
    # Get bounding box of non-transparent areas
    bbox = img.getbbox()
    if not bbox:
        return
        
    print(f"Original bounding box: {bbox}")
    
    # Crop to the exact logo
    cropped = img.crop(bbox)
    
    # We want to make it an exact square centered
    width, height = cropped.size
    max_dim = max(width, height)
    
    # Create a new image, paste the cropped logo in the center
    # Wait, if we paste it, it will just be perfectly filling the square
    square_img = Image.new('RGBA', (max_dim, max_dim), (0, 0, 0, 0))
    x_offset = (max_dim - width) // 2
    y_offset = (max_dim - height) // 2
    
    square_img.paste(cropped, (x_offset, y_offset))
    
    # Save the expanded version that has zero padding around the main logo
    square_img.save('Flutter/assets/app_icon_zoomed.png')
    
    # Create the transparent 1x1 image for foreground
    trans = Image.new('RGBA', (10, 10), (0, 0, 0, 0))
    trans.save('Flutter/assets/transparent.png')

process()
