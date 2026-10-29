-- Original individual exercises. Reruns preserve edits and existing group drills.
BEGIN;
INSERT INTO drills (id, title, discipline, skill_set, context_type, duration, source, instructions)
VALUES
('player-solo-batting-shadow-balance-v1', 'Shadow batting balance', 'BATTING', 'Balance and controlled footwork', 'INDIVIDUAL', 10, 'SYSTEM_PREDEFINED',
'Equipment: Bat or no bat, flat non-slip surface, two floor markers.
Setup: Clear enough room to extend both arms and move one stride without hitting anything.
Steps: Start in a comfortable stance. Take a small forward stride and shadow a straight defensive stroke slowly. Pause balanced for two seconds, then return to your stance. Complete three sets of eight repetitions with a short rest between sets.
Cues: Keep your head steady, move smoothly, and finish balanced. Practise without a ball.
Safety: Warm up gently. Keep people and objects outside your swing area. Stop if anything hurts; do not force your range of movement.'),
('player-solo-bowling-walkthrough-v1', 'Bowling rhythm walkthrough', 'BOWLING', 'Rhythm and balance', 'INDIVIDUAL', 10, 'SYSTEM_PREDEFINED',
'Equipment: Two floor markers; no ball required.
Setup: Mark a short clear walking lane on a level non-slip surface.
Steps: Walk through your approach at a comfortable pace. Rehearse your usual bowling action slowly without releasing a ball, then take a controlled step through. Complete three sets of six walkthroughs, resting between sets.
Cues: Repeat a comfortable rhythm and finish upright and balanced. Use your normal action; do not force changes to joint positions.
Safety: No sprinting, jumping for height, or maximum-effort bowling. Clear the lane first, warm up, and stop if anything hurts.'),
('player-solo-keeping-soft-catch-v1', 'Keeping soft-ball self-catch', 'KEEPING', 'Tracking and soft hands', 'INDIVIDUAL', 8, 'SYSTEM_PREDEFINED',
'Equipment: A soft foam ball.
Setup: Stand in a clear area on a level non-slip surface.
Steps: From a comfortable ready position, gently toss the ball a little above waist height and catch it with both hands. Reset after each catch. Complete three sets of ten catches with short rests. Keep tosses close enough to catch without lunging.
Cues: Watch the ball into your hands and receive it softly. Keep the movement relaxed.
Safety: Use a soft ball only, not a hard cricket ball. Do not dive or throw towards your face. Stop if anything hurts.'),
('player-solo-fielding-pickup-v1', 'Controlled fielding pickup', 'FIELDING', 'Ground pickup and balance', 'INDIVIDUAL', 8, 'SYSTEM_PREDEFINED',
'Equipment: A soft foam ball and two floor markers.
Setup: Put the ball on a level non-slip surface with a marker a few comfortable steps away.
Steps: Walk from the marker towards the stationary ball. Lower into a comfortable position, collect it with both hands, stand balanced, and walk back. Reset the ball and repeat three sets of eight, resting between sets.
Cues: Approach under control, keep your eyes on the ball, and collect before standing. Do not throw.
Safety: Avoid hard surfaces with obstacles, deep forced bends, sprinting, and diving. Warm up gently and stop if anything hurts.')
ON CONFLICT (id) DO NOTHING;
COMMIT;
