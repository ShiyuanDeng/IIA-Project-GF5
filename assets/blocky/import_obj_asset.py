from __future__ import annotations

import argparse
import json
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


DEFAULT_SKELETON_ASSET = Path(__file__).with_name("smpl24_proxy.asset.json")
VALID_JOINTS = {
    "pelvis",
    "left_hip",
    "right_hip",
    "spine1",
    "left_knee",
    "right_knee",
    "spine2",
    "left_ankle",
    "right_ankle",
    "spine3",
    "left_foot",
    "right_foot",
    "neck",
    "left_collar",
    "right_collar",
    "head",
    "left_shoulder",
    "right_shoulder",
    "left_elbow",
    "right_elbow",
    "left_wrist",
    "right_wrist",
    "left_hand",
    "right_hand",
}


Vec3 = tuple[float, float, float]
Face = tuple[int, int, int]


@dataclass
class MeshGroup:
    name: str
    material: str
    faces: list[Face] = field(default_factory=list)


def parse_triplet(text: str, *, name: str, cast: Any = float) -> tuple[Any, Any, Any]:
    parts = text.split(",")
    if len(parts) != 3:
        raise ValueError(f"{name} must be three comma-separated values, got {text!r}")
    return cast(parts[0]), cast(parts[1]), cast(parts[2])


def clamp_byte(value: float) -> int:
    return max(0, min(255, int(round(value))))


def parse_mtl_color(path: Path) -> dict[str, list[int]]:
    colors: dict[str, list[int]] = {}
    current = ""
    if not path.exists():
        return colors
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        keyword, *rest = line.split()
        if keyword == "newmtl" and rest:
            current = rest[0]
        elif keyword == "Kd" and current and len(rest) >= 3:
            values = [float(rest[0]), float(rest[1]), float(rest[2])]
            if max(values) <= 1.0:
                values = [channel * 255.0 for channel in values]
            colors[current] = [clamp_byte(channel) for channel in values]
    return colors


def obj_index(token: str, vertex_count: int) -> int:
    raw = token.split("/")[0]
    if not raw:
        raise ValueError(f"OBJ face token {token!r} does not include a vertex index")
    index = int(raw)
    if index < 0:
        index = vertex_count + index + 1
    if index <= 0 or index > vertex_count:
        raise ValueError(f"OBJ vertex index {index} out of range 1..{vertex_count}")
    return index - 1


def read_obj(path: Path, default_material: str) -> tuple[list[Vec3], list[MeshGroup], list[Path]]:
    vertices: list[Vec3] = []
    groups: list[MeshGroup] = []
    mtllibs: list[Path] = []
    current_material = default_material
    current_name = "mesh"

    def current_group() -> MeshGroup:
        if groups and groups[-1].name == current_name and groups[-1].material == current_material:
            return groups[-1]
        group = MeshGroup(name=current_name, material=current_material)
        groups.append(group)
        return group

    for line_number, raw_line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        keyword, *rest = line.split()
        if keyword == "v" and len(rest) >= 3:
            vertices.append((float(rest[0]), float(rest[1]), float(rest[2])))
        elif keyword == "f" and len(rest) >= 3:
            indices = [obj_index(token, len(vertices)) for token in rest]
            group = current_group()
            for index in range(1, len(indices) - 1):
                group.faces.append((indices[0], indices[index], indices[index + 1]))
        elif keyword == "usemtl" and rest:
            current_material = rest[0]
        elif keyword in {"o", "g"} and rest:
            current_name = "_".join(rest)
        elif keyword == "mtllib" and rest:
            for item in rest:
                mtllibs.append((path.parent / item).resolve())
        elif keyword in {"vt", "vn", "s"}:
            continue
        else:
            # Unknown OBJ statements are ignored so exporter-specific metadata is harmless.
            continue
    if not vertices:
        raise ValueError(f"{path} contains no OBJ vertices")
    groups = [group for group in groups if group.faces]
    if not groups:
        raise ValueError(f"{path} contains no OBJ faces")
    return vertices, groups, mtllibs


def rotation_matrix(rx_deg: float, ry_deg: float, rz_deg: float) -> tuple[Vec3, Vec3, Vec3]:
    rx, ry, rz = (math.radians(value) for value in (rx_deg, ry_deg, rz_deg))
    cx, sx = math.cos(rx), math.sin(rx)
    cy, sy = math.cos(ry), math.sin(ry)
    cz, sz = math.cos(rz), math.sin(rz)

    # Rz * Ry * Rx
    return (
        (cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx),
        (sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx),
        (-sy, cy * sx, cy * cx),
    )


def transform_vertex(vertex: Vec3, scale: float, rotate: Vec3, offset: Vec3) -> list[float]:
    matrix = rotation_matrix(*rotate)
    scaled = (vertex[0] * scale, vertex[1] * scale, vertex[2] * scale)
    rotated = (
        matrix[0][0] * scaled[0] + matrix[0][1] * scaled[1] + matrix[0][2] * scaled[2],
        matrix[1][0] * scaled[0] + matrix[1][1] * scaled[1] + matrix[1][2] * scaled[2],
        matrix[2][0] * scaled[0] + matrix[2][1] * scaled[1] + matrix[2][2] * scaled[2],
    )
    return [round(rotated[0] + offset[0], 6), round(rotated[1] + offset[1], 6), round(rotated[2] + offset[2], 6)]


def local_part_mesh(vertices: list[Vec3], faces: list[Face], scale: float, rotate: Vec3, offset: Vec3) -> tuple[list[list[float]], list[list[int]]]:
    used_indices = sorted({index for face in faces for index in face})
    remap = {old_index: new_index for new_index, old_index in enumerate(used_indices)}
    part_vertices = [transform_vertex(vertices[index], scale, rotate, offset) for index in used_indices]
    part_faces = [[remap[a], remap[b], remap[c]] for a, b, c in faces]
    return part_vertices, part_faces


def make_asset(
    *,
    name: str,
    description: str,
    skeleton_asset: Path,
    obj_path: Path,
    joint: str,
    scale: float,
    rotate: Vec3,
    offset: Vec3,
    default_color: list[int],
) -> dict[str, Any]:
    skeleton_raw = json.loads(skeleton_asset.read_text(encoding="utf-8"))
    vertices, groups, mtllibs = read_obj(obj_path, "__default__")
    material_colors = {"__default__": default_color}
    for mtllib in mtllibs:
        material_colors.update(parse_mtl_color(mtllib))

    parts: list[dict[str, Any]] = []
    for index, group in enumerate(groups):
        part_vertices, part_faces = local_part_mesh(vertices, group.faces, scale, rotate, offset)
        color = material_colors.get(group.material, default_color)
        safe_name = "".join(ch.lower() if ch.isalnum() else "_" for ch in f"{group.name}_{group.material}_{index}").strip("_")
        parts.append(
            {
                "name": safe_name or f"part_{index}",
                "joint": joint,
                "vertices": part_vertices,
                "faces": part_faces,
                "color": color,
            }
        )

    return {
        "asset_format": "gf5_rigid_character",
        "asset_version": 2,
        "name": name,
        "description": description or f"Imported from {obj_path.name}; all parts attached to {joint}.",
        "units": "meters",
        "display": skeleton_raw.get("display", {}),
        "skeleton": skeleton_raw.get("skeleton", {}),
        "source": {
            "type": "obj",
            "path": str(obj_path),
            "joint": joint,
            "scale": scale,
            "rotate_degrees": list(rotate),
            "offset": list(offset),
        },
        "rigid_parts": parts,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convert a colored Wavefront OBJ/MTL mesh into a GF5 rigid character asset."
    )
    parser.add_argument("--obj", required=True, type=Path, help="Input Wavefront .obj file. Optional .mtl is read from mtllib statements.")
    parser.add_argument("--name", required=True, help="Asset display name shown in the web editor.")
    parser.add_argument("--out", required=True, type=Path, help="Output .asset.json path, normally under assets/blocky/.")
    parser.add_argument("--joint", default="pelvis", choices=sorted(VALID_JOINTS), help="SMPL-24 joint that the imported mesh follows.")
    parser.add_argument("--scale", type=float, default=1.0, help="Uniform scale applied to OBJ vertices before rotation/offset.")
    parser.add_argument("--rotate-degrees", default="0,0,0", help="Euler rotation in degrees as x,y,z, applied after scale.")
    parser.add_argument("--offset", default="0,0,0", help="Local offset as x,y,z meters, applied after scale/rotation.")
    parser.add_argument("--default-color", default="180,180,180", help="Fallback RGB color as r,g,b for faces without MTL material color.")
    parser.add_argument("--description", default="", help="Optional asset description.")
    parser.add_argument("--skeleton-asset", type=Path, default=DEFAULT_SKELETON_ASSET, help="GF5 asset to copy display/skeleton from.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    obj_path = args.obj.resolve()
    out_path = args.out
    skeleton_asset = args.skeleton_asset.resolve()
    rotate = parse_triplet(args.rotate_degrees, name="--rotate-degrees")
    offset = parse_triplet(args.offset, name="--offset")
    default_color = list(parse_triplet(args.default_color, name="--default-color", cast=int))
    if not obj_path.exists():
        raise FileNotFoundError(obj_path)
    if not skeleton_asset.exists():
        raise FileNotFoundError(skeleton_asset)
    asset = make_asset(
        name=args.name,
        description=args.description,
        skeleton_asset=skeleton_asset,
        obj_path=obj_path,
        joint=args.joint,
        scale=args.scale,
        rotate=rotate,
        offset=offset,
        default_color=[clamp_byte(channel) for channel in default_color],
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(asset, indent=2) + "\n", encoding="utf-8")
    vertex_count = sum(len(part["vertices"]) for part in asset["rigid_parts"])
    face_count = sum(len(part["faces"]) for part in asset["rigid_parts"])
    print(f"Wrote {out_path} with {len(asset['rigid_parts'])} parts, {vertex_count} vertices, {face_count} faces.")


if __name__ == "__main__":
    main()
