// Shared shape for the data every automated booking email needs.
// The Phase 5.2 scheduler builds this once per booking from the
// Booking + Property + Guest rows and passes it to the right template.
//
// Templates pick whatever fields they care about — keeping the shape
// uniform means new templates don't churn the scheduler's call site.

export interface BookingEmailContext {
  guestFirstName: string;
  propertyName: string;
  /** Approximate location for pre-arrival privacy. */
  addressApprox: string;
  /** Full address — only included in templates sent on/after check-in. */
  addressFull: string;
  /** YYYY-MM-DD strings — never raw Date objects in template props. */
  checkInISO: string;
  checkOutISO: string;
  checkInTime: string;
  checkOutTime: string;
  numNights: number;
  bookingReference: string;
  /**
   * Optional URL the post-stay email links to so the guest can leave a
   * review. Phase 6 wires the actual review form; for now the
   * scheduler can pass `${siteUrl}/dashboard/bookings/${id}` and the
   * future review CTA will live there.
   */
  reviewUrl?: string;
}
