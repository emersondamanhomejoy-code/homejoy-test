import { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import SignatureCanvas from "react-signature-canvas";
import { supabase } from "@/integrations/supabase/client";

export default function SignPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [sigData, setSigData] = useState<any>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const sigRef = useRef<SignatureCanvas>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data, error: err } = await supabase
        .from("booking_signatures")
        .select("*")
        .eq("token", token)
        .single();
      if (err || !data) {
        setError("Invalid or expired link.");
      } else if (data.signed) {
        setDone(true);
        setSigData(data);
      } else {
        setSigData(data);
      }
      setLoading(false);
    })();
  }, [token]);

  const handleSign = async () => {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      alert("Please sign before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      const signatureDataUrl = sigRef.current.toDataURL("image/png");
      const { error: err } = await supabase
        .from("booking_signatures")
        .update({
          signed: true,
          signature_data: signatureDataUrl,
          signed_at: new Date().toISOString(),
        })
        .eq("token", token)
        .eq("signed", false);
      if (err) throw err;
      setDone(true);
    } catch (e: any) {
      alert(e.message || "Failed to submit signature");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="bg-card rounded-lg shadow-lg p-8 text-center max-w-md">
          <div className="text-5xl mb-4">❌</div>
          <div className="text-xl font-bold text-foreground">Link Invalid</div>
          <div className="text-muted-foreground mt-2">{error}</div>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="bg-card rounded-lg shadow-lg p-8 text-center max-w-md">
          <div className="text-5xl mb-4">✅</div>
          <div className="text-xl font-bold text-foreground">Signature Submitted</div>
          <div className="text-muted-foreground mt-2">Thank you, {sigData?.tenant_name}. Your acknowledgment has been recorded.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="bg-card rounded-lg shadow-lg p-6 w-full max-w-lg space-y-6">
        <div className="text-center">
          <div className="text-sm font-bold text-muted-foreground tracking-widest uppercase">Homejoy</div>
          <div className="text-2xl font-extrabold mt-2">Booking Acknowledgment</div>
        </div>

        <div className="bg-secondary rounded-lg p-5 space-y-2">
          <div className="text-sm font-semibold">Tenant: {sigData?.tenant_name}</div>
          {sigData?.booking_data?.room && (
            <div className="text-sm text-muted-foreground">
              Room: {sigData.booking_data.room}
            </div>
          )}
        </div>

        <div className="bg-destructive/10 rounded-lg p-5 border border-destructive/20">
          <div className="text-sm font-bold text-destructive mb-2">⚠️ Important Notice</div>
          <div className="text-sm text-foreground">
            By signing below, I acknowledge and agree that the <strong>booking fee is non-refundable</strong>. 
            I understand that once payment is made, no refund will be issued regardless of the reason for cancellation.
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium text-foreground">Your Signature</div>
          <div className="border-2 border-muted-foreground/30 rounded-lg bg-white overflow-hidden">
            <SignatureCanvas
              ref={sigRef}
              canvasProps={{
                className: "w-full",
                width: 460,
                height: 200,
                style: { width: "100%", height: "200px" },
              }}
              backgroundColor="white"
            />
          </div>
          <button
            onClick={() => sigRef.current?.clear()}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear signature
          </button>
        </div>

        <button
          onClick={handleSign}
          disabled={submitting}
          className="w-full px-5 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "I Agree & Sign"}
        </button>
      </div>
    </div>
  );
}
