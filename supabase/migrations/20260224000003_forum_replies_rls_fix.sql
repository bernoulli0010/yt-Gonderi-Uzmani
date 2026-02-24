-- ═══════════════════════════════════════════════════════════════
-- FORUM RLS FIX #2 - forum_replies UPDATE policy
-- Any authenticated user needs to update like_count on replies
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Owner or mod/admin can update forum replies" ON public.forum_replies;
CREATE POLICY "Auth users can update forum replies"
  ON public.forum_replies FOR UPDATE
  USING (auth.uid() IS NOT NULL);
