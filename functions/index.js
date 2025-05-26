import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import admin from 'firebase-admin';

// Initialize admin SDK
admin.initializeApp();
const db = admin.firestore();

// Scheduled function (runs every hour, adjust cron as needed)
export const scheduledCleanup = onSchedule("every 1 hours", async () => {
  return await cleanupExpiredPreRegistrations();
});

// HTTP function for manual invocation/testing (v2)
export const manualCleanup = onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const result = await cleanupExpiredPreRegistrations();
  res.status(result.statusCode).json(JSON.parse(result.body));
});

async function cleanupExpiredPreRegistrations() {
  try {
    console.log("Starting cleanup of expired pre-registrations");
    const now = new Date();
    const preRegisteredRef = db.collection("usersPreRegistered");
    const preRegisteredQuery = preRegisteredRef.where("status", "==", "pre-registered");
    const preRegisteredSnapshot = await preRegisteredQuery.get();
    console.log(`Found ${preRegisteredSnapshot.size} pre-registered users to check`);
    let deletedCount = 0;
    for (const userDoc of preRegisteredSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      if (!userData.eventDate || !userData.eventTime) {
        console.log(`Skipping document ${userId}: Missing eventDate or eventTime`);
        continue;
      }
      const eventDate = userData.eventDate;
      const eventTimeString = userData.eventTime;
      const eventDateTime = new Date(`${eventDate}T${eventTimeString}:00`);
      const graceDateTime = new Date(eventDateTime);
      graceDateTime.setMinutes(graceDateTime.getMinutes() + 5);
      if (now > graceDateTime) {
        console.log(`Deleting pre-registration for user ${userData.name || userId} for event ${userData.eventTitle || 'unknown'}`);
        await preRegisteredRef.doc(userId).delete();
        deletedCount++;
      } else {
        const minutesRemaining = Math.round((graceDateTime - now) / 60000);
        console.log(`Keeping registration for ${userData.name || userId}: ${minutesRemaining} minutes remaining before deletion`);
      }
    }
    console.log(`Cleanup completed successfully. Deleted ${deletedCount} expired registrations.`);
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Cleanup completed successfully',
        deletedRegistrations: deletedCount
      })
    };
  } catch (error) {
    console.error('Error cleaning up pre-registrations:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error processing cleanup', error: error.message })
    };
  }
}