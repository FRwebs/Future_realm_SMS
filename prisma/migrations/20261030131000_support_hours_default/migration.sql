-- The live country starts with the desk's published hours; the team edits them on Support → Board → Working hours by country.
UPDATE "CountryProfile" SET "supportHours" = '08:00–17:00 WAT, Mon–Fri' WHERE "country" = 'Nigeria' AND "supportHours" IS NULL;
