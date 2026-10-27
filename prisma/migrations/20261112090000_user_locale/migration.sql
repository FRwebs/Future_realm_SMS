-- The language a person has chosen to read the product in. Null: follow the browser.
ALTER TABLE "User" ADD COLUMN "locale" TEXT;
