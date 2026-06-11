from __future__ import annotations

import argparse
import json
import math
import shlex
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


@dataclass
class ObjFace:
    vertices: list[int]
    uvs: list[int | None]
    material: str


@dataclass
class LaminaCell:
    x0: float
    y0: float
    x1: float
    y1: float
    color: list[int]
    weight: int


def parse_triplet(text: str, *, name: str, cast: Any = float) -> tuple[Any, Any, Any]:
    parts = text.split(",")
    if len(parts) != 3:
        raise ValueError(f"{name} must be three comma-separated values, got {text!r}")
    return cast(parts[0]), cast(parts[1]), cast(parts[2])


def clamp_byte(value: float) -> int:
    return max(0, min(255, int(round(value))))


def neutral_gray(color: list[int]) -> bool:
    return max(color) - min(color) <= 8


def extract_texture_path(text: str) -> str:
    text = text.strip().strip("\"'")
    if not text:
        return ""
    if not text.startswith("-"):
        return text

    option_args = {
        "-blendu": 1,
        "-blendv": 1,
        "-boost": 1,
        "-bm": 1,
        "-cc": 1,
        "-clamp": 1,
        "-imfchan": 1,
        "-mm": 2,
        "-o": 3,
        "-s": 3,
        "-t": 3,
        "-texres": 1,
        "-type": 1,
    }
    tokens = shlex.split(text)
    index = 0
    while index < len(tokens) and tokens[index].startswith("-"):
        option = tokens[index].lower()
        index += 1 + option_args.get(option, 1)
    return " ".join(tokens[index:]).strip("\"'")


def resolve_texture_path(mtl_path: Path, texture_path: str) -> Path:
    normalized = texture_path.replace("\\", "/").strip().strip("\"'")
    path = Path(normalized)
    if path.is_absolute():
        return path
    candidate = (mtl_path.parent / path).resolve()
    if candidate.exists():
        return candidate
    basename_candidate = (mtl_path.parent / path.name).resolve()
    if basename_candidate.exists():
        return basename_candidate
    return candidate


def average_texture_color(path: Path) -> list[int] | None:
    try:
        from PIL import Image
    except ImportError:
        return None

    if not path.exists():
        return None
    try:
        with Image.open(path) as image:
            image = image.convert("RGBA")
            image.thumbnail((256, 256))
            red = green = blue = alpha_total = 0.0
            pixels = image.load()
            for y in range(image.height):
                for x in range(image.width):
                    r, g, b, a = pixels[x, y]
                    if a <= 8:
                        continue
                    red += float(r) * float(a)
                    green += float(g) * float(a)
                    blue += float(b) * float(a)
                    alpha_total += float(a)
    except Exception:
        return None
    if alpha_total <= 0.0:
        return None
    return [
        clamp_byte(red / alpha_total),
        clamp_byte(green / alpha_total),
        clamp_byte(blue / alpha_total),
    ]


def parse_mtl_color(path: Path) -> dict[str, list[int]]:
    colors: dict[str, list[int]] = {}
    textures: dict[str, Path] = {}
    current = ""
    if not path.exists():
        return colors
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        keyword, *rest = line.split()
        if keyword == "newmtl" and rest:
            current = " ".join(rest)
        elif keyword == "Kd" and current and len(rest) >= 3:
            values = [float(rest[0]), float(rest[1]), float(rest[2])]
            if max(values) <= 1.0:
                values = [channel * 255.0 for channel in values]
            colors[current] = [clamp_byte(channel) for channel in values]
        elif keyword == "map_Kd" and current:
            _, texture_text = line.split(maxsplit=1)
            texture_path = extract_texture_path(texture_text)
            if texture_path:
                textures[current] = resolve_texture_path(path, texture_path)
    for material, texture_path in textures.items():
        texture_color = average_texture_color(texture_path)
        if texture_color is not None and (material not in colors or neutral_gray(colors[material])):
            colors[material] = texture_color
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


def obj_optional_index(raw: str, value_count: int) -> int | None:
    if not raw:
        return None
    index = int(raw)
    if index < 0:
        index = value_count + index + 1
    if index <= 0 or index > value_count:
        raise ValueError(f"OBJ index {index} out of range 1..{value_count}")
    return index - 1


def obj_face_indices(token: str, vertex_count: int, uv_count: int) -> tuple[int, int | None]:
    parts = token.split("/")
    vertex_index = obj_optional_index(parts[0], vertex_count)
    if vertex_index is None:
        raise ValueError(f"OBJ face token {token!r} does not include a vertex index")
    uv_index = obj_optional_index(parts[1], uv_count) if len(parts) >= 2 else None
    return vertex_index, uv_index


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
            current_material = " ".join(rest)
        elif keyword in {"o", "g"} and rest:
            current_name = "_".join(rest)
        elif keyword == "mtllib" and rest:
            mtllibs.append((path.parent / " ".join(rest)).resolve())
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
    same_stem_mtl = path.with_suffix(".mtl").resolve()
    if same_stem_mtl.exists() and same_stem_mtl not in mtllibs and not any(mtllib.exists() for mtllib in mtllibs):
        mtllibs.append(same_stem_mtl)
    return vertices, groups, mtllibs


def read_obj_lamina_source(path: Path, default_material: str) -> tuple[list[Vec3], list[tuple[float, float]], list[ObjFace], list[Path]]:
    vertices: list[Vec3] = []
    uvs: list[tuple[float, float]] = []
    faces: list[ObjFace] = []
    mtllibs: list[Path] = []
    current_material = default_material

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        keyword, *rest = line.split()
        if keyword == "v" and len(rest) >= 3:
            vertices.append((float(rest[0]), float(rest[1]), float(rest[2])))
        elif keyword == "vt" and len(rest) >= 2:
            uvs.append((float(rest[0]), float(rest[1])))
        elif keyword == "f" and len(rest) >= 3:
            parsed = [obj_face_indices(token, len(vertices), len(uvs)) for token in rest]
            for index in range(1, len(parsed) - 1):
                triangle = [parsed[0], parsed[index], parsed[index + 1]]
                faces.append(
                    ObjFace(
                        vertices=[item[0] for item in triangle],
                        uvs=[item[1] for item in triangle],
                        material=current_material,
                    )
                )
        elif keyword == "usemtl" and rest:
            current_material = " ".join(rest)
        elif keyword == "mtllib" and rest:
            mtllibs.append((path.parent / " ".join(rest)).resolve())
    same_stem_mtl = path.with_suffix(".mtl").resolve()
    if same_stem_mtl.exists() and same_stem_mtl not in mtllibs and not any(mtllib.exists() for mtllib in mtllibs):
        mtllibs.append(same_stem_mtl)
    return vertices, uvs, faces, mtllibs


def parse_mtl_textures(path: Path) -> dict[str, Path]:
    textures: dict[str, Path] = {}
    current = ""
    if not path.exists():
        return textures
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        keyword, *rest = line.split()
        if keyword == "newmtl" and rest:
            current = " ".join(rest)
        elif keyword == "map_Kd" and current:
            _, texture_text = line.split(maxsplit=1)
            texture_path = extract_texture_path(texture_text)
            if texture_path:
                textures[current] = resolve_texture_path(path, texture_path)
    return textures


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


def vec_add(a: Vec3, b: Vec3) -> Vec3:
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def vec_sub(a: Vec3, b: Vec3) -> Vec3:
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def vec_scale(a: Vec3, scale: float) -> Vec3:
    return (a[0] * scale, a[1] * scale, a[2] * scale)


def vec_dot(a: Vec3, b: Vec3) -> float:
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def vec_norm(a: Vec3) -> float:
    return math.sqrt(vec_dot(a, a))


def vec_normalize(a: Vec3, fallback: Vec3) -> Vec3:
    length = vec_norm(a)
    if length <= 1e-8:
        return fallback
    return vec_scale(a, 1.0 / length)


def affine_plane_mapping(
    vertices: list[Vec3],
    uvs: list[tuple[float, float]],
    faces: list[ObjFace],
    material: str,
) -> tuple[Vec3, Vec3, Vec3]:
    samples: list[tuple[float, float, Vec3]] = []
    seen: set[tuple[int, int]] = set()
    for face in faces:
        if face.material != material:
            continue
        for vertex_index, uv_index in zip(face.vertices, face.uvs):
            if uv_index is None:
                continue
            key = (vertex_index, uv_index)
            if key in seen:
                continue
            seen.add(key)
            u, v = uvs[uv_index]
            samples.append((u, v, vertices[vertex_index]))
    if len(samples) < 3:
        raise ValueError("Texture lamina import needs at least three face vertices with UVs.")

    n = float(len(samples))
    su = sum(item[0] for item in samples)
    sv = sum(item[1] for item in samples)
    suu = sum(item[0] * item[0] for item in samples)
    suv = sum(item[0] * item[1] for item in samples)
    svv = sum(item[1] * item[1] for item in samples)
    matrix = ((suu, suv, su), (suv, svv, sv), (su, sv, n))

    def solve_component(component: int) -> tuple[float, float, float]:
        rhs = (
            sum(item[0] * item[2][component] for item in samples),
            sum(item[1] * item[2][component] for item in samples),
            sum(item[2][component] for item in samples),
        )
        return solve_3x3(matrix, rhs)

    ax, bx, cx = solve_component(0)
    ay, by, cy = solve_component(1)
    az, bz, cz = solve_component(2)
    return (ax, ay, az), (bx, by, bz), (cx, cy, cz)


def solve_3x3(matrix: tuple[Vec3, Vec3, Vec3], rhs: Vec3) -> Vec3:
    rows = [[float(matrix[row][col]) for col in range(3)] + [float(rhs[row])] for row in range(3)]
    for pivot_index in range(3):
        best = max(range(pivot_index, 3), key=lambda row: abs(rows[row][pivot_index]))
        if abs(rows[best][pivot_index]) <= 1e-10:
            raise ValueError("Could not solve texture lamina UV-to-plane mapping.")
        if best != pivot_index:
            rows[pivot_index], rows[best] = rows[best], rows[pivot_index]
        pivot = rows[pivot_index][pivot_index]
        rows[pivot_index] = [value / pivot for value in rows[pivot_index]]
        for row in range(3):
            if row == pivot_index:
                continue
            factor = rows[row][pivot_index]
            rows[row] = [value - factor * rows[pivot_index][col] for col, value in enumerate(rows[row])]
    return (rows[0][3], rows[1][3], rows[2][3])


def mapped_point(axis_u: Vec3, axis_v: Vec3, origin: Vec3, u: float, v: float) -> Vec3:
    return vec_add(vec_add(vec_scale(axis_u, u), vec_scale(axis_v, v)), origin)


def pixel_visible(
    rgba: tuple[int, int, int, int],
    *,
    has_alpha: bool,
    alpha_threshold: int,
    background_color: tuple[int, int, int],
) -> bool:
    r, g, b, a = rgba
    if has_alpha:
        return a > alpha_threshold
    distance = math.sqrt(
        float(r - background_color[0]) ** 2
        + float(g - background_color[1]) ** 2
        + float(b - background_color[2]) ** 2
    )
    return distance > 30.0


def infer_background_color(image: Any) -> tuple[int, int, int]:
    pixels = image.load()
    corners = [
        pixels[0, 0],
        pixels[max(0, image.width - 1), 0],
        pixels[0, max(0, image.height - 1)],
        pixels[max(0, image.width - 1), max(0, image.height - 1)],
    ]
    return (
        int(round(sum(pixel[0] for pixel in corners) / len(corners))),
        int(round(sum(pixel[1] for pixel in corners) / len(corners))),
        int(round(sum(pixel[2] for pixel in corners) / len(corners))),
    )


def visible_bbox(image: Any, has_alpha: bool, alpha_threshold: int, background_color: tuple[int, int, int]) -> tuple[int, int, int, int]:
    pixels = image.load()
    min_x, min_y = image.width, image.height
    max_x, max_y = -1, -1
    for y in range(image.height):
        for x in range(image.width):
            if pixel_visible(pixels[x, y], has_alpha=has_alpha, alpha_threshold=alpha_threshold, background_color=background_color):
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)
    if max_x < min_x or max_y < min_y:
        raise ValueError("Texture lamina image has no visible pixels.")
    return min_x, min_y, max_x + 1, max_y + 1


def lamina_cells(image: Any, bbox: tuple[int, int, int, int], resolution: int, alpha_threshold: int, has_alpha: bool, background_color: tuple[int, int, int]) -> list[LaminaCell]:
    min_x, min_y, max_x, max_y = bbox
    bbox_width = max(1, max_x - min_x)
    bbox_height = max(1, max_y - min_y)
    longest = max(bbox_width, bbox_height)
    cell_size = max(1.0, float(longest) / max(1, resolution))
    cols = max(1, int(math.ceil(float(bbox_width) / cell_size)))
    rows = max(1, int(math.ceil(float(bbox_height) / cell_size)))
    pixels = image.load()
    cells: list[LaminaCell] = []
    for row in range(rows):
        y0 = min_y + row * cell_size
        y1 = min(max_y, min_y + (row + 1) * cell_size)
        py0, py1 = int(math.floor(y0)), int(math.ceil(y1))
        for col in range(cols):
            x0 = min_x + col * cell_size
            x1 = min(max_x, min_x + (col + 1) * cell_size)
            px0, px1 = int(math.floor(x0)), int(math.ceil(x1))
            red = green = blue = alpha_total = visible_count = total_count = 0.0
            for y in range(py0, py1):
                if y < 0 or y >= image.height:
                    continue
                for x in range(px0, px1):
                    if x < 0 or x >= image.width:
                        continue
                    total_count += 1.0
                    r, g, b, a = pixels[x, y]
                    if not pixel_visible((r, g, b, a), has_alpha=has_alpha, alpha_threshold=alpha_threshold, background_color=background_color):
                        continue
                    visible_count += 1.0
                    weight = float(a if has_alpha else 255)
                    red += float(r) * weight
                    green += float(g) * weight
                    blue += float(b) * weight
                    alpha_total += weight
            if total_count <= 0.0 or visible_count / total_count < 0.15 or alpha_total <= 0.0:
                continue
            cells.append(
                LaminaCell(
                    x0=x0,
                    y0=y0,
                    x1=x1,
                    y1=y1,
                    color=[
                        clamp_byte(red / alpha_total),
                        clamp_byte(green / alpha_total),
                        clamp_byte(blue / alpha_total),
                    ],
                    weight=int(round(visible_count)),
                )
            )
    if not cells:
        raise ValueError("Texture lamina sampling produced no visible cells.")
    return cells


def color_distance_sq(a: list[int], b: list[int]) -> float:
    return sum(float(a[index] - b[index]) ** 2 for index in range(3))


def cluster_lamina_cells(cells: list[LaminaCell], color_count: int) -> tuple[list[list[int]], list[int]]:
    color_count = max(1, min(color_count, len(cells)))
    centers = [cells[max(0, min(len(cells) - 1, round(index * (len(cells) - 1) / max(1, color_count - 1))))].color[:] for index in range(color_count)]
    assignments = [0 for _ in cells]
    for _ in range(8):
        for index, cell in enumerate(cells):
            assignments[index] = min(range(color_count), key=lambda center_index: color_distance_sq(cell.color, centers[center_index]))
        sums = [[0.0, 0.0, 0.0, 0.0] for _ in centers]
        for assignment, cell in zip(assignments, cells):
            weight = float(max(1, cell.weight))
            sums[assignment][0] += float(cell.color[0]) * weight
            sums[assignment][1] += float(cell.color[1]) * weight
            sums[assignment][2] += float(cell.color[2]) * weight
            sums[assignment][3] += weight
        for index, values in enumerate(sums):
            if values[3] <= 0.0:
                continue
            centers[index] = [
                clamp_byte(values[0] / values[3]),
                clamp_byte(values[1] / values[3]),
                clamp_byte(values[2] / values[3]),
            ]
    return centers, assignments


def adjust_color(color: list[int], saturation: float, brightness: float) -> list[int]:
    luminance = 0.2126 * float(color[0]) + 0.7152 * float(color[1]) + 0.0722 * float(color[2])
    return [
        clamp_byte((luminance + (float(channel) - luminance) * saturation) * brightness)
        for channel in color[:3]
    ]


def lamina_uv_from_pixel(image: Any, x: float, y: float) -> tuple[float, float]:
    return (
        max(0.0, min(1.0, x / max(1.0, float(image.width)))),
        max(0.0, min(1.0, 1.0 - y / max(1.0, float(image.height)))),
    )


def make_texture_lamina_parts(
    *,
    obj_path: Path,
    joint: str,
    scale: float,
    rotate: Vec3,
    offset: Vec3,
    width: float | None,
    resolution: int,
    color_count: int,
    alpha_threshold: int,
    color_saturation: float,
    color_brightness: float,
) -> list[dict[str, Any]]:
    try:
        from PIL import Image
    except ImportError as exc:
        raise RuntimeError("Texture lamina import requires pillow.") from exc

    vertices, uvs, faces, mtllibs = read_obj_lamina_source(obj_path, "__default__")
    if not vertices or not uvs or not faces:
        raise ValueError("Texture lamina import needs OBJ vertices, UVs, and faces.")
    material_textures: dict[str, Path] = {}
    for mtllib in mtllibs:
        material_textures.update(parse_mtl_textures(mtllib))
    material = next((face.material for face in faces if face.material in material_textures), "")
    if not material:
        raise ValueError("Texture lamina import needs a material with map_Kd.")
    texture_path = material_textures[material]

    with Image.open(texture_path) as raw_image:
        has_alpha = "A" in raw_image.getbands()
        image = raw_image.convert("RGBA")
        background_color = infer_background_color(image)
        bbox = visible_bbox(image, has_alpha, alpha_threshold, background_color)
        cells = lamina_cells(image, bbox, resolution, alpha_threshold, has_alpha, background_color)
        centers, assignments = cluster_lamina_cells(cells, color_count)
        centers = [adjust_color(center, color_saturation, color_brightness) for center in centers]
        axis_u, axis_v, origin = affine_plane_mapping(vertices, uvs, faces, material)

        if width is not None and width > 0.0:
            min_x, min_y, max_x, max_y = bbox
            bbox_width = max(1.0, float(max_x - min_x))
            bbox_height = max(1.0, float(max_y - min_y))
            if bbox_width >= bbox_height:
                size_u = width
                size_v = width * bbox_height / bbox_width
            else:
                size_u = width * bbox_width / bbox_height
                size_v = width
            center_u, center_v = lamina_uv_from_pixel(image, (min_x + max_x) * 0.5, (min_y + max_y) * 0.5)
            center = mapped_point(axis_u, axis_v, origin, center_u, center_v)
            unit_u = vec_normalize(axis_u, (1.0, 0.0, 0.0))
            unit_v = vec_normalize(axis_v, (0.0, 1.0, 0.0))

            def point_from_pixel(x: float, y: float) -> Vec3:
                u_amount = (x - (min_x + max_x) * 0.5) / bbox_width
                v_amount = ((min_y + max_y) * 0.5 - y) / bbox_height
                return vec_add(vec_add(center, vec_scale(unit_u, u_amount * size_u)), vec_scale(unit_v, v_amount * size_v))

        else:

            def point_from_pixel(x: float, y: float) -> Vec3:
                u, v = lamina_uv_from_pixel(image, x, y)
                return mapped_point(axis_u, axis_v, origin, u, v)

        grouped: list[list[LaminaCell]] = [[] for _ in centers]
        for assignment, cell in zip(assignments, cells):
            grouped[assignment].append(cell)

        parts: list[dict[str, Any]] = []
        for index, group_cells in enumerate(grouped):
            if not group_cells:
                continue
            part_vertices: list[list[float]] = []
            part_faces: list[list[int]] = []
            vertex_lookup: dict[tuple[float, float], int] = {}

            def add_vertex(x: float, y: float) -> int:
                key = (round(x, 4), round(y, 4))
                if key in vertex_lookup:
                    return vertex_lookup[key]
                vertex = transform_vertex(point_from_pixel(x, y), scale, rotate, offset)
                vertex_lookup[key] = len(part_vertices)
                part_vertices.append(vertex)
                return vertex_lookup[key]

            for cell in group_cells:
                a = add_vertex(cell.x0, cell.y0)
                b = add_vertex(cell.x1, cell.y0)
                c = add_vertex(cell.x1, cell.y1)
                d = add_vertex(cell.x0, cell.y1)
                part_faces.append([a, b, c])
                part_faces.append([a, c, d])
            parts.append(
                {
                    "name": f"{material.lower().replace('.', '_')}_texture_{index}",
                    "joint": joint,
                    "vertices": part_vertices,
                    "faces": part_faces,
                    "color": centers[index],
                }
            )
    return parts


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
    material_overrides: dict[str, list[int]],
    texture_lamina: bool,
    texture_lamina_width: float | None,
    texture_lamina_resolution: int,
    texture_colors: int,
    texture_alpha_threshold: int,
    texture_color_saturation: float,
    texture_color_brightness: float,
) -> dict[str, Any]:
    skeleton_raw = json.loads(skeleton_asset.read_text(encoding="utf-8"))
    if texture_lamina:
        parts = make_texture_lamina_parts(
            obj_path=obj_path,
            joint=joint,
            scale=scale,
            rotate=rotate,
            offset=offset,
            width=texture_lamina_width,
            resolution=texture_lamina_resolution,
            color_count=texture_colors,
            alpha_threshold=texture_alpha_threshold,
            color_saturation=texture_color_saturation,
            color_brightness=texture_color_brightness,
        )
    else:
        vertices, groups, mtllibs = read_obj(obj_path, "__default__")
        material_colors = {"__default__": default_color}
        for mtllib in mtllibs:
            material_colors.update(parse_mtl_color(mtllib))
        material_colors.update(material_overrides)

        parts = []
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
            "texture_lamina": texture_lamina,
            "texture_lamina_width": texture_lamina_width if texture_lamina else None,
            "texture_lamina_resolution": texture_lamina_resolution if texture_lamina else None,
            "texture_colors": texture_colors if texture_lamina else None,
            "texture_color_saturation": texture_color_saturation if texture_lamina else None,
            "texture_color_brightness": texture_color_brightness if texture_lamina else None,
            "final_render_mode": "flat" if texture_lamina else "lit",
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
    parser.add_argument("--texture-lamina", action="store_true", help="Convert an alpha-textured flat OBJ plane into colored lamina geometry.")
    parser.add_argument("--texture-lamina-width", type=float, default=None, help="Largest generated lamina dimension in meters. If omitted, use the OBJ plane size.")
    parser.add_argument("--texture-lamina-resolution", type=int, default=96, help="Maximum visible texture grid cells along the longest side.")
    parser.add_argument("--texture-colors", type=int, default=3, help="Number of color clusters to use for --texture-lamina output.")
    parser.add_argument("--texture-alpha-threshold", type=int, default=32, help="Alpha threshold 0..255 for visible texture pixels in --texture-lamina mode.")
    parser.add_argument("--texture-color-saturation", type=float, default=1.0, help="Saturation multiplier for colors generated by --texture-lamina.")
    parser.add_argument("--texture-color-brightness", type=float, default=1.0, help="Brightness multiplier for colors generated by --texture-lamina.")
    parser.add_argument(
        "--material-color",
        action="append",
        default=[],
        metavar="MATERIAL=R,G,B",
        help="Override one material color. Can be repeated, for example --material-color IDP_leaves=40,125,55.",
    )
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
    material_overrides: dict[str, list[int]] = {}
    for item in args.material_color:
        if "=" not in item:
            raise ValueError(f"--material-color must be MATERIAL=R,G,B, got {item!r}")
        material_name, color_text = item.split("=", 1)
        material_overrides[material_name] = [clamp_byte(channel) for channel in parse_triplet(color_text, name=f"--material-color {material_name}", cast=int)]
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
        material_overrides=material_overrides,
        texture_lamina=bool(args.texture_lamina),
        texture_lamina_width=args.texture_lamina_width,
        texture_lamina_resolution=max(4, int(args.texture_lamina_resolution)),
        texture_colors=max(1, int(args.texture_colors)),
        texture_alpha_threshold=clamp_byte(int(args.texture_alpha_threshold)),
        texture_color_saturation=max(0.0, float(args.texture_color_saturation)),
        texture_color_brightness=max(0.0, float(args.texture_color_brightness)),
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(asset, indent=2) + "\n", encoding="utf-8")
    vertex_count = sum(len(part["vertices"]) for part in asset["rigid_parts"])
    face_count = sum(len(part["faces"]) for part in asset["rigid_parts"])
    print(f"Wrote {out_path} with {len(asset['rigid_parts'])} parts, {vertex_count} vertices, {face_count} faces.")


if __name__ == "__main__":
    main()
