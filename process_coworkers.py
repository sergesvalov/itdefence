import os
import math
from PIL import Image

images = [
    (r"C:\Users\t470s\.gemini\antigravity-ide\brain\e7e05fd6-47a2-4bea-8879-b451e7e3e0fa\coworker_fast_1784620996972.png", "coworker-fast.png"),
    (r"C:\Users\t470s\.gemini\antigravity-ide\brain\e7e05fd6-47a2-4bea-8879-b451e7e3e0fa\coworker_tank_1784621004727.png", "coworker-tank.png"),
    (r"C:\Users\t470s\.gemini\antigravity-ide\brain\e7e05fd6-47a2-4bea-8879-b451e7e3e0fa\coworker_swarm_1784621013907.png", "coworker-swarm.png"),
    (r"C:\Users\t470s\.gemini\antigravity-ide\brain\e7e05fd6-47a2-4bea-8879-b451e7e3e0fa\coworker_boss_1784621023475.png", "coworker-boss.png"),
    (r"C:\Users\t470s\.gemini\antigravity-ide\brain\e7e05fd6-47a2-4bea-8879-b451e7e3e0fa\coworker_remote_1784621032146.png", "coworker-remote.png")
]

out_dir = r"c:\wndr\repo\itdefence\public\assets\sprites"

def color_dist(c1, c2):
    return math.sqrt((c1[0]-c2[0])**2 + (c1[1]-c2[1])**2 + (c1[2]-c2[2])**2)

def process_image(src, dst_name):
    try:
        img = Image.open(src).convert("RGBA")
        bg_color = img.getpixel((0, 0))
        
        # Flattened data for Pillow 14+ compatibility and faster access
        datas = list(img.getdata())
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
            
        dst = os.path.join(out_dir, dst_name)
        img.save(dst, "PNG")
        print(f"Saved {dst_name}")
    except Exception as e:
        print(f"Failed to process {dst_name}: {e}")

for src, dst_name in images:
    process_image(src, dst_name)
