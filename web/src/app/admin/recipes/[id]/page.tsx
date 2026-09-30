"use client";
import { useParams } from "next/navigation";
import { RecipeEditor } from "@/components/recipes/RecipeEditor";
export default function EditRecipe() {
  const { id } = useParams<{ id: string }>();
  return <RecipeEditor key={id} id={id} />;
}
