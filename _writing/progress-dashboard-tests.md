---
layout: article
title: "Faking students to check a progress dashboard"
description: I built simulated students to verify that a teacher progress dashboard reports what learners actually did. The dashboard was right on the first run; the bug the exercise found was in my own simulation harness.
summary: To check whether a teacher progress page reported the right numbers, I generated fake students and drove their activity through the real recording code, then asserted the exact metrics. The page was correct. What the test caught instead was an off-by-one in my retention-curve math, from two timestamps taken a millisecond apart.
date: 2026-06-19
tags: [testing, Playwright, dashboards, Supabase]
permalink: /writing/progress-dashboard-tests/
---

*A language-learning app I'm building has a teacher dashboard. This is about
testing the Progress page on it by simulating the students. Claude Code wrote the
simulation; the design and the review were mine.
The bug the exercise turned up was mine, not the dashboard's.*

## The question

The Progress page reports a lot at once:
- average mastery
- reviews in the last 7 days
- retention
- a per-category breakdown
- a retention curve
- an activity heatmap
- a roster with a status band per student

Checking all of it is a lot of work, because each number wants its own kind of
data: mastery needs graduated cards, the 7-day figures need reviews dated in the
right windows, the retention curve needs reviews spread across the days after a
card graduates, and frequent errors only show up if the same wrong answer
recurs. One demo student cannot give you all that, so most of the page just
stays empty.

<figure>
  <img src="/assets/slovo/progress-dashboard-empty.png" alt="The Progress page with only a low-activity demo student: the KPI row reads 0% average mastery, 3 reviews, 33% retention, 0 categories below threshold; the category-mastery panel says 'No category with enough data yet.'; the retention-curve panel says 'Not enough data for the retention curve.'; the frequent-errors panel says 'No recurring errors recorded yet.'; the activity heatmap shows a single green cell; the roster lists one Demo Student, At risk.">
  <figcaption>The page as it actually looked, with one barely-used demo student. Three panels report nothing: category mastery, the retention curve, and frequent errors all say "not enough data." Those are the ones I couldn't judge by looking, because with no traffic they render the same whether the query behind them is right or broken.</figcaption>
</figure>

So the plan was to produce known activity and check the page against it. If I
know a student did 10 reviews and got 8 right, retention should read 80%. If I
know 3 of 5 cards are mastered, average mastery should read 60%.

## Why the obvious version doesn't work

The obvious way to make that data is to drive the app as a student: log in, open
a session, answer cards, then check the teacher page. I wanted that, since it
runs the real path a student takes. But it fails on two counts. Producing the
volume — dozens of graduated cards, reviews across many days — would mean
clicking through hundreds of answers. And clicking only ever happens now, while
half the metrics are defined over past windows; there is no way to click a review
into last week.

## The hybrid

I split the work in two. The reviews go through the app's real code; the timing
and the mastery state I set by hand.

Every review is written by the app's real `record_review` call, signed in as the
student, the same call the session screen makes. So the recording step is real:
no test code inserts a review row directly.

The metrics need history, though, and `record_review` won't produce it on its
own. It reads the student from the login session and always stamps the review
with the current time, with no way to pass a date. So I record each review now,
then move its timestamp back with a second update and set each card's mastery
state directly — a separate backdating step that keeps the simulation cleaner
and, more importantly, leaves the recording call untouched.

Calling `record_review` directly checks that the recording function works, but
not that the session screen actually calls it. So one scenario does the whole
thing in a real browser: it opens a session, answers a card, and confirms the
review lands in the database. That covers the screen-to-database path once. Every
other scenario skips the browser and calls `record_review` directly, which is
faster and lets me set up the exact reviews I want.

That direct path looks like this (the browser scenario is shown further down):

<figure class="narrow">
  <img src="/assets/slovo/simulation-flow.svg" alt="A top-down flow diagram. A 'Scenario plan' box (student, reviews with grade and day, card states) feeds two branches. One goes into 'simulateReviews, signed in as the student', which calls 'record_review (real app code)', which writes 'review_log + srs_state stamped at now()'; an 'admin step' then backdates reviewed_at and sets phase/graduated_at; the 'dashboard RPCs' aggregate the cohort into the '/teacher/progress rendered page'. The other branch turns the plan into an 'Oracle' of expected numbers. The rendered page and the oracle meet at a final 'assert: page numbers == oracle' box.">
  <figcaption>How one scenario is built and checked. Green is the app's real code, amber is what the test controls, grey is the data and the page. The reviews go in through the real <code>record_review</code>; only afterwards does the admin step move them into the past and set mastery state. The same plan also produces the expected numbers the assertion checks against the page.</figcaption>
</figure>

Each scenario is a short plan: this student, these reviews with these grades
on these days, these cards in these states. The test works out the dashboard
numbers that plan should produce and checks them against the page. The dashboard
below is built this way: the on-track student reads 63% mastery and
80% retention, the at-risk one 0% and 20%. The cohort header pools the underlying
data, not the two students: mastery is graduated cards over all cards (5 of 12,
so 42%) and retention is correct reviews over all reviews (17 of 25, so 68%).
Neither is the average of Ana's and Boris's numbers — both lean toward Ana, who
has more cards and did more of the reviews.

<figure>
  <img src="/assets/slovo/progress-dashboard-simulated.png" alt="The teacher Progress dashboard fully populated from two simulated students: KPI row reading 42% average mastery, 25 reviews in 7 days, 68% retention, 0 categories below threshold; a category-mastery panel with Production at 60% and Recognition at 73%; a declining retention curve over buckets g1, g2, g3; an activity heatmap; a frequent-errors row reading 'dom → kuća' with a count of 2; and a roster showing Boris Petrović at 0% mastery / At risk and Ana Novak at 63% / On track.">
  <figcaption>Every number here comes from simulated students, not real ones: two fake learners, Ana (on track) and Boris (at risk), under one teacher, each tracing back to a declared plan.</figcaption>
</figure>

The same page also filters to a single student. Filtered to Ana, the header
shows her own numbers: 63% mastery and 80% retention over her 20 reviews. Her
category bars shift too: Recognition, which both students drilled, climbs from
the cohort's 73% to her 84%, while Production, which only she did, stays at 60%.

<figure>
  <img src="/assets/slovo/progress-dashboard-per-student.png" alt="The same Progress page filtered to one student, Ana Novak: the title reads 'Progress — Ana Novak' with a 'Back to cohort' link and the student selector set to her. The KPI row now reads 63% average mastery, 20 reviews, 80% retention, 0 categories below threshold. The category bars show Production at 60% and Recognition at 84%; the retention curve, activity heatmap and the 'dom → kuća' frequent-error row are all scoped to her, and the roster is gone.">
  <figcaption>The same dashboard filtered to one student (note the "Back to cohort" link). The header now reports Ana's own 63% mastery and 80% retention, not the cohort's pooled 42% and 68%, and every panel narrows to just her reviews.</figcaption>
</figure>

## Where the bug was

The dashboard was right. Every expected number matched. The bug was mine:

It was an off-by-one in the retention curve, which buckets a review by
`floor((reviewed_at - graduated_at) / one_day)`. I graduated a card 40 days ago
and reviewed it at 39, 38, and 37 days ago, expecting buckets 1, 2, 3. But the
two timestamps come from `now()` calls milliseconds apart, so "1 day later"
computes as 0.9999 and `floor` drops it a bucket. Aiming for the middle of each
bucket instead (38.5, 37.5, 36.5) gives half a day of margin and fixes it.

<figure>
  <img src="/assets/slovo/off-by-one.svg" alt="A number line of days since graduation, split at the 1.0-day boundary into buckets g0 (left) and g1 (right). A red dot sits just left of the boundary, labelled 'integer: 0.9999 → g0', with a note 'two now() calls, ~1 ms apart'. A green dot sits in the middle of g1, labelled 'half-day: 1.5 → g1', with a note 'graduate −40 d, review −38.5 d'. A caption reads: the same one-bucket slip hits every integer offset; half-day offsets (1.5, 2.5, 3.5) stay clear.">
  <figcaption>Why the integer offsets were off by one. A review one day after graduation lands exactly on the g0/g1 edge; since the graduation and review timestamps come from two <code>now()</code> calls a millisecond apart, the gap computes as 0.9999 and <code>floor</code> files it under g0 instead of g1. Reviewing at 1.5 days sits mid-bucket, where <code>floor</code> can't slip.</figcaption>
</figure>

## What I take from it

I expected a dashboard bug and found none. What the simulation did instead was
make me pin down each metric far more precisely than reading the page would —
what counts as mastered, which window retention uses, how the curve buckets — and
working out that bucketing exactly is what surfaced the bug hiding in it. On top
of that, the definitions now live as runnable checks with real numbers next to
them, instead of SQL I have to re-read.

Driving everything through the UI would be too
slow; inserting rows directly wouldn't exercise the recording at all; so I keep
the real recording path and set time and state by hand. Most scenarios call
`record_review` themselves, passing the arguments I think the screen passes,
so if the screen later changes how it builds that call (say it starts mapping a
typed answer to a different grade) they keep sending the old arguments and stay
green, even though real students are now recorded differently. That is why I kept
one scenario running through the real browser: it is the only test where the
screen itself builds the call, so it is the one that would catch the drift.

<figure>
  <img src="/assets/slovo/recording-paths.svg" alt="A left-to-right diagram of two paths into the database. Top path: 'student session UI (one scenario)' to 'submitReview server action' to 'record_review'. Bottom path: 'every other scenario calls directly' arrows straight into 'record_review', skipping the screen. From 'record_review' a final arrow goes to 'review_log + srs_state'.">
  <figcaption>Two ways a review reaches the database. One scenario drives the real session screen, so the UI to <code>submitReview</code> to <code>record_review</code> chain runs once. Every other scenario calls <code>record_review</code> directly, entering below the screen — so a change in what the screen passes would slip past them.</figcaption>
</figure>

## The off-the-shelf version

Claude and I built all of this by hand, so afterwards I looked up what production
suites use. Each of the three jobs has a standard tool. The scenario plan — the
students, cards, and graded reviews — is what factory_boy and Faker generate, and
their fixed random seeds would have made the off-by-one reproducible instead of
dependent on the exact values. Controlling time is the one that would have
prevented it: a clock-mocker like time-machine runs the real code inside a frozen
"forty days ago", so every timestamp reads one clock, not two real `now()` calls
a millisecond apart. The browser path is already Playwright.
