"use client";
import { useParams } from "next/navigation";
import { RecipeDetail } from "@/components/recipes/RecipeDetail";
export default function RecipePage() {
  const { id } = useParams<{ id: string }>();
  return <RecipeDetail key={id} id={id} />;
}
