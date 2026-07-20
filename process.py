import os
import math
from PIL import Image

images = [
    (r"C:\Users\t470s\.gemini\antigravity-ide\brain\e7e05fd6-47a2-4bea-8879-b451e7e3e0fa\tower_cooler_1784571348098.png", "tower-cooler.png", (52, 52)),
    (r"C:\Users\t470s\.gemini\antigravity-ide\brain\e7e05fd6-47a2-4bea-8879-b451e7e3e0fa\tower_router_1784571357667.png", "tower-router.png", (52, 52)),
    (r"C:\Users\t470s\.gemini\antigravity-ide\brain\e7e05fd6-47a2-4bea-8879-b451e7e3e0fa\tower_docs_1784571366887.png", "tower-docs.png", (52, 52)),
    (r"C:\Users\t470s\.gemini\antigravity-ide\brain\e7e05fd6-47a2-4bea-8879-b451e7e3e0fa\tower_coffee_1784571377163.png", "tower-coffee.png", (52, 52)),
    (r"C:\Users\t470s\.gemini\antigravity-ide\brain\e7e05fd6-47a2-4bea-8879-b451e7e3e0fa\tower_aircon_1784571386083.png", "tower-aircon.png", (52, 52)),
    (r"C:\Users\t470s\.gemini\antigravity-ide\brain\e7e05fd6-47a2-4bea-8879-b451e7e3e0fa\furniture_cabinet_1784571395741.png", "furniture-cabinet.png", (44, 44)),
    (r"C:\Users\t470s\.gemini\antigravity-ide\brain\e7e05fd6-47a2-4bea-8879-b451e7e3e0fa\furniture_drawer_1784571406550.png", "furniture-drawer.png", (32, 32)),
    (r"C:\Users\t470s\.gemini\antigravity-ide\brain\e7e05fd6-47a2-4bea-8879-b451e7e3e0fa\furniture_sofa_1784571416315.png", "furniture-sofa.png", (48, 48)),
]

out_dir = r"c:\wndr\repo\itdefence\public\assets\sprites"

def color_dist(c1, c2):
    return math.sqrt((c1[0]-c2[0])**2 + (c1[1]-c2[1])**2 + (c1[2]-c2[2])**2)

def process_image(src, dst_name, size):
    try:
        img = Image.open(src).convert("RGBA")
        
        bg_color = img.getpixel((0, 0))
        
        datas = img.getdata()
        new_data = []
        for item in datas:
            if color_dist(item[:3], bg_color[:3]) < 80:
                new_data.append((255, 255, 255, 0))
            else:
                if item[1] > 200 and item[0] < 120 and item[2] < 120:
                    new_data.append((255, 255, 255, 0))
                else:
                    new_data.append(item)
                
        img.putdata(new_data)
        
        bbox = img.getbbox()
        if bbox:
            img = img.crop(bbox)
            
        w, h = img.size
        max_dim = max(w, h)
        padded_img = Image.new("RGBA", (max_dim, max_dim), (0, 0, 0, 0))
        padded_img.paste(img, ((max_dim - w) // 2, (max_dim - h) // 2))
        
        padded_img = padded_img.resize(size, Image.Resampling.LANCZOS)
        
        dst = os.path.join(out_dir, dst_name)
        padded_img.save(dst, "PNG")
        print(f"Saved {dst_name}")
    except Exception as e:
        print(f"Failed to process {dst_name}: {e}")

for src, dst_name, size in images:
    process_image(src, dst_name, size)
