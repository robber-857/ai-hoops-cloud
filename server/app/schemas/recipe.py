from decimal import Decimal
from uuid import UUID
from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    HttpUrl,
    field_validator,
    model_validator,
)


class Ingredient(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    release_id: int = Field(gt=0)
    food_key: str = Field(pattern=r"^F\d{6}$")
    edible_grams: Decimal = Field(gt=0, le=100000, max_digits=9, decimal_places=2)
    preparation_note: str = Field(default="", max_length=500)


class RecipeContent(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    title: str = Field(min_length=1, max_length=200)
    instructions: str = Field(min_length=1, max_length=10000)
    servings: Decimal = Field(gt=0, le=1000, max_digits=7, decimal_places=2)
    finished_weight_grams: Decimal | None = Field(
        default=None, gt=0, le=1000000, max_digits=11, decimal_places=2
    )
    image_url: HttpUrl | None = None
    ingredients: list[Ingredient] = Field(min_length=1, max_length=100)
    allergens: list[str] = Field(default_factory=list, max_length=30)
    dietary_notes: str = Field(default="", max_length=1000)
    allergens_reviewed: bool = False

    @field_validator("allergens")
    @classmethod
    def validate_allergens(cls, items):
        if any(not s.strip() or len(s.strip()) > 100 for s in items):
            raise ValueError("Allergen labels must contain 1-100 characters")
        return list(dict.fromkeys(s.strip() for s in items))

    @model_validator(mode="after")
    def unique_foods(self):
        keys = [(i.release_id, i.food_key) for i in self.ingredients]
        if len(set(keys)) != len(keys):
            raise ValueError("Combine repeated food entries into one ingredient")
        return self


class RecipeCreate(RecipeContent):
    request_id: UUID


class RecipeUpdate(RecipeContent):
    expected_version: int = Field(ge=1)


class RecipePublish(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expected_version: int = Field(ge=1)
