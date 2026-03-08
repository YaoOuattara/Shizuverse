"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star } from "lucide-react";
import type { BookingCardProps } from "@/components/BookingCard";
import { useTranslations } from "next-intl";

interface ReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: BookingCardProps | null;
  onSubmit: (bookingId: string, providerId: string, rating: number, comment: string) => void;
}

function InteractiveStarRating({
  rating,
  onRatingChange,
  hoveredRating,
  onHover,
  onLeave,
}: {
  rating: number;
  onRatingChange: (rating: number) => void;
  hoveredRating: number;
  onHover: (rating: number) => void;
  onLeave: () => void;
}) {
  const displayRating = hoveredRating || rating;

  return (
    <div
      className="flex items-center gap-1"
      onMouseLeave={onLeave}
      data-testid="star-rating-input"
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onRatingChange(star)}
          onMouseEnter={() => onHover(star)}
          className="p-0.5 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
          data-testid={`star-button-${star}`}
          aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
        >
          <Star
            className={`h-8 w-8 transition-colors ${
              star <= displayRating
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground/30 hover:text-yellow-400/50"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export default function ReviewModal({
  open,
  onOpenChange,
  booking,
  onSubmit,
}: ReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");

  const t = useTranslations("reviewModal");

  const handleClose = () => {
    setRating(0);
    setHoveredRating(0);
    setComment("");
    onOpenChange(false);
  };

  const handleSubmit = () => {
    if (!booking || rating === 0) return;

    onSubmit(booking.id, booking.providerId, rating, comment);
    handleClose();
  };

  if (!booking) return null;

  const ratingLabels: Record<number, string> = {
    1: t("poor"),
    2: t("fair"),
    3: t("good"),
    4: t("veryGood"),
    5: t("excellent"),
  };

  const displayRating = hoveredRating || rating;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-[450px]"
        data-testid="modal-leave-review"
      >
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description", { provider: booking.providerName, service: booking.serviceName })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label>{t("yourRating")}</Label>
            <div className="flex flex-col items-center gap-2">
              <InteractiveStarRating
                rating={rating}
                onRatingChange={setRating}
                hoveredRating={hoveredRating}
                onHover={setHoveredRating}
                onLeave={() => setHoveredRating(0)}
              />
              <span
                className="text-sm font-medium text-muted-foreground h-5"
                data-testid="text-rating-label"
              >
                {displayRating > 0 ? ratingLabels[displayRating] : t("selectRating")}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="review-comment">{t("yourReview")}</Label>
            <Textarea
              id="review-comment"
              placeholder={t("placeholder")}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-[100px] resize-none"
              data-testid="textarea-review-comment"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            data-testid="button-cancel-review"
          >
            {t("cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={rating === 0}
            data-testid="button-submit-review"
          >
            {t("submitReview")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
