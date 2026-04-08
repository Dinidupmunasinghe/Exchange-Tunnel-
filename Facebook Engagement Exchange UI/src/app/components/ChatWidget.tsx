import { MessageCircle } from "lucide-react";
import { Button } from "./ui/button";

export function ChatWidget() {
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Button
        size="lg"
        className="h-14 w-14 rounded-full bg-brand text-brand-foreground shadow-2xl shadow-brand/35 hover:bg-brand/90 hover:scale-110 transition-transform"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    </div>
  );
}
