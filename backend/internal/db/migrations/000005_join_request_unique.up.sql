-- Prevent a member from creating multiple pending requests to the same household.
-- A partial index on status = 'pending' allows re-requesting after rejection.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_join_request
    ON household_join_requests (household_id, requester_id)
    WHERE status = 'pending';
