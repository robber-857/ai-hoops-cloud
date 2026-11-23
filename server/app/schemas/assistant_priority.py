from typing import Literal

from pydantic import BaseModel, ConfigDict


PriorityKind = Literal["goal", "difficulty", "preference"]
PrioritySkill = Literal[
    "shooting", "finishing", "dribbling", "passing", "rebounding", "defense",
    "footwork", "screen_reads", "conditioning", "balance", "free_throws",
    "three_point_shooting", "jump_shooting", "game_reading", "position_play",
    "off_ball_movement",
]
PriorityHand = Literal["left", "right", "weak", "both", "unspecified"]
PriorityPosition = Literal[
    "point_guard", "shooting_guard", "small_forward", "power_forward", "center", "unspecified",
]


class TrainingPriority(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: PriorityKind
    skill: PrioritySkill
    hand: PriorityHand
    position: PriorityPosition
