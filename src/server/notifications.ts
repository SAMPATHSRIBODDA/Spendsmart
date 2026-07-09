import { Router, Response } from "express";
import { Notification } from "./db";
import { authMiddleware, AuthenticatedRequest } from "./auth";
import { mergeSort } from "./dsa";

const router = Router();

// Get all notifications for current user (sorted newest first using manual mergeSort)
router.get("/", authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const notifications = await Notification.find({ userId });
    
    // Sort newest first using manual mergeSort
    const sortedNotifications = mergeSort(notifications, (a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    res.json(sortedNotifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Mark single notification as read
router.put("/:id/read", authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const notifId = req.params.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const updated = await Notification.updateOne(
      { _id: notifId, userId },
      { read: true }
    );

    if (!updated) {
      res.status(404).json({ error: "Notification not found or unauthorized" });
      return;
    }

    res.json({ message: "Notification marked as read" });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Mark all notifications as read
router.put("/read-all", authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    // We update multiple notifications. JsonDatabase updateOne doesn't do bulk updates natively,
    // so we can find all unread ones and update them, or add a loop for local fallback,
    // or perform a simple bulk update.
    // Let's implement bulk update by finding and updating individually in fallback or Mongoose
    const unread = await Notification.find({ userId, read: false });
    for (const notif of unread) {
      await Notification.updateOne({ _id: notif._id, userId }, { read: true });
    }

    res.json({ message: "All notifications marked as read" });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Clear all notifications (delete)
router.delete("/clear", authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    await Notification.deleteMany({ userId });
    res.json({ message: "All notifications cleared successfully" });
  } catch (error) {
    console.error("Error clearing notifications:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
