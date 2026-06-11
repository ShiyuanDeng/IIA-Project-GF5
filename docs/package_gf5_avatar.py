from __future__ import annotations

import argparse
import shutil
import zipfile
from pathlib import Path

import numpy as np
from scipy.spatial import cKDTree


GF5_PACKAGE_FORMAT = "gf5_smpl24_skinning_weights"
GF5_SMPLX_PACKAGE_FORMAT = "gf5_smplx55_skinning_weights"
GF5_PACKAGE_VERSION = 5
GF5_COORDINATE_SPACE = "up2you_smpl_native_y_up"
GF5_REST_POSE = "gf5_smpl24_template_neutral_bind_pose"
GF5_MOTION_POSE_SPACE = "gf5_course_body_24_absolute_local"

SMPL24_JOINT_NAMES = (
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
)

SMPLX_55_JOINT_NAMES = (
    "pelvis", "left_hip", "right_hip", "spine1", "left_knee", "right_knee",
    "spine2", "left_ankle", "right_ankle", "spine3", "left_foot", "right_foot",
    "neck", "left_collar", "right_collar", "head", "left_shoulder", "right_shoulder",
    "left_elbow", "right_elbow", "left_wrist", "right_wrist", "jaw",
    "left_eye_smplhf", "right_eye_smplhf", "left_index1", "left_index2",
    "left_index3", "left_middle1", "left_middle2", "left_middle3", "left_pinky1",
    "left_pinky2", "left_pinky3", "left_ring1", "left_ring2", "left_ring3",
    "left_thumb1", "left_thumb2", "left_thumb3", "right_index1", "right_index2",
    "right_index3", "right_middle1", "right_middle2", "right_middle3",
    "right_pinky1", "right_pinky2", "right_pinky3", "right_ring1", "right_ring2",
    "right_ring3", "right_thumb1", "right_thumb2", "right_thumb3",
)

SMPL_TO_VIEWER_ROTATION = np.asarray(
    [
        [-1.0, 0.0, 0.0],
        [0.0, 0.0, 1.0],
        [0.0, 1.0, 0.0],
    ],
    dtype=np.float32,
)

# Copied from GF5 assets/blocky/generate_blocky_assets.py. Packages declare this
# bind-pose convention, so this gives a deterministic fallback when fitted
# SMPL-X joints do not line up well with GF5's shared SMPL-24 proxy.
GF5_SMPL24_TEMPLATE_REST_JOINTS_VIEWER = np.asarray(
    [
        [0.0, 0.0, 0.935344],
        [-0.058189, -0.026001, 0.842581],
        [0.063267, -0.02125, 0.831436],
        [0.002763, -0.027618, 1.045235],
        [-0.112885, -0.035397, 0.463827],
        [0.107477, -0.038074, 0.469056],
        [-0.006685, -0.033558, 1.177088],
        [-0.069431, -0.067273, 0.060768],
        [0.092061, -0.058267, 0.058329],
        [0.004645, -0.005111, 1.229323],
        [-0.116689, 0.050943, 0.002771],
        [0.130873, 0.060782, 0.0],
        [0.01681, -0.036726, 1.39449],
        [-0.041719, -0.012331, 1.314267],
        [0.05234, -0.018511, 1.313662],
        [-0.007974, -0.015989, 1.554942],
        [-0.160958, -0.027792, 1.371995],
        [0.154918, -0.031179, 1.367186],
        [-0.415081, -0.070251, 1.299845],
        [0.426068, -0.057646, 1.330694],
        [-0.667067, -0.072723, 1.323066],
        [0.675335, -0.072971, 1.326161],
        [-0.753753, -0.078746, 1.311706],
        [0.759999, -0.078746, 1.311706],
    ],
    dtype=np.float32,
)

# UP2You AposeRenderer sets body_pose[15] = [0,0,-pi/4] (left_shoulder, SMPL-X joint 16)
# and body_pose[16] = [0,0,+pi/4] (right_shoulder, SMPL-X joint 17). These are rotations
# around the local Z-axis in SMPL native Y-up space (Z = forward), which in practice acts
# as a global-Z rotation since the collar's world frame is near-identity at rest.
_APOSE_LEFT_SHOULDER_Z = -np.pi / 4
_APOSE_RIGHT_SHOULDER_Z = +np.pi / 4

# SMPL-24 joints that inherit the shoulder rotation in A-pose (shoulder → elbow → wrist → hand)
_LEFT_ARM_JOINTS = (16, 18, 20, 22)
_RIGHT_ARM_JOINTS = (17, 19, 21, 23)
_LEFT_SMPLX_ARM_JOINTS = tuple(range(16, 17)) + (18, 20) + tuple(range(25, 40))
_RIGHT_SMPLX_ARM_JOINTS = tuple(range(17, 18)) + (19, 21) + tuple(range(40, 55))


def rotate_points_to_viewer(points: np.ndarray) -> np.ndarray:
    return np.asarray(points, dtype=np.float32) @ SMPL_TO_VIEWER_ROTATION.T


def rotate_points_to_smpl(points: np.ndarray) -> np.ndarray:
    return np.asarray(points, dtype=np.float32) @ SMPL_TO_VIEWER_ROTATION


def _rot_z(angle: float) -> np.ndarray:
    """Rotation matrix around Z-axis (SMPL native Y-up space)."""
    c, s = float(np.cos(angle)), float(np.sin(angle))
    return np.asarray([[c, -s, 0.0], [s, c, 0.0], [0.0, 0.0, 1.0]], dtype=np.float32)


def parse_obj_vertices(path: Path) -> np.ndarray:
    vertices: list[list[float]] = []
    with path.open("r", encoding="utf-8", errors="replace") as handle:
        for line in handle:
            if not line.startswith("v "):
                continue
            parts = line.strip().split()
            if len(parts) < 4:
                continue
            vertices.append([float(parts[1]), float(parts[2]), float(parts[3])])
    if not vertices:
        raise ValueError(f"No OBJ vertices found in {path}")
    return np.asarray(vertices, dtype=np.float32)


def write_obj_with_vertices(src_path: Path, dst_path: Path, new_vertices: np.ndarray) -> None:
    """Write an OBJ file identical to src_path but with vertex positions replaced.

    Preserves any extra per-vertex data on each 'v' line (e.g. r g b vertex colours).
    """
    with src_path.open("r", encoding="utf-8", errors="replace") as fh:
        lines = fh.readlines()
    vi = 0
    out_lines = []
    for line in lines:
        parts = line.strip().split()
        if parts and parts[0] == "v" and len(parts) >= 4:
            v = new_vertices[vi]
            extra = "".join(f" {p}" for p in parts[4:])  # preserve colours or other fields
            out_lines.append(f"v {v[0]:.6f} {v[1]:.6f} {v[2]:.6f}{extra}\n")
            vi += 1
        else:
            out_lines.append(line)
    if vi != len(new_vertices):
        raise ValueError(
            f"Vertex count mismatch: OBJ has {vi} vertices, new_vertices has {len(new_vertices)}"
        )
    with dst_path.open("w", encoding="utf-8") as fh:
        fh.writelines(out_lines)


def collapse_smplx_weights_to_smpl24(weights55: np.ndarray) -> np.ndarray:
    if weights55.ndim != 2 or weights55.shape[1] < 55:
        raise ValueError(f"Expected SMPL-X weights with shape (V, 55), got {weights55.shape}")

    weights24 = np.zeros((weights55.shape[0], len(SMPL24_JOINT_NAMES)), dtype=np.float32)
    weights24[:, :22] = weights55[:, :22]

    # SMPL-X has jaw/eyes at 22:25; GF5 SMPL-24 has no face joints, so attach
    # any face influence to head. Fingers are collapsed to one coarse hand joint.
    weights24[:, 15] += weights55[:, 22:25].sum(axis=1)
    weights24[:, 22] = weights55[:, 25:40].sum(axis=1)
    weights24[:, 23] = weights55[:, 40:55].sum(axis=1)

    row_sums = np.clip(weights24.sum(axis=1, keepdims=True), 1e-8, None)
    return (weights24 / row_sums).astype(np.float32)


def smpl24_rest_joints_from_smplx_vertices(
    smplx_vertices: np.ndarray,
    smplx_model_npz: Path,
) -> np.ndarray:
    with np.load(smplx_model_npz, allow_pickle=False) as data:
        regressor = np.asarray(data["J_regressor"], dtype=np.float32)

    if regressor.shape[1] != smplx_vertices.shape[0]:
        raise ValueError(
            f"J_regressor expects {regressor.shape[1]} SMPL-X vertices, "
            f"but fitted mesh has {smplx_vertices.shape[0]} vertices."
        )

    smplx_joints = regressor @ smplx_vertices
    rest_joints = np.zeros((len(SMPL24_JOINT_NAMES), 3), dtype=np.float32)
    rest_joints[:22] = smplx_joints[:22]

    # Approximate coarse SMPL hand joints from SMPL-X finger-root joints.
    left_finger_roots = [25, 28, 31, 34, 37]
    right_finger_roots = [40, 43, 46, 49, 52]
    rest_joints[22] = smplx_joints[left_finger_roots].mean(axis=0)
    rest_joints[23] = smplx_joints[right_finger_roots].mean(axis=0)
    return rest_joints.astype(np.float32)


def smplx_rest_joints_from_vertices(
    smplx_vertices: np.ndarray,
    smplx_model_npz: Path,
) -> np.ndarray:
    with np.load(smplx_model_npz, allow_pickle=False) as data:
        regressor = np.asarray(data["J_regressor"], dtype=np.float32)

    if regressor.shape[1] != smplx_vertices.shape[0]:
        raise ValueError(
            f"J_regressor expects {regressor.shape[1]} SMPL-X vertices, "
            f"but fitted mesh has {smplx_vertices.shape[0]} vertices."
        )
    return (regressor @ smplx_vertices).astype(np.float32)


def smpl24_tpose_joints_from_apose(joints_apose: np.ndarray) -> np.ndarray:
    """Convert SMPL-24 A-pose joints to T-pose by inverting the UP2You shoulder rotation.

    UP2You's AposeRenderer rotates SMPL-X joint 16 (left_shoulder) by [0,0,-pi/4] and
    joint 17 (right_shoulder) by [0,0,+pi/4] in native SMPL Z-axis space. All descendant
    arm joints inherit the same world rotation. Inverting this gives T-pose positions.
    """
    joints = np.asarray(joints_apose, dtype=np.float32).copy()

    R_inv_L = _rot_z(-_APOSE_LEFT_SHOULDER_Z)   # rot_z(+pi/4)  — undoes left A-pose
    R_inv_R = _rot_z(-_APOSE_RIGHT_SHOULDER_Z)   # rot_z(-pi/4)  — undoes right A-pose

    shoulder_L = joints_apose[16].copy()
    for j in _LEFT_ARM_JOINTS[1:]:   # elbow, wrist, hand
        joints[j] = shoulder_L + R_inv_L @ (joints_apose[j] - joints_apose[16])

    shoulder_R = joints_apose[17].copy()
    for j in _RIGHT_ARM_JOINTS[1:]:
        joints[j] = shoulder_R + R_inv_R @ (joints_apose[j] - joints_apose[17])

    return joints


def repose_apose_to_tpose(
    animation_vertices: np.ndarray,
    skinning_weights_24: np.ndarray,
    rest_joints_apose: np.ndarray,
    rest_joints_tpose: np.ndarray,
) -> np.ndarray:
    """Re-pose the animation mesh from UP2You A-pose to T-pose via inverse LBS.

    Standard SMPL LBS: v_A = sum_j w_j * G_j * v_T
    where G_j = (R_j, p_A_j - R_j @ p_T_j) maps T-pose to A-pose.
    Inverting the per-vertex blended matrix M = sum_j w_j * G_j gives v_T = M^{-1} v_A.

    Only arm joints carry non-identity rotations; all others have R_j = I so G_j is a
    pure translation that cancels in M, leaving non-arm vertices unchanged.
    """
    J = len(SMPL24_JOINT_NAMES)

    # Per-joint world rotation in A-pose. Shoulder and all its FK descendants share the
    # same world rotation (local rotations of elbow/wrist/hand are identity in A-pose).
    R_world = [np.eye(3, dtype=np.float32)] * J
    R_L = _rot_z(_APOSE_LEFT_SHOULDER_Z)
    R_R = _rot_z(_APOSE_RIGHT_SHOULDER_Z)
    for j in _LEFT_ARM_JOINTS:
        R_world[j] = R_L
    for j in _RIGHT_ARM_JOINTS:
        R_world[j] = R_R

    # Build per-joint 4x4 blend matrices that map T-pose → A-pose.
    G = np.zeros((J, 4, 4), dtype=np.float32)
    for j in range(J):
        R = R_world[j]
        G[j, :3, :3] = R
        G[j, :3, 3] = rest_joints_apose[j] - R @ rest_joints_tpose[j]
        G[j, 3, 3] = 1.0

    # Per-vertex blended matrix: M[v] = sum_j w[v,j] * G[j]  →  shape (V, 4, 4)
    M = np.einsum("vj,jkl->vkl", skinning_weights_24.astype(np.float32), G)

    # Solve M @ [v_T; 1] = [v_A; 1] for v_T for each vertex.
    V = animation_vertices.shape[0]
    v_hom = np.concatenate(
        [animation_vertices.astype(np.float32), np.ones((V, 1), dtype=np.float32)], axis=1
    )
    v_T_hom = np.linalg.solve(M, v_hom[..., np.newaxis]).squeeze(-1)
    return v_T_hom[:, :3].astype(np.float32)


def smplx_tpose_joints_from_apose(joints_apose: np.ndarray) -> np.ndarray:
    joints = np.asarray(joints_apose, dtype=np.float32).copy()
    R_inv_L = _rot_z(-_APOSE_LEFT_SHOULDER_Z)
    R_inv_R = _rot_z(-_APOSE_RIGHT_SHOULDER_Z)

    shoulder_L = joints_apose[16].copy()
    for j in _LEFT_SMPLX_ARM_JOINTS:
        if j != 16:
            joints[j] = shoulder_L + R_inv_L @ (joints_apose[j] - shoulder_L)

    shoulder_R = joints_apose[17].copy()
    for j in _RIGHT_SMPLX_ARM_JOINTS:
        if j != 17:
            joints[j] = shoulder_R + R_inv_R @ (joints_apose[j] - shoulder_R)
    return joints.astype(np.float32)


def repose_smplx_apose_to_tpose(
    smplx_vertices_apose: np.ndarray,
    skinning_weights_55: np.ndarray,
    rest_joints_apose: np.ndarray,
    rest_joints_tpose: np.ndarray,
) -> np.ndarray:
    joint_count = rest_joints_apose.shape[0]
    R_world = np.repeat(np.eye(3, dtype=np.float32)[None, :, :], joint_count, axis=0)
    R_world[list(_LEFT_SMPLX_ARM_JOINTS)] = _rot_z(_APOSE_LEFT_SHOULDER_Z)
    R_world[list(_RIGHT_SMPLX_ARM_JOINTS)] = _rot_z(_APOSE_RIGHT_SHOULDER_Z)

    G = np.zeros((joint_count, 4, 4), dtype=np.float32)
    G[:, 3, 3] = 1.0
    for j in range(joint_count):
        R = R_world[j]
        G[j, :3, :3] = R
        G[j, :3, 3] = rest_joints_apose[j] - R @ rest_joints_tpose[j]

    M = np.einsum("vj,jkl->vkl", skinning_weights_55.astype(np.float32), G)
    vertices_hom = np.concatenate(
        [smplx_vertices_apose.astype(np.float32), np.ones((smplx_vertices_apose.shape[0], 1), dtype=np.float32)],
        axis=1,
    )
    vertices_tpose_hom = np.linalg.solve(M, vertices_hom[..., np.newaxis]).squeeze(-1)
    return vertices_tpose_hom[:, :3].astype(np.float32)


def load_smplx_template_weights(smplx_model_npz: Path, vertex_count: int) -> np.ndarray:
    with np.load(smplx_model_npz, allow_pickle=False) as data:
        weights = np.asarray(data["weights"], dtype=np.float32)
    if weights.shape != (vertex_count, 55):
        raise ValueError(
            f"Expected SMPL-X template weights with shape {(vertex_count, 55)}, got {weights.shape}."
        )
    row_sums = np.clip(weights.sum(axis=1, keepdims=True), 1e-8, None)
    return (weights / row_sums).astype(np.float32)


def transfer_skinning_weights(
    animation_vertices: np.ndarray,
    fitted_smplx_vertices: np.ndarray,
    smplx_model_npz: Path,
    neighbors: int,
) -> np.ndarray:
    with np.load(smplx_model_npz, allow_pickle=False) as data:
        smplx_template_weights = np.asarray(data["weights"], dtype=np.float32)

    if smplx_template_weights.shape[0] != fitted_smplx_vertices.shape[0]:
        raise ValueError(
            f"SMPL-X template weights have {smplx_template_weights.shape[0]} vertices, "
            f"but fitted mesh has {fitted_smplx_vertices.shape[0]} vertices."
        )

    weights24_on_smplx = collapse_smplx_weights_to_smpl24(smplx_template_weights)
    neighbors = max(1, int(neighbors))
    tree = cKDTree(fitted_smplx_vertices)
    if neighbors == 1:
        nearest = tree.query(animation_vertices, k=1)[1]
        return weights24_on_smplx[np.asarray(nearest, dtype=np.int64)].astype(np.float32)

    distances, indices = tree.query(animation_vertices, k=neighbors)
    distances = np.asarray(distances, dtype=np.float32)
    indices = np.asarray(indices, dtype=np.int64)
    inverse_distances = 1.0 / np.clip(distances, 1e-6, None)
    blend_weights = inverse_distances / np.clip(inverse_distances.sum(axis=1, keepdims=True), 1e-8, None)
    skinning_weights = np.einsum("vk,vkj->vj", blend_weights, weights24_on_smplx[indices])
    row_sums = np.clip(skinning_weights.sum(axis=1, keepdims=True), 1e-8, None)
    return (skinning_weights / row_sums).astype(np.float32)


def transfer_smplx_skinning_weights(
    animation_vertices: np.ndarray,
    fitted_smplx_vertices: np.ndarray,
    smplx_model_npz: Path,
    neighbors: int,
) -> np.ndarray:
    with np.load(smplx_model_npz, allow_pickle=False) as data:
        smplx_template_weights = np.asarray(data["weights"], dtype=np.float32)

    if smplx_template_weights.shape[0] != fitted_smplx_vertices.shape[0]:
        raise ValueError(
            f"SMPL-X template weights have {smplx_template_weights.shape[0]} vertices, "
            f"but fitted mesh has {fitted_smplx_vertices.shape[0]} vertices."
        )
    if smplx_template_weights.shape[1] < len(SMPLX_55_JOINT_NAMES):
        raise ValueError(
            f"Expected at least {len(SMPLX_55_JOINT_NAMES)} SMPL-X weight columns, "
            f"got {smplx_template_weights.shape[1]}."
        )

    weights55_on_smplx = smplx_template_weights[:, : len(SMPLX_55_JOINT_NAMES)]
    neighbors = max(1, int(neighbors))
    tree = cKDTree(fitted_smplx_vertices)
    if neighbors == 1:
        nearest = tree.query(animation_vertices, k=1)[1]
        skinning_weights = weights55_on_smplx[np.asarray(nearest, dtype=np.int64)]
    else:
        distances, indices = tree.query(animation_vertices, k=neighbors)
        distances = np.asarray(distances, dtype=np.float32)
        indices = np.asarray(indices, dtype=np.int64)
        inverse_distances = 1.0 / np.clip(distances, 1e-6, None)
        blend_weights = inverse_distances / np.clip(inverse_distances.sum(axis=1, keepdims=True), 1e-8, None)
        skinning_weights = np.einsum("vk,vkj->vj", blend_weights, weights55_on_smplx[indices])

    row_sums = np.clip(skinning_weights.sum(axis=1, keepdims=True), 1e-8, None)
    return (skinning_weights / row_sums).astype(np.float32)




def _point_segment_distance(points: np.ndarray, start: np.ndarray, end: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    segment = end - start
    denom = max(float(segment @ segment), 1e-8)
    t = np.clip(((points - start) @ segment) / denom, 0.0, 1.0)
    closest = start + t[:, None] * segment
    return np.linalg.norm(points - closest, axis=1), t


def _redistribute_weights(weights: np.ndarray, mask: np.ndarray, keep_joints: tuple[int, ...], suppress_joints: tuple[int, ...]) -> None:
    if not np.any(mask):
        return
    moved = weights[np.ix_(mask, suppress_joints)].sum(axis=1)
    keep = weights[np.ix_(mask, keep_joints)]
    keep_sums = keep.sum(axis=1, keepdims=True)
    fallback = np.zeros_like(keep)
    fallback[:, 0] = 1.0
    distribution = np.where(keep_sums > 1e-6, keep / np.clip(keep_sums, 1e-8, None), fallback)
    weights[np.ix_(mask, suppress_joints)] = 0.0
    weights[np.ix_(mask, keep_joints)] += distribution * moved[:, None]
    row_sums = np.clip(weights[mask].sum(axis=1, keepdims=True), 1e-8, None)
    weights[mask] = weights[mask] / row_sums


def clean_arm_torso_weight_bleed_24(animation_vertices: np.ndarray, weights: np.ndarray, rest_joints_apose: np.ndarray) -> np.ndarray:
    cleaned = np.asarray(weights, dtype=np.float32).copy()
    torso_joints = (0, 3, 6, 9, 12, 13, 14, 15)
    specs = (
        (16, 18, 20, 22, +1.0),
        (17, 19, 21, 23, -1.0),
    )
    for shoulder, elbow, wrist, hand, side_sign in specs:
        upper_dist, upper_t = _point_segment_distance(animation_vertices, rest_joints_apose[shoulder], rest_joints_apose[elbow])
        lower_dist, lower_t = _point_segment_distance(animation_vertices, rest_joints_apose[elbow], rest_joints_apose[wrist])
        outward = side_sign * (animation_vertices[:, 0] - rest_joints_apose[shoulder, 0]) > 0.025
        upper_mask = outward & (upper_dist < 0.18) & (upper_t > 0.03) & (upper_t < 1.08)
        lower_mask = outward & (lower_dist < 0.16) & (lower_t >= 0.0) & (lower_t < 1.15)
        arm_weight = cleaned[:, [shoulder, elbow, wrist, hand]].sum(axis=1)
        torso_weight = cleaned[:, torso_joints].sum(axis=1)
        confident_arm = arm_weight > 0.35
        bad_torso = torso_weight > 0.08
        upper_fix = upper_mask & confident_arm & bad_torso
        lower_fix = lower_mask & (arm_weight > 0.45) & (torso_weight > 0.05)
        _redistribute_weights(cleaned, upper_fix, (shoulder, elbow, wrist, hand), torso_joints)
        _redistribute_weights(cleaned, lower_fix, (elbow, wrist, hand), torso_joints)
    return cleaned.astype(np.float32)


def clean_arm_torso_weight_bleed_55(animation_vertices: np.ndarray, weights: np.ndarray, rest_joints_apose: np.ndarray) -> np.ndarray:
    cleaned = np.asarray(weights, dtype=np.float32).copy()
    torso_joints = (0, 3, 6, 9, 12, 13, 14, 15)
    specs = (
        (16, 18, 20, tuple(range(25, 40)), +1.0),
        (17, 19, 21, tuple(range(40, 55)), -1.0),
    )
    for shoulder, elbow, wrist, hand_joints, side_sign in specs:
        arm_joints = (shoulder, elbow, wrist) + tuple(hand_joints)
        upper_dist, upper_t = _point_segment_distance(animation_vertices, rest_joints_apose[shoulder], rest_joints_apose[elbow])
        lower_dist, lower_t = _point_segment_distance(animation_vertices, rest_joints_apose[elbow], rest_joints_apose[wrist])
        outward = side_sign * (animation_vertices[:, 0] - rest_joints_apose[shoulder, 0]) > 0.025
        upper_mask = outward & (upper_dist < 0.18) & (upper_t > 0.03) & (upper_t < 1.08)
        lower_mask = outward & (lower_dist < 0.16) & (lower_t >= 0.0) & (lower_t < 1.15)
        arm_weight = cleaned[:, arm_joints].sum(axis=1)
        torso_weight = cleaned[:, torso_joints].sum(axis=1)
        upper_fix = upper_mask & (arm_weight > 0.35) & (torso_weight > 0.08)
        lower_fix = lower_mask & (arm_weight > 0.45) & (torso_weight > 0.05)
        _redistribute_weights(cleaned, upper_fix, arm_joints, torso_joints)
        _redistribute_weights(cleaned, lower_fix, (elbow, wrist) + tuple(hand_joints), torso_joints)
    return cleaned.astype(np.float32)

def gf5_template_rest_joints_for_package(animation_vertices: np.ndarray) -> np.ndarray:
    rest_vertices_viewer = rotate_points_to_viewer(animation_vertices)
    ground_translation = np.asarray(
        [0.0, 0.0, -float(rest_vertices_viewer[:, 2].min())],
        dtype=np.float32,
    )
    rest_joints_viewer = GF5_SMPL24_TEMPLATE_REST_JOINTS_VIEWER - ground_translation
    return rotate_points_to_smpl(rest_joints_viewer).astype(np.float32)


def package_avatar(
    up2you_output_dir: Path,
    gf5_root: Path,
    avatar_name: str,
    smplx_model_npz: Path,
    weight_neighbors: int,
) -> tuple[Path, Path]:
    meshes_dir = up2you_output_dir / "meshes"
    result_mesh = meshes_dir / "result_clr.obj"
    smplx_mesh = meshes_dir / "smplx_mesh.obj"
    if not result_mesh.exists():
        raise FileNotFoundError(f"Missing UP2You result mesh: {result_mesh}")
    if not smplx_mesh.exists():
        raise FileNotFoundError(f"Missing UP2You SMPL-X mesh: {smplx_mesh}")
    if not smplx_model_npz.exists():
        raise FileNotFoundError(f"Missing SMPL-X model npz: {smplx_model_npz}")

    package_outputs = gf5_root / "libraries" / "avatars" / avatar_name / "outputs"
    package_outputs.mkdir(parents=True, exist_ok=True)

    packaged_smplx_mesh_path = package_outputs / "smplx_mesh.obj"
    shutil.copy2(smplx_mesh, packaged_smplx_mesh_path)

    # Load A-pose vertices
    animation_vertices_apose = parse_obj_vertices(result_mesh)
    fitted_smplx_vertices = parse_obj_vertices(packaged_smplx_mesh_path)
    smplx_skinning_weights = load_smplx_template_weights(
        smplx_model_npz,
        fitted_smplx_vertices.shape[0],
    )

    # Compute A-pose rest joints from the fitted SMPL-X mesh via J_regressor.
    rest_joints_apose = smpl24_rest_joints_from_smplx_vertices(
        fitted_smplx_vertices,
        smplx_model_npz,
    )
    smplx_rest_joints_apose = smplx_rest_joints_from_vertices(
        fitted_smplx_vertices,
        smplx_model_npz,
    )

    # Transfer skinning weights using A-pose geometry (pose-independent weights).
    skinning_weights = transfer_skinning_weights(
        animation_vertices_apose,
        fitted_smplx_vertices,
        smplx_model_npz,
        weight_neighbors,
    )
    clothed_smplx_skinning_weights = transfer_smplx_skinning_weights(
        animation_vertices_apose,
        fitted_smplx_vertices,
        smplx_model_npz,
        weight_neighbors,
    )
    skinning_weights = clean_arm_torso_weight_bleed_24(
        animation_vertices_apose,
        skinning_weights,
        rest_joints_apose,
    )
    clothed_smplx_skinning_weights = clean_arm_torso_weight_bleed_55(
        animation_vertices_apose,
        clothed_smplx_skinning_weights,
        smplx_rest_joints_apose,
    )

    # Derive T-pose rest joints by inverting the known UP2You A-pose shoulder rotation.
    # GF5 motion data uses T-pose (arms horizontal) as the zero-rotation reference, so
    # the skeleton bone vectors must also be T-pose for FK + LBS to produce correct results.
    rest_joints_tpose = smpl24_tpose_joints_from_apose(rest_joints_apose)
    smplx_rest_joints_tpose = smplx_tpose_joints_from_apose(smplx_rest_joints_apose)

    # Re-pose the animation mesh from A-pose to T-pose so that rest_vertices and
    # rest_joints are in the same canonical pose required by the GF5 skinning system.
    print("Re-posing animation mesh from A-pose to T-pose …")
    animation_vertices_tpose = repose_apose_to_tpose(
        animation_vertices_apose,
        skinning_weights,
        rest_joints_apose,
        rest_joints_tpose,
    )
    print("Re-posing SMPL-X mesh from A-pose to T-pose …")
    smplx_vertices_tpose = repose_smplx_apose_to_tpose(
        fitted_smplx_vertices,
        smplx_skinning_weights,
        smplx_rest_joints_apose,
        smplx_rest_joints_tpose,
    )

    # Write the T-pose OBJ (preserving UV / normals / faces from the source).
    animation_mesh_path = package_outputs / "animation_lowres.obj"
    write_obj_with_vertices(result_mesh, animation_mesh_path, animation_vertices_tpose)
    smplx_tpose_mesh_path = package_outputs / "smplx_mesh_tpose.obj"
    write_obj_with_vertices(packaged_smplx_mesh_path, smplx_tpose_mesh_path, smplx_vertices_tpose)

    weights_path = package_outputs / "animation_lowres_skinning_weights.npz"
    np.savez_compressed(
        weights_path,
        format=np.asarray(GF5_PACKAGE_FORMAT),
        version=np.asarray(GF5_PACKAGE_VERSION, dtype=np.int32),
        rest_joint_coordinate_space=np.asarray(GF5_COORDINATE_SPACE),
        rest_pose=np.asarray(GF5_REST_POSE),
        motion_pose_space=np.asarray(GF5_MOTION_POSE_SPACE),
        joint_names=np.asarray(SMPL24_JOINT_NAMES),
        skinning_weights=skinning_weights.astype(np.float32),
        rest_joints=rest_joints_tpose.astype(np.float32),
    )
    smplx_weights_path = package_outputs / "smplx_skinning_weights.npz"
    np.savez_compressed(
        smplx_weights_path,
        format=np.asarray(GF5_SMPLX_PACKAGE_FORMAT),
        version=np.asarray(GF5_PACKAGE_VERSION, dtype=np.int32),
        rest_joint_coordinate_space=np.asarray(GF5_COORDINATE_SPACE),
        rest_pose=np.asarray(GF5_REST_POSE),
        motion_pose_space=np.asarray(GF5_MOTION_POSE_SPACE),
        joint_names=np.asarray(SMPLX_55_JOINT_NAMES),
        skinning_weights=smplx_skinning_weights.astype(np.float32),
        rest_joints=smplx_rest_joints_tpose.astype(np.float32),
        source_mesh=np.asarray("smplx_mesh_tpose.obj"),
    )
    clothed_smplx_weights_path = package_outputs / "animation_lowres_smplx55_skinning_weights.npz"
    np.savez_compressed(
        clothed_smplx_weights_path,
        format=np.asarray(GF5_SMPLX_PACKAGE_FORMAT),
        version=np.asarray(GF5_PACKAGE_VERSION, dtype=np.int32),
        rest_joint_coordinate_space=np.asarray(GF5_COORDINATE_SPACE),
        rest_pose=np.asarray(GF5_REST_POSE),
        motion_pose_space=np.asarray(GF5_MOTION_POSE_SPACE),
        joint_names=np.asarray(SMPLX_55_JOINT_NAMES),
        skinning_weights=clothed_smplx_skinning_weights.astype(np.float32),
        rest_joints=smplx_rest_joints_tpose.astype(np.float32),
        source_mesh=np.asarray("animation_lowres.obj"),
    )

    zip_path = up2you_output_dir / f"{avatar_name}_gf5_avatar.zip"
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        package_root = package_outputs.parent
        for path in sorted(package_root.rglob("*")):
            if path.is_file():
                archive.write(path, path.relative_to(package_root))

    return package_outputs.parent, zip_path


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Package a UP2You reconstruction as a GF5 SMPL-24 avatar."
    )
    parser.add_argument("--up2you-output", required=True, help="UP2You output directory, e.g. outputs/alex")
    parser.add_argument("--gf5-root", default="/home/drdeng/IIA-Project-GF5", help="GF5 project root")
    parser.add_argument("--avatar-name", required=True, help="Name under GF5 libraries/avatars/")
    parser.add_argument(
        "--smplx-model-npz",
        default="human_models/models/smplx/SMPLX_NEUTRAL.npz",
        help="UP2You SMPL-X neutral model npz",
    )
    parser.add_argument(
        "--weight-neighbors",
        type=int,
        default=8,
        help="Number of nearest fitted SMPL-X vertices to blend when transferring skinning weights.",
    )
    args = parser.parse_args()

    package_root, zip_path = package_avatar(
        Path(args.up2you_output),
        Path(args.gf5_root),
        args.avatar_name,
        Path(args.smplx_model_npz),
        args.weight_neighbors,
    )
    print(f"GF5 avatar package written to: {package_root}")
    print(f"GF5 avatar ZIP written to: {zip_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
