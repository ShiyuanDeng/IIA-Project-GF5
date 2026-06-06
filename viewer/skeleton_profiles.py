from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from typing import Sequence

import numpy as np


Mat3f = np.ndarray


@dataclass(frozen=True)
class SkeletonProfile:
    name: str
    joint_names: tuple[str, ...]


TOY_RIG_PROFILE = SkeletonProfile(
    name="toy_rig",
    joint_names=(
        "root",
        "spine",
        "chest",
        "neck",
        "head",
        "left_shoulder",
        "left_elbow",
        "left_wrist",
        "right_shoulder",
        "right_elbow",
        "right_wrist",
        "left_hip",
        "left_knee",
        "left_ankle",
        "left_toe",
        "right_hip",
        "right_knee",
        "right_ankle",
        "right_toe",
    ),
)

# Canonical course-body profile: we use SMPL-compatible joint naming and
# ordering, but motions are authored in a normalized "course" frame so they can
# be applied consistently to both the toy rig and SMPL-family bodies.
COURSE_BODY_24_PROFILE = SkeletonProfile(
    name="course_body_24",
    joint_names=(
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
    ),
)

# These 24 names follow the official SMPL joint-name list published in the
# SMPL-X repository's joint_names.py helper.
SMPL_24_PROFILE = SkeletonProfile(
    name="smpl_24",
    joint_names=(
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
    ),
)

# SMPL-X 55-joint profile: body (0-21) + jaw/eyes (22-24) + left fingers
# (25-39) + right fingers (40-54).
SMPLX_55_PROFILE = SkeletonProfile(
    name="smplx_55",
    joint_names=(
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
        "jaw",
        "left_eye_smplhf",
        "right_eye_smplhf",
        "left_index1",
        "left_index2",
        "left_index3",
        "left_middle1",
        "left_middle2",
        "left_middle3",
        "left_pinky1",
        "left_pinky2",
        "left_pinky3",
        "left_ring1",
        "left_ring2",
        "left_ring3",
        "left_thumb1",
        "left_thumb2",
        "left_thumb3",
        "right_index1",
        "right_index2",
        "right_index3",
        "right_middle1",
        "right_middle2",
        "right_middle3",
        "right_pinky1",
        "right_pinky2",
        "right_pinky3",
        "right_ring1",
        "right_ring2",
        "right_ring3",
        "right_thumb1",
        "right_thumb2",
        "right_thumb3",
    ),
)

PROFILE_REGISTRY = {
    TOY_RIG_PROFILE.name: TOY_RIG_PROFILE,
    COURSE_BODY_24_PROFILE.name: COURSE_BODY_24_PROFILE,
    SMPL_24_PROFILE.name: SMPL_24_PROFILE,
    SMPLX_55_PROFILE.name: SMPLX_55_PROFILE,
}

RETARGET_NAME_OVERRIDES: dict[tuple[str, str], dict[str, str]] = {
    (
        COURSE_BODY_24_PROFILE.name,
        TOY_RIG_PROFILE.name,
    ): {
        "root": "pelvis",
        "spine": "spine1",
        "chest": "spine2",
        "left_toe": "left_foot",
        "right_toe": "right_foot",
    },
    (
        TOY_RIG_PROFILE.name,
        COURSE_BODY_24_PROFILE.name,
    ): {
        "pelvis": "root",
        "spine1": "spine",
        "spine2": "chest",
        "spine3": "chest",
        "left_foot": "left_toe",
        "right_foot": "right_toe",
    },
    (
        COURSE_BODY_24_PROFILE.name,
        SMPLX_55_PROFILE.name,
    ): {
        "left_index1": "left_hand",
        "left_middle1": "left_hand",
        "left_pinky1": "left_hand",
        "left_ring1": "left_hand",
        "left_thumb1": "left_hand",
        "right_index1": "right_hand",
        "right_middle1": "right_hand",
        "right_pinky1": "right_hand",
        "right_ring1": "right_hand",
        "right_thumb1": "right_hand",
    },
}
IDENTITY_ROTATION = np.eye(3, dtype=np.float32)

# Alignment matrices map the course-canonical joint frame into each profile's
# local rotation frame. Right now the course-canonical body space is deliberately
# aligned with native SMPL local rotations, so SMPL does not need any extra
# per-joint frame correction.
PROFILE_ALIGNMENT_OVERRIDES: dict[str, dict[str, Mat3f]] = {}


def get_profile(profile_name: str) -> SkeletonProfile:
    try:
        return PROFILE_REGISTRY[profile_name]
    except KeyError as exc:
        raise ValueError(f"Unknown skeleton profile: {profile_name}") from exc


def detect_profile(joint_names: Sequence[str]) -> SkeletonProfile | None:
    joint_names_tuple = tuple(joint_names)
    joint_name_set = set(joint_names_tuple)
    for profile in PROFILE_REGISTRY.values():
        if joint_names_tuple == profile.joint_names:
            return profile
        if len(joint_names_tuple) == len(profile.joint_names) and joint_name_set == set(profile.joint_names):
            return profile
    return None


def build_target_to_source_index_map(
    source_joint_names: Sequence[str],
    target_joint_names: Sequence[str],
    target_name_overrides: dict[str, str] | None = None,
) -> tuple[int | None, ...]:
    source_lookup = {name: idx for idx, name in enumerate(source_joint_names)}
    index_map: list[int | None] = []
    for target_name in target_joint_names:
        source_name = target_name
        if source_name not in source_lookup and target_name_overrides is not None:
            source_name = target_name_overrides.get(target_name, target_name)
        index_map.append(source_lookup.get(source_name))
    return tuple(index_map)


def get_retarget_name_overrides(
    source_profile_name: str,
    target_profile_name: str,
) -> dict[str, str]:
    return RETARGET_NAME_OVERRIDES.get((source_profile_name, target_profile_name), {})


def remap_local_rotations(
    source_rotations: Sequence[Mat3f],
    target_to_source_index: Sequence[int | None],
) -> list[Mat3f]:
    remapped = [np.eye(3, dtype=np.float32) for _ in target_to_source_index]
    for target_index, source_index in enumerate(target_to_source_index):
        if source_index is not None:
            remapped[target_index] = np.asarray(source_rotations[source_index], dtype=np.float32).copy()
    return remapped


def get_joint_alignment(profile_name: str, joint_name: str) -> Mat3f:
    return PROFILE_ALIGNMENT_OVERRIDES.get(profile_name, {}).get(joint_name, IDENTITY_ROTATION)


def retarget_local_rotations(
    source_rotations: Sequence[Mat3f],
    source_profile_name: str,
    target_joint_names: Sequence[str],
    target_profile_name: str | None,
) -> list[Mat3f]:
    source_profile = get_profile(source_profile_name)
    if len(source_rotations) != len(source_profile.joint_names):
        raise ValueError(
            f"Expected {len(source_profile.joint_names)} source rotations for profile "
            f"{source_profile_name}, got {len(source_rotations)}."
        )

    if target_profile_name is None:
        target_name_overrides: dict[str, str] | None = None
    else:
        target_name_overrides = get_retarget_name_overrides(source_profile_name, target_profile_name)

    target_to_source_index = build_target_to_source_index_map(
        source_profile.joint_names,
        target_joint_names,
        target_name_overrides,
    )
    remapped = [IDENTITY_ROTATION.copy() for _ in target_joint_names]
    for target_index, source_index in enumerate(target_to_source_index):
        if source_index is None:
            continue
        source_name = source_profile.joint_names[source_index]
        target_name = target_joint_names[target_index]
        source_alignment = get_joint_alignment(source_profile_name, source_name)
        source_rotation = np.asarray(source_rotations[source_index], dtype=np.float32)
        canonical_rotation = source_alignment.T @ source_rotation @ source_alignment

        target_alignment = (
            get_joint_alignment(target_profile_name, target_name)
            if target_profile_name is not None
            else IDENTITY_ROTATION
        )
        remapped[target_index] = target_alignment @ canonical_rotation @ target_alignment.T
    return remapped


def compute_topological_order(parents: Sequence[int]) -> tuple[int, ...]:
    joint_count = len(parents)
    children: list[list[int]] = [[] for _ in range(joint_count)]
    indegree = [0] * joint_count

    for joint_index, parent_index in enumerate(parents):
        if parent_index < 0:
            continue
        if parent_index >= joint_count:
            raise ValueError(
                f"Joint {joint_index} has invalid parent index {parent_index} "
                f"for skeleton with {joint_count} joints."
            )
        children[parent_index].append(joint_index)
        indegree[joint_index] += 1

    queue: deque[int] = deque(
        joint_index
        for joint_index, parent_index in enumerate(parents)
        if parent_index < 0
    )
    order: list[int] = []

    while queue:
        joint_index = queue.popleft()
        order.append(joint_index)
        for child_index in children[joint_index]:
            indegree[child_index] -= 1
            if indegree[child_index] == 0:
                queue.append(child_index)

    if len(order) != joint_count:
        raise ValueError("Skeleton graph is cyclic or otherwise not topologically sortable.")
    return tuple(order)
