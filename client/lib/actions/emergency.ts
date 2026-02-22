"use server";

import { auth } from "@/auth";
import { redirect } from "next/navigation";

const EXTERNAL_API_URL = process.env.EXTERNAL_API_URL || 'https://strokeguard-endo.onrender.com';

export async function triggerSOS(latitude?: number | null, longitude?: number | null) {
  const session = await auth();
  
  if (!session?.user?.id) {
    return { error: "You must be logged in to trigger SOS." };
  }

  const patientId = session.user.id;

  try {
    const response = await fetch(`${EXTERNAL_API_URL}/api/v1/patient/sos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        patient_id: patientId,
        latitude: latitude || null,
        longitude: longitude || null,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: "Unknown server error" }));
      return { error: errorData.detail || "Failed to trigger SOS on the server." };
    }

    return { success: true };
  } catch (error: any) {
    console.error("SOS Trigger Error:", error);
    return { error: "Network error or server unavailable." };
  } finally {
      // Revalidate dashboard and redirect to SOS confirmation page if successful
      // (Next.js redirect is better handled in the client for this one)
  }
}
