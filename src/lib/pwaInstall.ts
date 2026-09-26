// Signal shared by the booking flow and InstallPrompt. The banner is mounted
// once in the root layout and survives client-side navigation, so a booking
// made in the same session has to tell it directly — reading localStorage on
// mount alone would only catch it on the next page load.
export const BOOKING_SUCCESS_EVENT = "shizu:booking-success";

export function notifyBookingSuccess(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(BOOKING_SUCCESS_EVENT));
}
