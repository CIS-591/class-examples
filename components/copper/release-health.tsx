// Module 5 starter: an empty card. Module 5 fills it in.
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ReleaseHealth() {
  return (
    <Card data-testid="release-health" className="mt-6">
      <CardHeader>
        <CardTitle>Release health</CardTitle>
        <CardDescription>Is Ask Copper safe to ship?</CardDescription>
      </CardHeader>
      <CardContent className="text-muted-foreground text-sm">
        Nothing here yet.
      </CardContent>
    </Card>
  );
}
