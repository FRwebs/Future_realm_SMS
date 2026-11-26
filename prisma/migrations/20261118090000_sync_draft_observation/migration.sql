-- An early-years observation can be written with no connection and held on the device, so the
-- school's record of held work has to be able to say that is what it is.
ALTER TYPE "SyncDraftType" ADD VALUE IF NOT EXISTS 'OBSERVATION';
