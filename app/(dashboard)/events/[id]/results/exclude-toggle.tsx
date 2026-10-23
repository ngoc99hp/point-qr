"use client";

import { setRatingExcluded } from "@/app/actions/ratings";
import { Button } from "@/components/ui/button";
import { useActionRunner } from "@/components/use-action-runner";

/** BR-11: lecturer excludes or restores a rating. */
export function ExcludeToggle({ ratingId, excluded }: { ratingId: string; excluded: boolean }) {
  const { isPending, run } = useActionRunner();
  return (
    <Button
      size="sm"
      variant={excluded ? "secondary" : "outline"}
      disabled={isPending}
      onClick={() => run(() => setRatingExcluded(ratingId, !excluded))}
    >
      {excluded ? "Khôi phục" : "Loại"}
    </Button>
  );
}
