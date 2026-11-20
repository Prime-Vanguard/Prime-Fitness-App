-- One open (pending) claim per member and task, so a double submit cannot be approved twice.
-- Repeatable tasks can be claimed again once the earlier claim is reviewed.
CREATE UNIQUE INDEX pv_claims_one_pending ON public.pv_claims (member_id, task_id) WHERE status = 'pending';
-- Member notes are short evidence, not storage.
ALTER TABLE public.pv_claims ADD CONSTRAINT pv_claims_note_length CHECK (note IS NULL OR char_length(note) <= 500);
