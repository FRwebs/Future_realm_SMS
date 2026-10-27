# Reviewing the Yoruba, Hausa and Igbo sign-in screens

FutureRealm is a school management product used by Nigerian schools. Its sign-in screens have been translated into Yoruba, Hausa and Igbo
as **drafts**. Nothing is shown to anyone in these languages until a fluent speaker has read every line. This folder is how that happens.

## For whoever coordinates the review

1. Find one fluent, literate reviewer per language — ideally someone who works in or with schools (a teacher, school administrator or
   education translator), because the words will be read by parents, teachers and bursars. Budget roughly **1–2 hours** per language
   (80 short lines).
2. Send each reviewer **their own CSV** (`yo.csv`, `ha.csv` or `ig.csv`) and the "For the reviewer" section below. Do not send them the
   code or any account details; the CSV is all they need.
3. When a file comes back, save it over the same name in this folder and run:

   ```
   npm run i18n:review -- import yo      # applies corrections, reports how many lines were approved
   npm run test:unit                     # the messages test confirms every placeholder survived
   npm run i18n:review -- approve yo     # only when every line is approved — marks the language reviewed
   ```
4. Turn the languages on in **staging** first (`NEXT_PUBLIC_ENABLE_DRAFT_LOCALES=true`), click through sign-in, a wrong password, an empty
   form, "forgot password" and "choose a new password" in each language, then enable in production.
5. `npm run i18n:review -- status` shows where each language stands.

Pay the reviewer and credit them if they wish. A reviewer's corrections replace the draft; where they disagree with a word choice,
their choice wins.

## For the reviewer (send this with the file)

> Thank you for helping. The file lists the words and sentences on a school software's sign-in screens. Column C is the English; column D is
> our draft in your language. Please read each line **as a parent, teacher or bursar would meet it on a phone**.
>
> - If the draft is right, type **yes** in column F and move on.
> - If it should change, write the corrected text in column E (and **yes** in column F once you are happy with it). Comments are welcome in
>   column G.
> - Keep anything in `{curly brackets}` exactly as it is — the software fills those in (a number, an email address). You may move them
>   within the sentence.
> - Short and plain beats formal. Where people normally say the English word (for example "email" or "password" in everyday speech), you
>   may use it — write what a school office would actually say.
> - Tone: respectful, calm, never blaming ("That code did not work", not "You entered a wrong code").
> - Please keep the file as a CSV (Excel and Google Sheets both can; choose UTF-8 if asked) so tone marks and special letters survive.

## What the draft cannot guarantee

These were produced with machine assistance. They are checked for structure (same keys, same placeholders, valid syntax) but not for
correctness, tone or local usage — that is exactly what the review is for.
