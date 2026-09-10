import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/feed-video")({
  beforeLoad: () => {
    throw redirect({
      to: "/admin/business",
      search: { tab: "feed_video" },
    });
  },
});
