"use client";
/**
 * Admin Reviews Page
 *
 * Reviews moderation with quick action buttons on cards and detail drawer.
 * Uses live API — no mock data.
 */

import { useState, useMemo, useEffect } from "react";
import { useParams } from "next/navigation";
import AdminLayout from "./AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Search,
  Star,
  Eye,
  EyeOff,
  Flag,
  MessageSquare,
  User,
  Calendar,
  Loader2,
  Building2,
  MoreVertical,
  CheckCircle2,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { useAdminReviews, type ApiReview } from "@/hooks/useAdminApi";
import { adminApi } from "@/lib/api";
import ErrorBanner from "@/components/ErrorBanner";
import { useToast } from "@/hooks/use-toast";

// Local shape that the UI works with
interface ReviewItem {
  id: string;
  clientName: string;
  providerName: string;
  rating: number;
  comment: string;
  status: 'published' | 'hidden' | 'flagged';
  createdAt: string;
  moderationReason?: string;
  serviceSlug: string;
  bookingId: number;
  punctuality?: boolean;
  respect?: boolean;
}

function toReviewItem(r: ApiReview): ReviewItem {
  const ds = r.display_status;
  return {
    id: String(r.id),
    clientName: r.client_name,
    providerName: r.provider_name || '',
    rating: r.rating,
    comment: r.text || '',
    status: (ds === 'hidden' || ds === 'flagged' ? ds : 'published') as ReviewItem['status'],
    createdAt: r.created_at ? r.created_at.split('T')[0] : '',
    moderationReason: undefined,
    serviceSlug: r.service_slug,
    bookingId: r.booking_id,
    punctuality: r.punctuality,
    respect: r.respect,
  };
}

const statusColors: Record<string, string> = {
  published: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  hidden: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  flagged: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const statusIcons: Record<string, typeof Eye> = {
  published: Eye,
  hidden: EyeOff,
  flagged: Flag,
};

export default function AdminReviews() {
  const { toast } = useToast();
  const params = useParams();
  const isFr = (params?.locale as string) === 'fr';
  const { reviews: apiReviews, setReviews: setApiReviews, loading, error: reviewsError, retry: retryReviews } = useAdminReviews();

  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  useEffect(() => {
    setReviews(apiReviews.map(toReviewItem));
  }, [apiReviews]);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusTab, setStatusTab] = useState("published");
  const [selectedReview, setSelectedReview] = useState<ReviewItem | null>(null);
  const [drawerModerationReason, setDrawerModerationReason] = useState("");
  const [modalModerationReason, setModalModerationReason] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ reviewId: string; newStatus: ReviewItem["status"] } | null>(null);

  const filteredReviews = useMemo(() => {
    return reviews.filter((review) => {
      const matchesSearch =
        searchQuery === "" ||
        review.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        review.providerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        review.comment.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch && review.status === statusTab;
    });
  }, [reviews, searchQuery, statusTab]);

  const reviewCounts = useMemo(() => ({
    published: reviews.filter(r => r.status === "published").length,
    hidden: reviews.filter(r => r.status === "hidden").length,
    flagged: reviews.filter(r => r.status === "flagged").length,
  }), [reviews]);

  const STATUS_MESSAGES: Record<string, { fr: string; en: string }> = {
    published: { fr: "Avis publié.", en: "Review is now visible to users." },
    hidden:    { fr: "Avis masqué.", en: "Review has been hidden from users." },
    flagged:   { fr: "Avis signalé.", en: "Review has been flagged for further review." },
  };

  const handleUpdateStatus = async (reviewId: string, newStatus: ReviewItem["status"], reason?: string, closeDrawer: boolean = true) => {
    setIsUpdating(true);
    try {
      await adminApi.portalModerateReview(Number(reviewId), newStatus, reason);
      setReviews(prev => prev.map(r =>
        r.id === reviewId ? { ...r, status: newStatus, moderationReason: reason } : r
      ));
      if (selectedReview?.id === reviewId) {
        setSelectedReview(prev => prev ? { ...prev, status: newStatus, moderationReason: reason } : null);
      }
      toast({
        title: isFr ? "Statut mis à jour" : "Status Updated",
        description: STATUS_MESSAGES[newStatus]?.[isFr ? 'fr' : 'en'] ?? newStatus,
      });
    } catch (err) {
      console.error("Failed to moderate review:", err);
      toast({ title: "Error", description: "Failed to update review.", variant: "destructive" });
    } finally {
      setDrawerModerationReason("");
      setModalModerationReason("");
      if (closeDrawer) setSelectedReview(null);
      setActionModalOpen(false);
      setPendingAction(null);
      setIsUpdating(false);
    }
  };

  const openActionModal = (reviewId: string, newStatus: ReviewItem["status"]) => {
    setPendingAction({ reviewId, newStatus });
    setModalModerationReason("");
    setActionModalOpen(true);
  };

  const handleQuickAction = async (e: React.MouseEvent, reviewId: string, newStatus: ReviewItem["status"]) => {
    e.stopPropagation();
    if (newStatus === "hidden" || newStatus === "flagged") {
      openActionModal(reviewId, newStatus);
    } else {
      await handleUpdateStatus(reviewId, newStatus);
    }
  };

  const renderStars = (rating: number) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-3.5 w-3.5 ${
            star <= rating
              ? "text-amber-500 fill-amber-500"
              : "text-muted-foreground/30"
          }`}
        />
      ))}
    </div>
  );

  const renderSoftSkills = (review: ReviewItem) => {
    if (review.punctuality === undefined && review.respect === undefined) return null;
    const chips: { label: string; value: boolean }[] = [];
    if (review.punctuality !== undefined)
      chips.push({ label: isFr ? "Ponctualité" : "Punctuality", value: review.punctuality });
    if (review.respect !== undefined)
      chips.push({ label: isFr ? "Respect" : "Respect", value: review.respect });
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {chips.map(({ label, value }) => (
          <span
            key={label}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
              value
                ? "bg-emerald-100 text-emerald-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {value
              ? <ThumbsUp className="h-3 w-3" />
              : <ThumbsDown className="h-3 w-3" />}
            {label}
          </span>
        ))}
      </div>
    );
  };

  const getQuickActions = (review: ReviewItem) => {
    switch (review.status) {
      case "published":
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => handleQuickAction(e, review.id, "hidden")}
              className="h-7 px-2 text-xs"
              data-testid={`quick-hide-${review.id}`}
            >
              <EyeOff className="h-3.5 w-3.5 mr-1" />
              {isFr ? "Masquer" : "Hide"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => handleQuickAction(e, review.id, "flagged")}
              className="h-7 px-2 text-xs text-destructive"
              data-testid={`quick-flag-${review.id}`}
            >
              <Flag className="h-3.5 w-3.5 mr-1" />
              {isFr ? "Signaler" : "Flag"}
            </Button>
          </div>
        );
      case "hidden":
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => handleQuickAction(e, review.id, "published")}
              className="h-7 px-2 text-xs"
              data-testid={`quick-publish-${review.id}`}
            >
              <Eye className="h-3.5 w-3.5 mr-1" />
              {isFr ? "Publier" : "Publish"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => handleQuickAction(e, review.id, "flagged")}
              className="h-7 px-2 text-xs text-destructive"
              data-testid={`quick-flag-hidden-${review.id}`}
            >
              <Flag className="h-3.5 w-3.5 mr-1" />
              {isFr ? "Signaler" : "Flag"}
            </Button>
          </div>
        );
      case "flagged":
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => handleQuickAction(e, review.id, "published")}
              className="h-7 px-2 text-xs"
              data-testid={`quick-publish-flagged-${review.id}`}
            >
              <Eye className="h-3.5 w-3.5 mr-1" />
              {isFr ? "Publier" : "Publish"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => handleQuickAction(e, review.id, "hidden")}
              className="h-7 px-2 text-xs"
              data-testid={`quick-hide-flagged-${review.id}`}
            >
              <EyeOff className="h-3.5 w-3.5 mr-1" />
              {isFr ? "Masquer" : "Hide"}
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <AdminLayout title={isFr ? "Avis" : "Reviews"}>
      <div className="space-y-4">
        {reviewsError && <ErrorBanner isFr={isFr} onRetry={retryReviews} />}
        {/* Search */}
        <Card>
          <CardContent className="py-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={isFr ? "Rechercher dans les avis..." : "Search reviews..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-reviews"
              />
            </div>
          </CardContent>
        </Card>

        {/* Reviews by Status */}
        <Card>
          <CardHeader className="pb-3">
            <Tabs value={statusTab} onValueChange={setStatusTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="published" data-testid="tab-published">
                  <Eye className="h-4 w-4 mr-1.5 hidden sm:inline" />
                  {isFr ? `Publiés (${reviewCounts.published})` : `Published (${reviewCounts.published})`}
                </TabsTrigger>
                <TabsTrigger value="hidden" data-testid="tab-hidden">
                  <EyeOff className="h-4 w-4 mr-1.5 hidden sm:inline" />
                  {isFr ? `Masqués (${reviewCounts.hidden})` : `Hidden (${reviewCounts.hidden})`}
                </TabsTrigger>
                <TabsTrigger value="flagged" data-testid="tab-flagged">
                  <Flag className="h-4 w-4 mr-1.5 hidden sm:inline" />
                  {isFr ? `Signalés (${reviewCounts.flagged})` : `Flagged (${reviewCounts.flagged})`}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="p-0">
            {filteredReviews.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>{isFr ? `Aucun avis ${statusTab === 'published' ? 'publié' : statusTab === 'hidden' ? 'masqué' : 'signalé'}` : `No ${statusTab} reviews found`}</p>
              </div>
            ) : (
              <div className="divide-y" data-testid="reviews-list">
                {filteredReviews.map((review) => (
                  <div
                    key={review.id}
                    className="p-4 hover-elevate"
                    data-testid={`review-row-${review.id}`}
                  >
                    <div className="space-y-2">
                      {/* Header: Name, Stars, Quick Actions */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <button
                          className="flex items-center gap-2 text-left flex-wrap"
                          onClick={() => setSelectedReview(review)}
                        >
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{review.clientName}</span>
                          {renderStars(review.rating)}
                          {renderSoftSkills(review)}
                        </button>
                        <div className="flex items-center gap-2">
                          {getQuickActions(review)}
                          <Badge className={`text-xs ${statusColors[review.status]}`}>
                            {isFr
                              ? (review.status === 'published' ? 'Publié' : review.status === 'hidden' ? 'Masqué' : 'Signalé')
                              : review.status}
                          </Badge>
                        </div>
                      </div>

                      {/* Provider */}
                      <button
                        className="text-sm text-muted-foreground text-left w-full"
                        onClick={() => setSelectedReview(review)}
                      >
                        For: <span className="text-foreground">{review.providerName}</span>
                      </button>

                      {/* Comment preview */}
                      <button
                        className="text-sm line-clamp-2 text-left w-full"
                        onClick={() => setSelectedReview(review)}
                      >
                        {review.comment}
                      </button>

                      {/* Date & Moderation reason preview */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{review.createdAt}</span>
                        </div>
                        {review.moderationReason && (
                          <span className="italic truncate max-w-[200px]">
                            Reason: {review.moderationReason}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Review Detail Sheet */}
      <Sheet open={!!selectedReview} onOpenChange={(open) => !open && setSelectedReview(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{isFr ? "Détail de l'avis" : "Review Details"}</SheetTitle>
            <SheetDescription>
              ID: {selectedReview?.id}
            </SheetDescription>
          </SheetHeader>

          {selectedReview && (
            <div className="space-y-6 mt-6">
              {/* Status & Rating */}
              <div className="flex items-center justify-between">
                <Badge className={`${statusColors[selectedReview.status]}`}>
                  {isFr
                    ? (selectedReview.status === 'published' ? 'Publié' : selectedReview.status === 'hidden' ? 'Masqué' : 'Signalé')
                    : selectedReview.status}
                </Badge>
                {renderStars(selectedReview.rating)}
              </div>
              {renderSoftSkills(selectedReview)}

              {/* Review Info */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">{isFr ? "Auteur" : "Reviewer"}</h4>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium">{selectedReview.clientName}</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">{isFr ? "Prestataire" : "Provider"}</h4>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium">{selectedReview.providerName}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">{isFr ? "Commentaire" : "Comment"}</h4>
                  <p className="text-sm bg-muted/30 p-3 rounded-md">{selectedReview.comment}</p>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>{selectedReview.createdAt}</span>
                </div>

                {selectedReview.moderationReason && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm text-muted-foreground">{isFr ? "Raison de modération" : "Moderation Reason"}</h4>
                    <p className="text-sm italic bg-amber-50 dark:bg-amber-950/30 p-3 rounded-md">
                      {selectedReview.moderationReason}
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="space-y-4 pt-4 border-t">
                <h4 className="font-medium text-sm text-muted-foreground">Actions</h4>
                
                {/* Reason input for hide/flag from sheet */}
                {selectedReview.status === "published" && (
                  <div className="space-y-2">
                    <Label htmlFor="moderation-reason" className="text-sm">{isFr ? "Raison (modération)" : "Reason (for moderation)"}</Label>
                    <Textarea
                      id="moderation-reason"
                      value={drawerModerationReason}
                      onChange={(e) => setDrawerModerationReason(e.target.value)}
                      placeholder={isFr ? "Raison de la modération..." : "Enter reason for moderation..."}
                      rows={2}
                      data-testid="textarea-moderation-reason"
                    />
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  {/* Published -> can Hide or Flag */}
                  {selectedReview.status === "published" && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => handleUpdateStatus(selectedReview.id, "hidden", drawerModerationReason, true)}
                        disabled={isUpdating}
                        data-testid="button-hide-review"
                      >
                        {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
                        {isFr ? "Masquer" : "Hide Review"}
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => handleUpdateStatus(selectedReview.id, "flagged", drawerModerationReason, true)}
                        disabled={isUpdating}
                        data-testid="button-flag-review"
                      >
                        {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Flag className="h-4 w-4 mr-2" />}
                        {isFr ? "Signaler" : "Flag Review"}
                      </Button>
                    </>
                  )}

                  {/* Hidden -> can Publish or Flag */}
                  {selectedReview.status === "hidden" && (
                    <>
                      <Button
                        onClick={() => handleUpdateStatus(selectedReview.id, "published")}
                        disabled={isUpdating}
                        data-testid="button-publish-review"
                      >
                        {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                        {isFr ? "Publier" : "Publish Review"}
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => handleUpdateStatus(selectedReview.id, "flagged")}
                        disabled={isUpdating}
                        data-testid="button-flag-hidden"
                      >
                        {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Flag className="h-4 w-4 mr-2" />}
                        {isFr ? "Signaler" : "Flag Review"}
                      </Button>
                    </>
                  )}

                  {/* Flagged -> can Publish or Hide */}
                  {selectedReview.status === "flagged" && (
                    <>
                      <Button
                        onClick={() => handleUpdateStatus(selectedReview.id, "published")}
                        disabled={isUpdating}
                        data-testid="button-publish-flagged"
                      >
                        {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                        {isFr ? "Publier" : "Publish Review"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleUpdateStatus(selectedReview.id, "hidden")}
                        disabled={isUpdating}
                        data-testid="button-hide-flagged"
                      >
                        {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
                        {isFr ? "Masquer" : "Hide Review"}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Action Modal for Hide/Flag with reason */}
      <Dialog open={actionModalOpen} onOpenChange={setActionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingAction?.newStatus === "flagged"
                ? (isFr ? "Signaler l'avis" : "Flag Review")
                : (isFr ? "Masquer l'avis" : "Hide Review")}
            </DialogTitle>
            <DialogDescription>
              {pendingAction?.newStatus === "flagged"
                ? (isFr ? "Signaler cet avis pour investigation. Raison optionnelle." : "Flag this review for further investigation. You can optionally add a reason.")
                : (isFr ? "Masquer cet avis. Raison optionnelle." : "Hide this review from public view. You can optionally add a reason.")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="action-reason">Reason (optional)</Label>
              <Textarea
                id="action-reason"
                value={modalModerationReason}
                onChange={(e) => setModalModerationReason(e.target.value)}
                placeholder={isFr ? "Raison (optionnelle)..." : "Enter reason for this action..."}
                rows={3}
                data-testid="textarea-action-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionModalOpen(false)}>
              {isFr ? "Annuler" : "Cancel"}
            </Button>
            <Button
              variant={pendingAction?.newStatus === "flagged" ? "destructive" : "default"}
              onClick={() => pendingAction && handleUpdateStatus(pendingAction.reviewId, pendingAction.newStatus, modalModerationReason, false)}
              disabled={isUpdating}
              data-testid="button-confirm-action"
            >
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {pendingAction?.newStatus === "flagged"
                ? (isFr ? "Signaler" : "Flag Review")
                : (isFr ? "Masquer" : "Hide Review")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
