"""Create small, public-domain fixtures without client assets or dependencies."""
from pathlib import Path
import json
import struct
import zlib
import zipfile
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent


def png(color):
    def chunk(kind, content):
        return struct.pack(">I", len(content)) + kind + content + struct.pack(">I", zlib.crc32(kind + content))
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 8, 8, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(b"".join(b"\x00" + bytes(color) * 8 for _ in range(8)))) + chunk(b"IEND", b"")


def package(missing=False, count=2):
    layers, artboards, assets = [], [], {}
    serial = 0

    def layer(name, parent=None, group=False, width=80, height=60):
        nonlocal serial
        serial += 1
        result = {"layerID": serial, "name": name, "parentLayerID": parent, "visible": True,
                  "itemIndex": serial, "bounds": {"top": 0, "left": 0, "right": width, "bottom": height, "width": width, "height": height},
                  "layerSection": {"_value": "layerSectionStart" if group else "layerSectionContent"}}
        layers.append(result)
        return serial

    for i in range(count):
        root = layer("80x60" if i == 0 else "428x622" if i == 1 else f"size{i}", group=True,
                     width=428 if i == 1 else 80, height=622 if i == 1 else 60)
        artboards.append(root)
        component = layer("tabComponent", root, True)
        tab = layer("tab1", component, True)
        gallery = layer("rmGallery", tab, True)
        for j in range(2):
            slide = layer(f"slide{j+1}", gallery, True)
            picture = layer("color", slide)
            if not (missing and i == 0 and j == 1):
                # Exercise the existing painter's -2x retry.
                assets[f"color-{picture}-2x.png"] = png([220, 40, 30, 255] if j == 0 else [20, 170, 90, 255])
        tab2 = layer("tab2", component, True)
        picture = layer("nested", tab2)
        assets[f"nested/image-{picture}.png"] = png([30, 80, 220, 255])
        layers[-1]["customFixtureAsset"] = f"nested/image-{picture}.png"

    custom_assets = [{"layerID": item["layerID"], "fileName": item["customFixtureAsset"]} for item in layers if "customFixtureAsset" in item]
    data = {"document": {"artboards": artboards}, "rawLayers": layers, "fonts": [], "customAssets": custom_assets}
    return data, assets


for name, missing, count in [("complete", False, 2), ("missing", True, 2), ("cancel", False, 100)]:
    data, assets = package(missing, count)
    with zipfile.ZipFile(ROOT / f"{name}.zip", "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("export.json", json.dumps(data))
        for name_, content in assets.items():
            archive.writestr(name_, content)
    print(ROOT / f"{name}.zip")

# A missing shared disclaimer resource must degrade each frame, not erase
# the entire batch. Its second image exercises a valid nested SVG reference.
data, assets = package()
serial = max(layer["layerID"] for layer in data["rawLayers"])
for root in data["document"]["artboards"]:
    serial += 1
    data["rawLayers"].append({"layerID": serial, "name": "isi", "parentLayerID": root,
                             "visible": True, "itemIndex": 1000, "layerKind": 4,
                             "bounds": {"top": 0, "left": 0, "width": 80, "height": 60}})
assets["assets/logo.svg"] = b'<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="blue"/></svg>'
assets["disclaimer.html"] = b'<html><head><style>.notice{font-family:Arial}.notice img{width:8px;height:8px}</style></head><body><img src="$LOC$assets/disclaimerLogo.svg"><img src="assets/logo.svg"><p>Shared disclaimer</p></body></html>'
with zipfile.ZipFile(ROOT / "disclaimer.zip", "w", zipfile.ZIP_DEFLATED) as archive:
    archive.writestr("export.json", json.dumps(data))
    for name, content in assets.items():
        archive.writestr(name, content)
print(ROOT / "disclaimer.zip")

# Optional real video fixture; static checks do not require FFmpeg.
if shutil.which("ffmpeg"):
    with tempfile.TemporaryDirectory() as directory:
        video = Path(directory) / "first-frame.mp4"
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i",
                        "color=c=red:s=80x60:r=10:d=6", "-vf", "drawbox=color=lime:t=fill:enable=gte(t\\,4)", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-y", str(video)], check=True)
        layers = [
            {"layerID": 1, "name": "master", "layerSection": {"_value": "layerSectionStart"}},
            {"layerID": 2, "parentLayerID": 1, "name": "videoPlaylist", "layerSection": {"_value": "layerSectionStart"}},
            {"layerID": 3, "parentLayerID": 2, "name": "v1 : assets/red.mp4 [0]"},
            {"layerID": 4, "name": "80x60", "bounds": {"top": 0, "left": 0, "width": 80, "height": 60}, "layerSection": {"_value": "layerSectionStart"}},
            {"layerID": 5, "parentLayerID": 4, "name": "video [v1]", "layerKind": 4, "bounds": {"top": 0, "left": 0, "width": 80, "height": 60}},
        ]
        data = {"document": {"artboards": [1, 4]}, "rawLayers": layers, "fonts": [], "customAssets": []}
        with zipfile.ZipFile(ROOT / "video.zip", "w", zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("export.json", json.dumps(data))
            archive.writestr("assets/red.mp4", video.read_bytes())
        print(ROOT / "video.zip")
