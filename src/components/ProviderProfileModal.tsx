"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Star, Clock, Calendar } from "lucide-react";
import type { Provider, Review } from "@/data/mockProviders";
import { formatMoney } from "@/lib/currency";
import { useTranslations } from "next-intl";

interface ProviderProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: Provider | null;
  reviews: Review[];
  onBookNow: (provider: Provider) => void;
}

function StarRating({ rating, size = "default" }: { rating: number; size?: "default" | "small" }) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
  const starSize = size === "small" ? "h-3 w-3" : "h-4 w-4";

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: fullStars }).map((_, i) => (
        <Star
          key={`full-${i}`}
          className={`${starSize} fill-yellow-400 text-yellow-400`}
        />
      ))}
      {hasHalfStar && (
        <Star
          key="half"
          className={`${starSize} fill-yellow-400/50 text-yellow-400`}
        />
      )}
      {Array.from({ length: emptyStars }).map((_, i) => (
        <Star
          key={`empty-${i}`}
          className={`${starSize} text-muted-foreground/30`}
        />
      ))}
    </div>
  );
}

export default function ProviderProfileModal({
  open,
  onOpenChange,
  provider,
  reviews,
  onBookNow,
}: ProviderProfileModalProps) {
  const t = useTranslations("providerProfileModal");

  if (!provider) return null;

  const initials = provider.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const handleBookNow = () => {
    onBookNow(provider);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[95vw] max-w-[600px] max-h-[85vh] sm:max-h-[90vh] flex flex-col p-4 sm:p-6"
        data-testid="modal-provider-profile"
      >
        <DialogHeader className="pb-2">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-4">
            <Avatar className="h-14 w-14 sm:h-16 sm:w-16 shrink-0" data-testid="avatar-provider">
              <AvatarFallback className="text-base sm:text-lg bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <DialogTitle
                className="text-lg sm:text-xl"
                data-testid="text-provider-name"
              >
                {provider.name}
              </DialogTitle>
              <div className="mt-1 flex flex-col sm:flex-row sm:flex-wrap items-center sm:items-start gap-1 sm:gap-2">
                <Badge variant="secondary" className="shrink-0">
                  {provider.serviceType}
                </Badge>
                <span
                  className="inline-flex items-center gap-1 text-xs sm:text-sm text-muted-foreground"
                  data-testid="text-provider-rating"
                >
                  <StarRating rating={provider.averageRating} />
                  <span className="ml-1 font-medium">{provider.averageRating}</span>
                  <span>
                    ({provider.totalReviews} reviews)
                  </span>
                </span>
              </div>
              <DialogDescription className="sr-only">
                Provider profile and booking information for {provider.name}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-4 sm:-mx-6 px-4 sm:px-6">
          <div className="space-y-4 sm:space-y-6 pb-4">
            <div>
              <h3 className="text-xs sm:text-sm font-medium text-muted-foreground mb-2">
                {t("about")}
              </h3>
              <p
                className="text-xs sm:text-sm text-foreground leading-relaxed"
                data-testid="text-provider-bio"
              >
                {provider.bio}
              </p>
            </div>

            <Separator />

            <div>
              <h3 className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 sm:mb-3">
                {t("servicesOffered")}
              </h3>
              <div className="space-y-2" data-testid="list-services">
                {provider.services.map((service) => (
                  <div
                    key={service.id}
                    className="flex items-center justify-between p-2 sm:p-3 rounded-md bg-muted/50 gap-2"
                    data-testid={`service-item-${service.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs sm:text-sm truncate">{service.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3 shrink-0" />
                        {service.duration}
                      </p>
                    </div>
                    <span className="text-xs sm:text-sm font-semibold shrink-0">
                      {formatMoney(service.price)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 sm:mb-3">
                {t("reviews", { count: reviews.length })}
              </h3>
              {reviews.length > 0 ? (
                <div className="space-y-2 sm:space-y-3" data-testid="list-reviews">
                  {reviews.map((review) => (
                    <div
                      key={review.id}
                      className="p-2 sm:p-3 rounded-md bg-muted/50"
                      data-testid={`review-item-${review.id}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-1">
                        <span
                          className="text-xs sm:text-sm font-medium"
                          data-testid={`review-author-${review.id}`}
                        >
                          {review.reviewerName}
                        </span>
                        <div className="flex items-center gap-2">
                          <StarRating rating={review.rating} size="small" />
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3 shrink-0" />
                            {review.date}
                          </span>
                        </div>
                      </div>
                      <p
                        className="text-xs sm:text-sm text-muted-foreground"
                        data-testid={`review-comment-${review.id}`}
                      >
                        {review.comment}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className="flex flex-col items-center justify-center py-6 sm:py-8 text-center"
                  data-testid="empty-reviews-state"
                >
                  <Star className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground/40 mb-2" />
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                    {t("noReviews")}
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    {t("beFirst")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3 sm:pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
            data-testid="button-close-profile"
          >
            {t("close")}
          </Button>
          <Button onClick={handleBookNow} className="w-full sm:w-auto" data-testid="button-book-now">
            <Calendar className="mr-2 h-4 w-4" />
            {t("bookNow")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
