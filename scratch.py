from PIL import Image

def remove_white_bg(input_path, output_path):
    img = Image.open(input_path)
    img = img.convert("RGBA")
    datas = img.getdata()

    newData = []
    for item in datas:
        # Near-white detection: R, G, B > 240
        if item[0] > 240 and item[1] > 240 and item[2] > 240:
            newData.append((255, 255, 255, 0))
        else:
            newData.append(item)

    img.putdata(newData)
    img.save(output_path, "PNG")

remove_white_bg(
    r"C:\Users\t470s\.gemini\antigravity-ide\brain\5172ed3d-1a46-423e-ac43-4722cde2dcd5\petya_avatar_1784693004351.png",
    r"c:\wndr\repo\itdefence\public\assets\sprites\avatar_petya.png"
)
print("Background removed and saved.")
