from __future__ import annotations

import numpy as np


def forward_kinematics(
    joints: list[object],
    local_rotations: list[np.ndarray],
    root_offset: np.ndarray,
    topological_order: tuple[int, ...] | None = None,
) -> tuple[np.ndarray, np.ndarray]:
    """Student part-1 implementation.

    Expected inputs:
    - joints: each joint has `.parent` and `.translation`
    - local_rotations: one 3x3 local rotation matrix per joint
    - root_offset: global translation applied to the root
    - topological_order: optional parent-before-child traversal order

    Expected outputs:
    - world_rotations: shape (J, 3, 3)
    - world_positions: shape (J, 3)
    """
    J = len(joints)
    R_world = [np.eye(3) for _ in range(J)]
    p_world = [np.zeros(3) for _ in range(J)]

    traversal_order = topological_order if topological_order else np.arange(J)
    
    for i in traversal_order:
        parent = joints[i].parent
        if parent is None or parent < 0:
            R_world[i] = local_rotations[i]
            p_world[i] = root_offset + joints[i].translation
        else:
            R_world[i] = R_world[parent] @ local_rotations[i]
            p_world[i] = p_world[parent] + R_world[parent] @ joints[i].translation

    return R_world, p_world
